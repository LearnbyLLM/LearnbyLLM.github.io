# Observability

Observability in agentic systems answers three questions: what happened, why it happened, and how to debug when things go wrong. Unlike traditional applications, multi-agent systems involve multiple autonomous decision-makers, making observability critical.

## Artifact-Based Observability

Every agent run in this guide's reference implementation produces artifacts. These are markdown files stored in `.claude/runs/<run-id>/` that capture each agent's work:

- `plan.md` - The planner's proposed approach
- `execution.md` - The executor's step-by-step actions and results
- `verdict.md` - The verifier's assessment (PASS/FAIL with reasoning)
- `research.md` - Any research findings (if researcher agent was used)

Artifacts are the primary observability mechanism. They're human-readable, version-controllable, and persist after the run completes.

## Structured Run IDs

Use timestamps plus task descriptions for run IDs:

```bash
# Good
2026-06-10-add-auth
2026-06-10-fix-validation-bug
2026-06-10-research-caching-strategies

# Bad
run-1
test
tmp
```

This makes it easy to find runs later:

```bash
ls .claude/runs/ | grep add-auth
# 2026-06-10-add-auth
```

Inside skills and hooks, `${CLAUDE_SESSION_ID}` is available — embed it in run IDs or log lines so artifacts correlate with session transcripts and telemetry.

## Reading Artifacts After a Run

Inspect artifacts to understand what happened:

```bash
# Check the plan
cat .claude/runs/2026-06-10-add-auth/plan.md

# See what the executor actually did
cat .claude/runs/2026-06-10-add-auth/execution.md

# Read the verifier's verdict
cat .claude/runs/2026-06-10-add-auth/verdict.md
```

Example `plan.md`:

```markdown
# Plan: Add Authentication

## Scope
Add JWT-based authentication to the API

## Steps
1. Install jsonwebtoken library
2. Create auth middleware in src/middleware/auth.js
3. Protect /api/users routes with middleware
4. Add login endpoint to issue tokens

## Success Criteria
- Login endpoint returns valid JWT
- Protected routes reject requests without valid token
- Tests pass
```

Example `execution.md`:

```markdown
# Execution Log

## Step 1: Install jsonwebtoken
Tool: Bash
Command: npm install jsonwebtoken
Result: SUCCESS - installed jsonwebtoken@9.0.2

## Step 2: Create auth middleware
Tool: Write
File: /project/src/middleware/auth.js
Result: SUCCESS - created 45 lines

## Step 3: Protect routes
Tool: Edit
File: /project/src/routes/users.js
Result: SUCCESS - added middleware to 3 routes

## Step 4: Add login endpoint
Tool: Edit
File: /project/src/routes/auth.js
Result: SUCCESS - created login handler

## Step 5: Run tests
Tool: Bash
Command: npm test
Result: SUCCESS - all tests passed
```

Example `verdict.md`:

```markdown
# Verdict: PASS

## Verification
- Login endpoint tested: returns JWT with correct structure
- Protected routes tested: reject invalid tokens
- All tests pass (12/12)
- No security issues found

## Concerns
None

## Recommendation
Changes are safe to commit.
```

## Adding a PostToolUse Hook for Logging

Log every tool call for deeper observability. Hooks receive a JSON event on stdin — including `session_id`, `tool_name`, and `tool_input`:

```python
#!/usr/bin/env python3
# .claude/hooks/log_tools.py
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

def main():
    event = json.load(sys.stdin)

    log_dir = Path(".claude/runs/logs")
    log_dir.mkdir(parents=True, exist_ok=True)

    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session_id": event.get("session_id"),
        "event": event.get("hook_event_name"),
        "tool": event.get("tool_name"),
        "tool_input": event.get("tool_input"),
    }

    with open(log_dir / "tool_calls.jsonl", "a") as f:
        f.write(json.dumps(log_entry) + "\n")

    sys.exit(0)  # non-zero would surface as a hook error

if __name__ == "__main__":
    main()
```

Register the hook in `.claude/settings.json`. Register it for failures too — `PostToolUse` only fires on success, `PostToolUseFailure` on failure:

```json
{
  "hooks": {
    "PostToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": ".claude/hooks/log_tools.py" }] }],
    "PostToolUseFailure": [{ "matcher": "*", "hooks": [{ "type": "command", "command": ".claude/hooks/log_tools.py" }] }]
  }
}
```

Now every tool call lands in `tool_calls.jsonl`:

```json
{"timestamp": "2026-06-10T14:32:01+00:00", "session_id": "a1b2c3", "event": "PostToolUse", "tool": "Bash", "tool_input": {"command": "npm install jsonwebtoken"}}
{"timestamp": "2026-06-10T14:32:28+00:00", "session_id": "a1b2c3", "event": "PostToolUseFailure", "tool": "Bash", "tool_input": {"command": "npm test"}}
```

## Tracing Subagents and Tasks

Multi-agent runs need agent-level tracing, not just tool-level. Four hook events cover the delegation lifecycle — point the same logging hook at them:

- `SubagentStart` / `SubagentStop` — fire when a subagent spawns/finishes. The matcher is the agent type (`planner`, `executor`...), and the event carries `agent_type` and a unique `agent_id`.
- `TaskCreated` / `TaskCompleted` — fire around task lifecycle, with `task_id` and `task_title`.

Now your JSONL shows the full delegation tree: which agent started, what tools it called, when it stopped.

## OpenTelemetry: The Production Answer

For team or org-scale monitoring, skip the homegrown scripts — Claude Code exports metrics, events, and traces via OpenTelemetry natively:

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp     # or prometheus, console
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

Key metrics: `claude_code.token.usage` (by `type`: input/output/cacheRead/cacheCreation), `claude_code.cost.usage` (USD), `claude_code.code_edit_tool.decision` (accept/reject counts), plus session, lines-of-code, and active-time counters. Cost and token metrics carry `model`, `query_source` (main/subagent/auxiliary), and `agent.name` attribution.

All metrics carry a `session.id` attribute, and LLM request/tool spans carry `agent_id` and `parent_agent_id` — so a trace shows exactly which subagent in which delegation chain issued each request. Tag teams with `OTEL_RESOURCE_ATTRIBUTES="department=eng,team.id=platform"`; the keys become queryable labels.

For a quick in-session check without any of this infrastructure, run `/usage` — it breaks consumption down by category (skills, subagents, plugins, MCP servers).

## Aggregating Runs

Simple bash script to list all runs with their verdicts:

```bash
#!/bin/bash
# .claude/scripts/list_runs.sh

echo "Run ID | Verdict | Date"
echo "-------|---------|------"

for run_dir in .claude/runs/*/; do
    run_id=$(basename "$run_dir")
    verdict_file="$run_dir/verdict.md"

    if [[ -f "$verdict_file" ]]; then
        verdict=$(grep -m 1 "# Verdict:" "$verdict_file" | sed 's/# Verdict: //')
        date=$(echo "$run_id" | cut -d'-' -f1-3)
        echo "$run_id | $verdict | $date"
    else
        echo "$run_id | NO_VERDICT | -"
    fi
done
```

Output:

```
Run ID                          | Verdict | Date
--------------------------------|---------|------------
2026-06-10-add-auth            | PASS    | 2026-06-10
2026-06-10-fix-validation-bug  | PASS    | 2026-06-10
2026-06-09-refactor-db         | FAIL    | 2026-06-09
```

## Tips

**Always inspect failed runs.** When a verifier returns FAIL, read the verdict to understand why:

```bash
grep -A 10 "# Verdict: FAIL" .claude/runs/*/verdict.md
```

**Keep artifacts in version control for team visibility.** Add `.claude/runs/` to git:

```bash
git add .claude/runs/
git commit -m "Add run artifacts for add-auth task"
```

This lets teammates see what agents did and learn from past runs.

**Use grep to find patterns across runs:**

```bash
# Find all failed executions
grep -r "Result: FAILED" .claude/runs/*/execution.md

# Find all runs that modified a specific file
grep -r "src/middleware/auth.js" .claude/runs/*/execution.md
```

**Archive old runs.** After a month, move runs to `.claude/archive/<year-month>/`. This keeps your runs directory focused on recent work while preserving history.
