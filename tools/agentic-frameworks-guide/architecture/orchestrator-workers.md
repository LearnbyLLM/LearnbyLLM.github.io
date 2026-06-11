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

```text
# Worker A receives:
"Update /api/users/* endpoints to use authMiddleware v2. Files:
 - src/routes/users/index.js
 - src/routes/users/profile.js
 - src/routes/users/settings.js"
```

Workers execute in parallel. The orchestrator collects results and merges.

## Implementation in Claude Code

The main session is the orchestrator. It spawns workers with the Agent tool (renamed from the Task tool in v2.1.63 — `Task(...)` still works as an alias in permission rules). Two mechanics make the parallelism real:

- **Background subagents.** Subagents launched in the background run concurrently with each other and with the main conversation; results arrive as messages when each one finishes. Ask for it explicitly ("run these in the background"), press Ctrl+B to background a running task, or set `background: true` in the worker's frontmatter. Background tasks auto-deny permission prompts, so pre-allow the commands workers need in your permission rules.
- **Worktree isolation.** Give the worker `isolation: worktree` and each instance gets its own temporary git worktree — an isolated copy of the repo. Workers physically cannot stomp on each other's files; worktrees with no changes are cleaned up automatically. The trade-off: each worker's changes land in its own worktree, so the orchestrator's merge step becomes a real git merge, not just "collect the files." For non-overlapping file sets that merge is trivial, which is exactly why the split must enforce non-overlap.

One constraint to design around: subagents cannot spawn other subagents. So the orchestrator must be the main thread — either your interactive session, or a dedicated orchestrator agent promoted to the main session with `claude --agent orchestrator`. In that case, restrict what it can spawn with `Agent(agent_type)` syntax in its `tools` field (see the agent definition below).

To make the pattern a repeatable command, wrap it in a skill:

File: `.claude/skills/orchestrate/SKILL.md`

```markdown
---
name: orchestrate
description: Split a task into independent parallel subtasks, run them as background workers, and merge results.
argument-hint: [task description]
disable-model-invocation: true
---

Orchestrate this task across parallel workers: $ARGUMENTS

1. Analyze the task and split it into independent subtasks. Each subtask
   gets an explicit file list; no two subtasks may share files. Write the
   split to `.claude/runs/<RUN_ID>/split.md`.
2. Spawn one `worker` subagent per subtask, all in the background, in a
   single batch so they run concurrently.
3. As workers report back, record each result in
   `.claude/runs/<RUN_ID>/worker_<n>.md`.
4. When all workers are done, merge: collect modified files, run the full
   test suite, and check for conflicts.
5. If any two workers touched the same file, abort the merge and report
   the conflict to me.
```

Invoke it:

```text
/orchestrate Refactor all API endpoints to use authMiddleware v2
```

or non-interactively: `claude -p "/orchestrate Refactor all API endpoints to use authMiddleware v2"`.

For workers that need to talk to each other mid-flight (rare in this pattern — the whole point is independence), agent teams exist as an experimental feature (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`): teammate sessions that communicate via a SendMessage tool. Reach for that only when result-merging by the orchestrator genuinely isn't enough.

## Handling Worker Failures

Workers fail — a step errors out, a worker hits `maxTurns`, a background task gets auto-denied a permission it needed. The orchestrator must decide how to handle failures, and the policy belongs in the skill instructions so it's enforced consistently:

### Strategy 1: Retry
If a worker fails, re-dispatch the subtask up to N times.

```markdown
If a worker reports failure, spawn a fresh worker for the same subtask
with the failure report included in its prompt. Retry at most 2 times
per subtask, then treat it as failed.
```

### Strategy 2: Skip
If a worker fails, mark it as skipped and continue.

```markdown
If a worker reports failure, log the subtask to
`.claude/runs/<RUN_ID>/skipped.md` and continue with the remaining
workers. Include the skipped list in the final report.
```

### Strategy 3: Escalate
If a worker fails, stop everything and escalate to the user.

```markdown
If any worker reports failure, do not merge anything. Stop and report
the failure to me with the worker's log. Wait for instructions.
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
| Cost control | Workers can run on cheap models (Haiku 4.5 at $1/$5 per MTok) | Token usage multiplies with worker count |
| Complexity | Simple hub-and-spoke model | Requires robust merge strategy |

## Orchestrator Agent Example

Create `.claude/agents/orchestrator.md`. This is only needed if you want to run the orchestrator as the main session (`claude --agent orchestrator`); in interactive use, your main session plays this role. The `Agent(worker)` entry in `tools` is an allowlist: this agent can spawn `worker` subagents and nothing else.

```markdown
---
name: orchestrator
description: Splits large tasks into independent parallel subtasks, dispatches them to worker subagents, and merges results.
tools: Agent(worker), Read, Grep, Glob, Write, Bash
model: opus
---

You are an orchestrator. Your role is to split tasks into parallel subtasks and merge results.

## Responsibilities
- Analyze the task and identify independent subtasks
- Spawn worker subagents in the background, in parallel, with clear boundaries
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

Create `.claude/agents/worker.md`. `isolation: worktree` gives each worker instance its own git worktree, so parallel workers cannot conflict at the filesystem level; `model: sonnet` keeps fan-out costs sane (drop to `haiku` for mechanical changes).

```markdown
---
name: worker
description: Executes a single well-scoped subtask assigned by the orchestrator. Modifies only assigned files.
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
isolation: worktree
maxTurns: 50
---

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
