# Choosing a Pattern

Not every task requires a multi-agent architecture. Start with the simplest pattern that meets your safety and performance requirements, then add complexity only when needed.

## Decision Tree

```
Does the task modify code or infrastructure?
├─ Yes → Does it require external research?
│        ├─ Yes → Research + PEV
│        └─ No  → PEV
│
└─ No  → Is the task embarrassingly parallel?
         ├─ Yes → Orchestrator-Workers
         └─ No  → Is it complex or requires multiple steps?
                  ├─ Yes → Single agent with skill
                  └─ No  → Single agent, no skill
```

### Step-by-Step Decision Guide

**Question 1: Does the task modify code, infrastructure, or shared state?**
- Yes → Use PEV (Planner-Executor-Verifier) for safety
- No → Go to Question 2

**Question 2: Is the task embarrassingly parallel (independent subtasks)?**
- Yes → Use Orchestrator-Workers for speed
- No → Go to Question 3

**Question 3: Does the task require external knowledge (web search, docs, research)?**
- Yes → Add Research Agent before planning
- No → Go to Question 4

**Question 4: Is the task simple and well-scoped (fix a typo, format a file)?**
- Yes → Use single agent, no multi-agent architecture needed
- No → Use single agent with a skill to manage complexity

## Pattern Comparison Table

| Pattern | Best For | Agents Required | Complexity | Safety | Speed |
|---------|----------|-----------------|------------|--------|-------|
| Single Agent | Typos, formatting, simple refactors | 1 | Low | Low | Fast |
| PEV | Code changes, infrastructure, shared state | 3 | Medium | High | Medium |
| Orchestrator-Workers | Large refactors, parallel tasks | 1 + N workers | Medium | Medium | Fast (parallel) |
| Research + PEV | Code changes requiring external knowledge | 4 | High | High | Slow |
| Single Agent + Skill | Multi-step tasks, automation | 1 | Low | Medium | Fast |

## Pattern Details

A note on the examples below: `/pev`, `/orchestrate`, and `/research-pev` are project skills — `.claude/skills/<name>/SKILL.md` files whose instructions delegate to your subagents in `.claude/agents/`. They are not built-in commands; see [Copy-Paste Hooks](../templates/copy-paste-hooks.md#skill-templates) for working templates. Skills run in-session as `/name args`, or non-interactively via `claude -p "/name args"`.

### Single Agent
Use when:
- Task is trivial (fix typo, format file)
- No verification needed
- No external research required

Example:
```bash
claude -p "Fix typo in README.md: change 'teh' to 'the'"
```

### PEV (Planner-Executor-Verifier)
Use when:
- Task modifies production code
- Safety is critical
- Verification is required before deployment

Example:
```text
/pev Refactor authentication module to use JWT tokens
```

Agents involved:
- Planner: Decomposes task, defines success criteria
- Executor: Implements plan
- Verifier: Audits execution against plan

### Orchestrator-Workers
Use when:
- Task is embarrassingly parallel (no interdependencies)
- Speed matters
- Subtasks are independent

Example:
```text
/orchestrate Update all API endpoints to use new error handling middleware
```

Agents involved:
- Orchestrator: The main session — splits the task, spawns workers as background subagents, merges results
- Workers (N): Execute subtasks in parallel (use `isolation: worktree` so they can't conflict)

### Research + PEV
Use when:
- Task requires external knowledge
- Safety is critical
- Implementation follows research findings

Example:
```text
/research-pev Implement rate limiting for our API using industry best practices
```

Agents involved:
- Researcher: Gathers knowledge, produces findings.md
- Planner: Reads findings.md, creates plan.md
- Executor: Implements plan
- Verifier: Audits execution

### Single Agent + Skill
Use when:
- Task is multi-step but not safety-critical
- Automation is desired (run tests, generate report, commit)
- Single agent can handle it with a script

Example:
```text
/deploy staging
```

Agents involved:
- Single agent following a skill (a SKILL.md with step-by-step instructions, plus any supporting scripts in the skill's directory)

## Hybrid Approaches

Patterns can be combined for complex tasks.

### Hybrid 1: Research + PEV
Research agent feeds findings to the Planner. Use when external knowledge is required before planning. The skill instructions chain four delegations:

```markdown
<!-- .claude/skills/research-pev/SKILL.md (body) -->
For: $ARGUMENTS

1. Delegate to the `researcher` subagent. It writes
   `.claude/runs/<RUN_ID>/research/findings.md`.
2. Delegate to the `planner` subagent with the findings file. It writes
   `plan.md`. Show me the plan and wait for approval.
3. Delegate to the `executor` subagent with the plan. It writes
   `execution.md`.
4. Delegate to the `verifier` subagent with both files. Report the verdict.
```

### Hybrid 2: Orchestrator + PEV
Each worker runs a plan-execute-verify loop internally. Use when parallel subtasks each require verification. Remember that subagents cannot spawn subagents — so the worker can't delegate to a separate planner/executor/verifier. Instead, bake the PEV discipline into the worker's own system prompt:

```markdown
<!-- in .claude/agents/pev-worker.md (body) -->
For your assigned subtask, work in three strict phases:
1. PLAN: write plan.md with steps and success criteria before touching code
2. EXECUTE: follow the plan exactly, logging each step to execution.md
3. VERIFY: re-read your changes against the success criteria and write
   verdict.md (PASS/FAIL). Report FAIL honestly.
```

The orchestrating session then spawns these workers in parallel and audits the verdicts — or re-runs the standalone verifier agent over each worker's output for an independent check.

### Hybrid 3: Research + Orchestrator-Workers
Researcher gathers knowledge, then the session splits work based on findings. Use when parallel tasks require external context.

```text
@agent-researcher Research current best practices for $TASK.
Write findings to .claude/runs/<RUN_ID>/research/findings.md

# then, in the same session:
/orchestrate Apply the recommendations from
.claude/runs/<RUN_ID>/research/findings.md across all services
```

## Rule of Thumb

Start simple, add complexity only when needed:

1. Try single agent first
2. If safety is a concern, add PEV
3. If speed is a concern and tasks are parallel, add Orchestrator-Workers
4. If external knowledge is required, add Research Agent
5. If still not sufficient, combine patterns (hybrid)

## Examples by Task Type

### Fixing a Bug
**Task:** "Fix off-by-one error in pagination logic"

**Pattern:** Single Agent

**Reason:** Well-scoped, low-risk change. No verification needed beyond tests.

```bash
claude -p "Fix off-by-one error in src/pagination.js"
```

### Refactoring Authentication
**Task:** "Refactor authentication to use JWT tokens"

**Pattern:** Research + PEV

**Reason:** Requires external knowledge (JWT best practices). Safety-critical (authentication). Needs verification.

```text
/research-pev Refactor authentication to JWT tokens
```

### Updating All Config Files
**Task:** "Update all package.json files to use Node 18"

**Pattern:** Orchestrator-Workers

**Reason:** Embarrassingly parallel. Each package.json is independent. Workers on `haiku` keep it cheap.

```text
/orchestrate Update all package.json to use Node 18
```

### Formatting Codebase
**Task:** "Run Prettier on all JavaScript files"

**Pattern:** Single Agent + Skill

**Reason:** Single command, but might take time. Use a skill for automation, and run it in the background (Ctrl+B) while you keep working.

```text
/format all JS files
```

### Deploying to Production
**Task:** "Deploy to production, run smoke tests, rollback if tests fail"

**Pattern:** PEV

**Reason:** Safety-critical. Planner defines deployment steps, Executor deploys, Verifier runs smoke tests.

```text
/pev Deploy to production with smoke tests and rollback
```

### Analyzing Competitors
**Task:** "Research how competitors implement search functionality"

**Pattern:** Research Agent only

**Reason:** Read-only task. No execution needed. Run it as a background subagent and keep working.

```text
@agent-researcher Research competitor search implementations
```

## Anti-Patterns

### Over-Engineering
Do not use PEV for trivial tasks.

**Bad:**
```text
/pev Fix typo in README.md
```

**Good:**
```bash
claude -p "Fix typo in README.md"
```

### Under-Engineering
Do not use single agent for safety-critical tasks.

**Bad:**
```bash
claude -p "Refactor authentication and deploy to production"
```

**Good:**
```text
/pev Refactor authentication to JWT tokens
# Then separately:
/pev Deploy to production with rollback plan
```

### Ignoring Parallelism
Do not use PEV for embarrassingly parallel tasks.

**Bad:**
```bash
# Sequential execution: one session at a time, each paying full startup
# and context cost
for endpoint in "${ENDPOINTS[@]}"; do
  claude -p "Refactor $endpoint"
done
```

**Good:**
```text
# Parallel execution: one session spawns background workers concurrently,
# isolated in their own worktrees
/orchestrate Refactor all endpoints to the new middleware
```

## When in Doubt

If you are unsure which pattern to use:

1. Ask: "What is the worst-case failure mode?"
   - Code deletion, data loss, security breach → Use PEV
   - Wasted time, wrong answer → Use single agent

2. Ask: "Can this be parallelized?"
   - Yes → Use Orchestrator-Workers
   - No → Use PEV or single agent

3. Ask: "Do I need external knowledge?"
   - Yes → Add Research Agent
   - No → Proceed without research

4. Start with single agent. If it fails, add structure incrementally.
