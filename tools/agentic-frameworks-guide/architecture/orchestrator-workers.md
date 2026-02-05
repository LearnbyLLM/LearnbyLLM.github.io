# Orchestrator-Workers

The Orchestrator-Workers pattern uses a single orchestrator agent to delegate parallel subtasks to specialized worker agents. Workers are peers, not a pipeline. This pattern excels at embarrassingly parallel tasks where subtasks do not depend on each other.

## How It Differs from PEV

PEV is a sequential pipeline: Planner → Executor → Verifier. Each stage depends on the previous one.

Orchestrator-Workers is a hub-and-spoke model: Orchestrator → [Worker A, Worker B, Worker C] → Orchestrator. Workers execute in parallel.

Use Orchestrator-Workers when:
- Subtasks are independent
- Parallelism speeds up completion
- No single subtask needs verification before others proceed

Use PEV when:
- Subtasks must happen in order
- Verification is required before proceeding
- Safety is the primary concern

## Flow Diagram

```
User Request
    ↓
┌─────────────────────┐
│    Orchestrator     │
│   (splits task)     │
└─────────────────────┘
    ↓
    ├──────────┬──────────┬──────────┐
    ↓          ↓          ↓          ↓
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Worker A│ │Worker B│ │Worker C│ │Worker D│
│(peer)  │ │(peer)  │ │(peer)  │ │(peer)  │
└────────┘ └────────┘ └────────┘ └────────┘
    ↓          ↓          ↓          ↓
    └──────────┴──────────┴──────────┘
                  ↓
         ┌─────────────────────┐
         │    Orchestrator     │
         │  (merges results)   │
         └─────────────────────┘
                  ↓
              Result → User
```

## Example: Refactor All API Endpoints

Task: Update all REST API endpoints to use new authentication middleware.

Orchestrator splits by endpoint:

```markdown
## Orchestration Plan

**Task:** Update authentication middleware across all endpoints

**Workers:**
- Worker A: /api/users/* endpoints (3 files)
- Worker B: /api/posts/* endpoints (5 files)
- Worker C: /api/comments/* endpoints (2 files)
- Worker D: /api/admin/* endpoints (4 files)

**Merge strategy:** Collect all modified files, run full test suite, verify no conflicts
```

Each worker receives a scoped task:

```bash
# Worker A receives:
# "Update /api/users/* endpoints to use authMiddleware v2. Files:
#  - src/routes/users/index.js
#  - src/routes/users/profile.js
#  - src/routes/users/settings.js"
```

Workers execute in parallel. The orchestrator collects results and merges.

## Implementation with Skills

Create an orchestrator skill in `.claude/skills/orchestrate.sh`:

```bash
#!/bin/bash
# .claude/skills/orchestrate.sh

TASK="$1"
RUN_ID=$(date +%s)
WORK_DIR=".claude/runs/$RUN_ID"
mkdir -p "$WORK_DIR"

# Orchestrator analyzes task and splits it
echo "Orchestrator: Splitting task..."
claude chat --agent orchestrator --prompt "Split this task into parallel subtasks: $TASK" > "$WORK_DIR/split.md"

# Parse subtasks (example: assumes split.md has one subtask per line)
SUBTASKS=$(grep "^- Worker" "$WORK_DIR/split.md" | sed 's/^- Worker [A-Z]: //')

# Spawn workers in parallel
WORKER_PIDS=()
WORKER_ID=0
while IFS= read -r subtask; do
  echo "Spawning worker $WORKER_ID for: $subtask"
  claude chat --agent worker --prompt "$subtask" > "$WORK_DIR/worker_$WORKER_ID.log" 2>&1 &
  WORKER_PIDS+=($!)
  WORKER_ID=$((WORKER_ID + 1))
done <<< "$SUBTASKS"

# Wait for all workers
echo "Waiting for workers to complete..."
for pid in "${WORKER_PIDS[@]}"; do
  wait $pid
  if [ $? -ne 0 ]; then
    echo "Worker $pid failed"
  fi
done

# Merge results
echo "Orchestrator: Merging results..."
claude chat --agent orchestrator --prompt "Merge worker outputs from $WORK_DIR"

echo "Orchestration complete. Results in $WORK_DIR"
```

Invoke the skill:

```bash
claude skill orchestrate "Refactor all API endpoints to use authMiddleware v2"
```

## Handling Worker Failures

The orchestrator must decide how to handle failures:

### Strategy 1: Retry
If a worker fails, retry up to N times.

```bash
# In orchestrate.sh
MAX_RETRIES=3
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  claude chat --agent worker --prompt "$subtask" && break
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "Worker failed, retry $RETRY_COUNT/$MAX_RETRIES"
done
```

### Strategy 2: Skip
If a worker fails, mark it as skipped and continue.

```bash
if ! claude chat --agent worker --prompt "$subtask"; then
  echo "SKIPPED: $subtask" >> "$WORK_DIR/skipped.log"
fi
```

### Strategy 3: Escalate
If a worker fails, stop all workers and escalate to the user.

```bash
if ! claude chat --agent worker --prompt "$subtask"; then
  echo "Worker failed. Aborting orchestration."
  kill "${WORKER_PIDS[@]}"
  exit 1
fi
```

Choose based on task requirements:
- Retry: transient failures (network issues, rate limits)
- Skip: optional subtasks (nice-to-have refactors)
- Escalate: critical failures (compilation errors, broken tests)

## When to Use Orchestrator-Workers

Use this pattern for:

- Large-scale refactors affecting many files
- Multi-file changes with no interdependencies
- Parallel research tasks (analyze multiple repos, compare frameworks)
- Batch operations (format all files, update all configs)

Do not use for:

- Tasks requiring sequential execution
- Tasks where one subtask depends on another's output
- Tasks needing strict verification before merging

## Strengths and Weaknesses

| Aspect | Strength | Weakness |
|--------|----------|----------|
| Speed | Parallel execution is much faster | Requires multiple agents running concurrently |
| Scalability | Handles large tasks by splitting them | Merge conflicts can be complex |
| Isolation | Worker failures don't affect other workers | Orchestrator must handle partial failures |
| Resource usage | Workers can run on separate machines | High resource usage if many workers spawn |
| Complexity | Simple hub-and-spoke model | Requires robust merge strategy |

## Orchestrator Agent Example

Create `.claude/agents/orchestrator.md`:

```markdown
# Orchestrator Agent

You are an orchestrator. Your role is to split tasks into parallel subtasks and merge results.

## Responsibilities
- Analyze the task and identify independent subtasks
- Assign subtasks to workers with clear boundaries
- Collect worker outputs and merge them
- Detect conflicts and escalate to the user if necessary

## Constraints
- Each subtask must be independent (no shared state)
- Workers must not modify the same files
- If workers produce conflicts, abort and report to user

## Output Format
When splitting tasks, produce:
- List of subtasks with assigned files
- Expected output from each worker
- Merge strategy (how to combine results)
```

## Worker Agent Example

Create `.claude/agents/worker.md`:

```markdown
# Worker Agent

You are a worker agent. You execute a single well-scoped subtask assigned by the orchestrator.

## Responsibilities
- Execute exactly the subtask assigned to you
- Modify only the files specified in your task
- Report success or failure with clear logs

## Constraints
- Do not expand scope beyond assigned files
- Do not communicate with other workers
- If you encounter an error, fail fast and report it
```
