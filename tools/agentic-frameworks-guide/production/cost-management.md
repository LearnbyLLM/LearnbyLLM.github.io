# Cost Management

Multi-agent systems multiply API costs. Each agent is a separate Claude conversation, and a single user task can trigger multiple agent invocations. Understanding cost drivers and optimization strategies is essential for production use.

## Cost Drivers

Five primary cost drivers:

1. **Number of agents** - More agents = more API calls
2. **Context window size per agent** - Larger context = higher cost per call
3. **Tool call volume** - Each tool call adds tokens (input for args, output for results)
4. **Retries** - Failed runs that retry multiply costs
5. **Research breadth** - Researcher agent fetching many sources

Current pricing (per million tokens, June 2026):

| Model | Input | Output | Use for |
|-------|-------|--------|---------|
| Haiku 4.5 (`haiku`) | $1 | $5 | Checking, summarizing, search |
| Sonnet 4.6 (`sonnet`) | $3 | $15 | Implementation, most agents |
| Opus 4.8 (`opus`, the default) | $5 | $25 | Complex reasoning, planning |
| Fable 5 (`fable`) | $10 | $50 | The hardest problems only |

Example cost breakdown for a typical PEV run:

```
Task: "Add input validation to signup form"

Planner agent:
  - Input: 500 tokens (system prompt + task description)
  - Output: 800 tokens (plan.md)

Executor agent:
  - Input: 2700 tokens (system prompt + plan + tool results)
  - Output: 600 tokens (execution.md)

Verifier agent:
  - Input: 2000 tokens (system prompt + plan + execution + files to verify)
  - Output: 500 tokens (verdict.md)

Total: 5200 input + 1900 output tokens
On Opus 4.8 (default): 5200 × $5/M + 1900 × $25/M ≈ $0.07
```

This is one successful run. If the verifier returns FAIL and you re-plan + re-execute, double the cost.

## Strategies to Reduce Cost

### 1. Match Models to Roles

Not all agents need Opus, let alone Fable. Reserve expensive models for complex reasoning.

**Good model allocation:**

- Planner: Opus (requires complex reasoning; Fable only for genuinely hard architecture work)
- Executor: Sonnet (needs to interpret plan and handle edge cases)
- Verifier: Haiku (mostly checking against criteria)
- Researcher: Haiku (summarizing sources, not creating novel reasoning)

Configure per-agent models with the `model` alias in subagent frontmatter:

```markdown
# .claude/agents/verifier.md
---
name: verifier
description: Verifies execution against the plan's success criteria
model: haiku
---

You verify that execution meets the plan's success criteria...
```

```markdown
# .claude/agents/planner.md
---
name: planner
description: Creates detailed execution plans
model: opus
---

You create detailed execution plans...
```

Aliases (`haiku`, `sonnet`, `opus`, `fable`) track the current best model in each tier, so you don't update files on every release; pin a full ID like `claude-opus-4-8` only when you need version stability. The `CLAUDE_CODE_SUBAGENT_MODEL` environment variable overrides all subagent model settings at once.

**Cost comparison (same 5200 in / 1900 out run):**

```
All Opus 4.8 (default):
- Planner:  500 × $5/M  +  800 × $25/M = $0.0225
- Executor: 2700 × $5/M +  600 × $25/M = $0.0285
- Verifier: 2000 × $5/M +  500 × $25/M = $0.0225
Total: ~$0.074 per run

Optimized (Sonnet planner/executor, Haiku verifier):
- Planner:  500 × $3/M  +  800 × $15/M = $0.0135
- Executor: 2700 × $3/M +  600 × $15/M = $0.0171
- Verifier: 2000 × $1/M +  500 × $5/M  = $0.0045
Total: ~$0.035 per run

Savings: ~52% — and far more at scale, since executor and
verifier token volume dominates real runs
```

**Also tune effort.** On models that support it, the effort level (`low`, `medium`, `high`, `xhigh`, `max`) controls how much thinking a request burns. Set it per subagent or skill in frontmatter (`effort: low` is plenty for a checklist-style verifier), persist a session default with the `effortLevel` setting, or change it live with `/effort`.

### 2. Keep Agent Context Focused

Each agent should only see what it needs. Subagents already help here — they start with a clean context window and return only a summary to the parent, so delegation is itself a context-management tool.

**Bad - verifier told to ingest the world:**

```bash
claude --agent verifier -p "Verify the auth changes. Read every file in src/ first so you have full context."
```

**Good - verifier reads only what the execution log names:**

```bash
claude --agent verifier -p "Verify .claude/runs/2026-06-10-add-auth/execution.md \
against its plan. Read ONLY the files listed in the execution log."
```

**Focused context in agent definitions:**

```markdown
# .claude/agents/executor.md (body)

## Context Requirements

You will receive:
- The plan to execute (plan.md)
- File paths mentioned in the plan (read on demand, don't bulk-read upfront)
- Previous execution state (if retrying)

You do NOT need:
- Entire codebase
- Git history
- Documentation

Keep context minimal. Read files only when needed for a specific step.
```

### 3. Limit Research Scope

The researcher agent can spiral out of control, fetching dozens of sources.

**Bad - unbounded research:**

```markdown
# Researcher Agent

Research everything about the topic. Fetch all relevant documentation, blog posts, Stack Overflow discussions, and GitHub issues.
```

**Good - bounded research:**

```markdown
# Researcher Agent

## Research Scope Limits

- Maximum 5 sources
- Maximum 2 pages per source
- Prioritize: official docs > Stack Overflow > blogs
- Stop when you have sufficient information to answer the query
- If first 5 sources are insufficient, report INSUFFICIENT_DATA rather than fetching more
```

**Enforce the bound mechanically with `maxTurns`** — prompt instructions are advice; the frontmatter cap is a hard stop:

```markdown
# .claude/agents/researcher.md
---
name: researcher
description: Bounded research with explicit uncertainty reporting
tools: WebSearch, WebFetch, Read
model: haiku
effort: low
maxTurns: 15
---
```

A runaway research loop now terminates after 15 agentic turns no matter what the model decides.

### 4. Avoid Retries When Possible

Better planning = fewer executor failures = fewer retries.

**Track failure reasons:**

```bash
# Count failure reasons across runs
grep "Result: FAILED" .claude/runs/*/execution.md | \
  cut -d: -f2 | \
  sort | uniq -c | sort -rn

# Output:
#   12 package not found
#    8 permission denied
#    5 file does not exist
#    3 syntax error
```

**Fix root causes:**

- "package not found" → planner should verify package exists before planning install
- "permission denied" → planner should check permissions before planning file edits
- "file does not exist" → planner should verify file existence before planning edits
- "syntax error" → executor should validate syntax before writing code

**Improve planner to catch these:**

```markdown
# .claude/agents/planner.md

## Pre-flight Checks

Before creating a plan, verify:

1. All packages to be installed exist in npm registry
2. All files to be edited exist and are writable
3. All commands to be run are available (check with `which`)
4. All dependencies are installed

If any check fails, output CANNOT_PLAN with the specific issue.
```

This adds small upfront cost (planner does checks) but avoids expensive retries.

### 5. Cache Research Results

Don't re-research the same topic across runs.

**Simple cache:**

```bash
# .claude/cache/research/
mkdir -p .claude/cache/research

# Before researching, check cache
CACHE_KEY=$(echo "$QUERY" | md5)
CACHE_FILE=".claude/cache/research/$CACHE_KEY.md"

if [ -f "$CACHE_FILE" ]; then
    echo "Using cached research for: $QUERY"
    cat "$CACHE_FILE"
else
    echo "Researching: $QUERY"
    claude --agent researcher -p "$QUERY" > "$CACHE_FILE"
    cat "$CACHE_FILE"
fi
```

**Cache invalidation:**

```bash
# Invalidate cache older than 7 days
find .claude/cache/research -type f -mtime +7 -delete
```

(API-level prompt caching also works in your favor automatically — repeated system prompts and stable context are billed at the much cheaper `cacheRead` rate. One more reason to keep agent definitions stable rather than dynamically generated.)

## Estimating Cost Per Run

Rough formula:

```
Cost per run = Σ per agent: input_tokens × input_price + output_tokens × output_price

Where:
  input_tokens includes system prompt, plan/context, and tool results
  tool_call_overhead ≈ num_tools × 300 tokens (counts as input)
```

**Example estimation:**

```python
# Cost estimator — prices per million tokens (June 2026)
PRICES = {
    "haiku":  (1, 5),
    "sonnet": (3, 15),
    "opus":   (5, 25),
    "fable":  (10, 50),
}

def agent_cost(model, input_tokens, output_tokens):
    inp, out = PRICES[model]
    return input_tokens * inp / 1e6 + output_tokens * out / 1e6

def estimate_run_cost():
    return (
        agent_cost("sonnet", 500, 800)     # planner
        + agent_cost("sonnet", 2700, 600)  # executor
        + agent_cost("haiku", 2000, 500)   # verifier
    )

print(f"Cost: ${estimate_run_cost():.4f}")  # ~$0.035
```

## Monitoring Costs Over Time

**In-session:** run `/usage` for a per-category breakdown — it attributes consumption to skills, subagents, plugins, and MCP servers, which is exactly the granularity you need to find the expensive role.

**In production:** don't build a homegrown token logger — Claude Code exports cost metrics via OpenTelemetry:

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_ENDPOINT=http://collector.internal:4317
```

The two metrics that matter:

- `claude_code.cost.usage` (USD) — with `model`, `query_source` (`main`/`subagent`/`auxiliary`), `effort`, and `agent.name` attributes
- `claude_code.token.usage` — with `type` (`input`/`output`/`cacheRead`/`cacheCreation`), `model`, and the same attribution

A dashboard grouped by `agent.name` answers "which agent is costing us money" directly:

```
sum(claude_code.cost.usage) by (agent.name)

planner   $12.40
executor  $48.10   ← optimization target
verifier  $6.20
```

Tag teams with `OTEL_RESOURCE_ATTRIBUTES="team.id=platform"` to split cost by team across the org.

**Quick local report** from the artifact convention, if you're not running a collector:

```bash
#!/bin/bash
# .claude/scripts/cost_report.sh
echo "Runs this month: $(ls -d .claude/runs/$(date +%Y-%m)-*/ 2>/dev/null | wc -l)"
echo "Failed (likely retried, double-cost) runs:"
grep -l "# Verdict: FAIL" .claude/runs/$(date +%Y-%m)-*/verdict.md 2>/dev/null
```

Failed-then-retried runs are usually the biggest cost leak — which loops this section back to strategy #4: the cheapest run is the one you don't repeat.
