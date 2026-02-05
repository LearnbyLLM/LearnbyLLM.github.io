# Observability

Observability in agentic systems answers three questions: what happened, why it happened, and how to debug when things go wrong. Unlike traditional applications, multi-agent systems involve multiple autonomous decision-makers, making observability critical.

## Artifact-Based Observability

Every agent run in Claude Code produces artifacts. These are markdown files stored in `.claude/runs/<run-id>/` that capture each agent's work:

- `plan.md` - The planner's proposed approach
- `execution.md` - The executor's step-by-step actions and results
- `verdict.md` - The verifier's assessment (PASS/FAIL with reasoning)
- `research.md` - Any research findings (if researcher agent was used)

Artifacts are the primary observability mechanism. They're human-readable, version-controllable, and persist after the run completes.

## Structured Run IDs

Use timestamps plus task descriptions for run IDs:

```bash
# Good
2025-02-05-add-auth
2025-02-05-fix-validation-bug
2025-02-05-research-caching-strategies

# Bad
run-1
test
tmp
```

This makes it easy to find runs later:

```bash
ls .claude/runs/ | grep add-auth
# 2025-02-05-add-auth
```

## Reading Artifacts After a Run

Inspect artifacts to understand what happened:

```bash
# Check the plan
cat .claude/runs/2025-02-05-add-auth/plan.md

# See what the executor actually did
cat .claude/runs/2025-02-05-add-auth/execution.md

# Read the verifier's verdict
cat .claude/runs/2025-02-05-add-auth/verdict.md
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

Log every tool call for deeper observability:

```python
# .claude/hooks/log_tools.py
import json
import os
from datetime import datetime
from pathlib import Path

def post_tool_use(tool_name, args, result, context):
    """Log every tool call with timestamp and details"""

    run_id = context.get("run_id", "unknown")
    log_dir = Path(f".claude/runs/{run_id}/logs")
    log_dir.mkdir(parents=True, exist_ok=True)

    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "tool": tool_name,
        "args": args,
        "result_preview": str(result)[:200],  # First 200 chars
        "success": not isinstance(result, Exception)
    }

    log_file = log_dir / "tool_calls.jsonl"
    with open(log_file, "a") as f:
        f.write(json.dumps(log_entry) + "\n")

    return result  # Pass through unchanged
```

Register the hook in `.claude/settings.json`:

```json
{
  "hooks": {
    "post_tool_use": ".claude/hooks/log_tools.py:post_tool_use"
  }
}
```

Now every tool call is logged:

```bash
cat .claude/runs/2025-02-05-add-auth/logs/tool_calls.jsonl
```

```json
{"timestamp": "2025-02-05T14:32:01.123Z", "tool": "Bash", "args": {"command": "npm install jsonwebtoken"}, "result_preview": "added 1 package, and audited 245 packages in 2s", "success": true}
{"timestamp": "2025-02-05T14:32:15.456Z", "tool": "Write", "args": {"file_path": "/project/src/middleware/auth.js"}, "result_preview": "File written successfully", "success": true}
{"timestamp": "2025-02-05T14:32:28.789Z", "tool": "Edit", "args": {"file_path": "/project/src/routes/users.js"}, "result_preview": "Edit successful", "success": true}
```

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
2025-02-05-add-auth            | PASS    | 2025-02-05
2025-02-05-fix-validation-bug  | PASS    | 2025-02-05
2025-02-04-refactor-db         | FAIL    | 2025-02-04
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

**Archive old runs.** After a month, move runs to an archive directory:

```bash
mkdir -p .claude/archive/2025-01
mv .claude/runs/2025-01-* .claude/archive/2025-01/
```

This keeps your runs directory focused on recent work while preserving history.
