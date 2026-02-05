# Cost Management

Multi-agent systems multiply API costs. Each agent is a separate Claude conversation, and a single user task can trigger multiple agent invocations. Understanding cost drivers and optimization strategies is essential for production use.

## Cost Drivers

Five primary cost drivers:

1. **Number of agents** - More agents = more API calls
2. **Context window size per agent** - Larger context = higher cost per call
3. **Tool call volume** - Each tool call adds tokens (input for args, output for results)
4. **Retries** - Failed runs that retry multiply costs
5. **Research breadth** - Researcher agent fetching many sources

Example cost breakdown for a typical PEV run:

```
Task: "Add input validation to signup form"

Planner agent:
  - Input: 500 tokens (system prompt + task description)
  - Output: 800 tokens (plan.md)
  - Cost: ~1300 tokens

Executor agent:
  - Input: 1200 tokens (system prompt + plan + codebase context)
  - Tool calls: 5 tools × 300 tokens average = 1500 tokens
  - Output: 600 tokens (execution.md)
  - Cost: ~3300 tokens

Verifier agent:
  - Input: 2000 tokens (system prompt + plan + execution + files to verify)
  - Output: 500 tokens (verdict.md)
  - Cost: ~2500 tokens

Total: ~7100 tokens = ~$0.04 (using Opus pricing)
```

This is one successful run. If the verifier returns FAIL and you re-plan + re-execute, double the cost.

## Strategies to Reduce Cost

### 1. Use Haiku for Simple Agents

Not all agents need Opus or Sonnet. Reserve expensive models for complex reasoning.

**Good model allocation:**

- Planner: Sonnet or Opus (requires complex reasoning)
- Executor: Sonnet (needs to interpret plan and handle edge cases)
- Verifier: Haiku (mostly checking against criteria)
- Researcher: Haiku (summarizing sources, not creating novel reasoning)

Configure per-agent models in `.claude/agents/`:

```markdown
# .claude/agents/verifier.md

model: claude-haiku-3-5

# Verifier Agent

You verify that execution meets the plan's success criteria...
```

```markdown
# .claude/agents/planner.md

model: claude-sonnet-4-5

# Planner Agent

You create detailed execution plans...
```

**Cost comparison:**

```
Original (all Opus):
- Planner: 1300 tokens × $15/1M = $0.0195
- Executor: 3300 tokens × $15/1M = $0.0495
- Verifier: 2500 tokens × $15/1M = $0.0375
Total: $0.1065 per run

Optimized (Sonnet planner/executor, Haiku verifier):
- Planner: 1300 tokens × $3/1M = $0.0039
- Executor: 3300 tokens × $3/1M = $0.0099
- Verifier: 2500 tokens × $0.25/1M = $0.000625
Total: $0.0144 per run

Savings: 86%
```

### 2. Keep Agent Context Focused

Each agent should only see what it needs.

**Bad - verifier sees entire codebase:**

```bash
claude-code --agent verifier \
  --execution execution.md \
  --context "$(cat src/**/*.js)"  # Huge context
```

**Good - verifier sees only modified files:**

```bash
# Extract modified files from execution.md
MODIFIED_FILES=$(grep "File:" execution.md | cut -d: -f2)

# Pass only those files
claude-code --agent verifier \
  --execution execution.md \
  --context "$MODIFIED_FILES"
```

**Focused context in agent definitions:**

```markdown
# .claude/agents/executor.md

# Executor Agent

## Context Requirements

You will receive:
- The plan to execute (plan.md)
- File paths mentioned in the plan (read on demand, don't include in initial context)
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

**Enforce limits in researcher agent code:**

```python
# .claude/agents/researcher.py

MAX_SOURCES = 5
MAX_PAGES_PER_SOURCE = 2

def research(query):
    sources = search(query)[:MAX_SOURCES]  # Hard cap

    findings = []
    for source in sources:
        content = fetch(source, max_pages=MAX_PAGES_PER_SOURCE)
        findings.append(summarize(content))

    return synthesize(findings)
```

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
    claude-code --agent researcher --query "$QUERY" > "$CACHE_FILE"
    cat "$CACHE_FILE"
fi
```

**Cache invalidation:**

```bash
# Invalidate cache older than 7 days
find .claude/cache/research -type f -mtime +7 -delete
```

**Or use content-addressed caching:**

```python
# .claude/scripts/cached_research.py
import hashlib
import json
import os
from pathlib import Path

CACHE_DIR = Path(".claude/cache/research")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

def cached_research(query, max_age_days=7):
    """Research with caching. Returns cached result if fresh enough."""

    # Generate cache key from query
    cache_key = hashlib.sha256(query.encode()).hexdigest()
    cache_file = CACHE_DIR / f"{cache_key}.json"

    # Check if cached result exists and is fresh
    if cache_file.exists():
        cache_age = time.time() - cache_file.stat().st_mtime
        if cache_age < max_age_days * 86400:
            with open(cache_file) as f:
                return json.load(f)["result"]

    # Cache miss - do research
    result = run_researcher(query)

    # Cache the result
    with open(cache_file, "w") as f:
        json.dump({"query": query, "result": result, "timestamp": time.time()}, f)

    return result
```

## Estimating Cost Per Run

Rough formula:

```
Cost per run = Sum of (agent_tokens × model_price)

Where:
  agent_tokens = context_size + output_size + tool_call_overhead
  tool_call_overhead ≈ num_tools × 300 tokens
```

**Example estimation:**

```python
# Cost estimator
def estimate_run_cost(
    num_planner_tokens=1300,
    num_executor_tokens=3300,
    num_verifier_tokens=2500,
    planner_model="sonnet",
    executor_model="sonnet",
    verifier_model="haiku"
):
    prices = {
        "opus": 15 / 1_000_000,      # $15 per 1M tokens
        "sonnet": 3 / 1_000_000,     # $3 per 1M tokens
        "haiku": 0.25 / 1_000_000    # $0.25 per 1M tokens
    }

    cost = (
        num_planner_tokens * prices[planner_model] +
        num_executor_tokens * prices[executor_model] +
        num_verifier_tokens * prices[verifier_model]
    )

    return cost

# Typical run
print(f"Cost: ${estimate_run_cost():.4f}")  # $0.0144

# Complex run with research
print(f"Cost: ${estimate_run_cost(
    num_planner_tokens=2000,
    num_executor_tokens=5000,
    num_verifier_tokens=3000
):.4f}")  # $0.0237
```

## Monitoring Costs Over Time

Track token usage per run:

```bash
# .claude/hooks/log_tokens.py
import json
from pathlib import Path

def post_agent_run(agent_name, tokens_used, context):
    run_id = context["run_id"]
    log_file = Path(f".claude/runs/{run_id}/tokens.json")

    data = {}
    if log_file.exists():
        with open(log_file) as f:
            data = json.load(f)

    data[agent_name] = tokens_used

    with open(log_file, "w") as f:
        json.dump(data, f, indent=2)
```

Aggregate across runs:

```bash
# Total tokens by agent type
for run in .claude/runs/*/; do
    if [ -f "$run/tokens.json" ]; then
        cat "$run/tokens.json"
    fi
done | jq -s 'map(to_entries) | flatten | group_by(.key) | map({agent: .[0].key, total: map(.value) | add})'
```

Output:

```json
[
  {"agent": "planner", "total": 45000},
  {"agent": "executor", "total": 120000},
  {"agent": "verifier", "total": 35000}
]
```

**Cost dashboard:**

```bash
#!/bin/bash
# .claude/scripts/cost_report.sh

echo "Cost Report for $(date +%Y-%m)"
echo "================================"

TOTAL_TOKENS=0
TOTAL_COST=0

for run in .claude/runs/$(date +%Y-%m)-*/; do
    if [ -f "$run/tokens.json" ]; then
        RUN_TOKENS=$(cat "$run/tokens.json" | jq '[.[]] | add')
        TOTAL_TOKENS=$((TOTAL_TOKENS + RUN_TOKENS))
    fi
done

# Assuming average $3/1M tokens
TOTAL_COST=$(echo "scale=2; $TOTAL_TOKENS * 3 / 1000000" | bc)

echo "Total tokens: $TOTAL_TOKENS"
echo "Estimated cost: \$$TOTAL_COST"
echo ""
echo "Runs this month: $(ls -d .claude/runs/$(date +%Y-%m)-*/ 2>/dev/null | wc -l)"
```

Run monthly:

```bash
./claude/scripts/cost_report.sh

# Output:
# Cost Report for 2025-02
# ================================
# Total tokens: 450000
# Estimated cost: $1.35
#
# Runs this month: 42
```

This gives visibility into costs and helps identify optimization opportunities.
