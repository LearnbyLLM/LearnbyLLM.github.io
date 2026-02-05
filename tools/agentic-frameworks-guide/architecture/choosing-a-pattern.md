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

### Single Agent
Use when:
- Task is trivial (fix typo, format file)
- No verification needed
- No external research required

Example:
```bash
claude chat --prompt "Fix typo in README.md: change 'teh' to 'the'"
```

### PEV (Planner-Executor-Verifier)
Use when:
- Task modifies production code
- Safety is critical
- Verification is required before deployment

Example:
```bash
claude skill pev "Refactor authentication module to use JWT tokens"
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
```bash
claude skill orchestrate "Update all API endpoints to use new error handling middleware"
```

Agents involved:
- Orchestrator: Splits task, assigns to workers, merges results
- Workers (N): Execute subtasks in parallel

### Research + PEV
Use when:
- Task requires external knowledge
- Safety is critical
- Implementation follows research findings

Example:
```bash
claude skill research-pev "Implement rate limiting for our API using industry best practices"
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
```bash
claude skill deploy "Deploy to staging, run smoke tests, notify team"
```

Agents involved:
- Single agent executes skill (bash script with multiple steps)

## Hybrid Approaches

Patterns can be combined for complex tasks.

### Hybrid 1: Research + PEV
Research agent feeds findings to the Planner. Use when external knowledge is required before planning.

```bash
# research-pev.sh
RUN_ID=$(date +%s)
claude chat --agent researcher --prompt "Research: $TASK"
claude chat --agent planner --prompt "Plan based on: .claude/runs/$RUN_ID/research/findings.md"
claude chat --agent executor --prompt "Execute: .claude/runs/$RUN_ID/plan.md"
claude chat --agent verifier --prompt "Verify: .claude/runs/$RUN_ID/execution.md"
```

### Hybrid 2: Orchestrator + PEV
Each worker runs a PEV workflow internally. Use when parallel subtasks each require verification.

```bash
# orchestrator-pev.sh
# Orchestrator splits task into subtasks
claude chat --agent orchestrator --prompt "Split: $TASK"

# Each worker runs PEV
for subtask in "${SUBTASKS[@]}"; do
  claude skill pev "$subtask" &
done
wait

# Orchestrator merges results
claude chat --agent orchestrator --prompt "Merge PEV outputs"
```

### Hybrid 3: Research + Orchestrator-Workers
Researcher gathers knowledge, Orchestrator splits based on findings. Use when parallel tasks require external context.

```bash
# research-orchestrator.sh
claude chat --agent researcher --prompt "Research frameworks for $TASK"
claude chat --agent orchestrator --prompt "Split $TASK based on research, assign to workers"
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
claude chat --prompt "Fix off-by-one error in src/pagination.js"
```

### Refactoring Authentication
**Task:** "Refactor authentication to use JWT tokens"

**Pattern:** Research + PEV

**Reason:** Requires external knowledge (JWT best practices). Safety-critical (authentication). Needs verification.

```bash
claude skill research-pev "Refactor authentication to JWT tokens"
```

### Updating All Config Files
**Task:** "Update all package.json files to use Node 18"

**Pattern:** Orchestrator-Workers

**Reason:** Embarrassingly parallel. Each package.json is independent.

```bash
claude skill orchestrate "Update all package.json to use Node 18"
```

### Formatting Codebase
**Task:** "Run Prettier on all JavaScript files"

**Pattern:** Single Agent + Skill

**Reason:** Single command, but might take time. Use skill for automation.

```bash
claude skill format "Run Prettier on all JS files"
```

### Deploying to Production
**Task:** "Deploy to production, run smoke tests, rollback if tests fail"

**Pattern:** PEV

**Reason:** Safety-critical. Planner defines deployment steps, Executor deploys, Verifier runs smoke tests.

```bash
claude skill pev "Deploy to production with smoke tests and rollback"
```

### Analyzing Competitors
**Task:** "Research how competitors implement search functionality"

**Pattern:** Research Agent only

**Reason:** Read-only task. No execution needed.

```bash
claude chat --agent researcher --prompt "Research competitor search implementations"
```

## Anti-Patterns

### Over-Engineering
Do not use PEV for trivial tasks.

**Bad:**
```bash
claude skill pev "Fix typo in README.md"
```

**Good:**
```bash
claude chat --prompt "Fix typo in README.md"
```

### Under-Engineering
Do not use single agent for safety-critical tasks.

**Bad:**
```bash
claude chat --prompt "Refactor authentication and deploy to production"
```

**Good:**
```bash
claude skill pev "Refactor authentication to JWT tokens"
# Then separately:
claude skill pev "Deploy to production with rollback plan"
```

### Ignoring Parallelism
Do not use PEV for embarrassingly parallel tasks.

**Bad:**
```bash
# Sequential execution
for endpoint in "${ENDPOINTS[@]}"; do
  claude chat --prompt "Refactor $endpoint"
done
```

**Good:**
```bash
# Parallel execution
claude skill orchestrate "Refactor all endpoints: ${ENDPOINTS[*]}"
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
