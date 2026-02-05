# Skills

Skills are reusable, user-invocable workflows. Think of them as slash commands that orchestrate multiple agents to accomplish complex tasks.

## Skill Files

Skill files live in `.claude/skills/<name>.md`. Each file defines a workflow that can be triggered by the user.

```
.claude/skills/
├── agentic-run.md
├── deep-research.md
└── safe-refactor.md
```

## Anatomy of a Skill File

A skill file contains:

1. **Description**: What does this skill do?
2. **Trigger**: How is it invoked?
3. **Steps**: The workflow to execute
4. **Agent references**: Which agents are used and how

## Example: Agentic Run Skill

`.claude/skills/agentic-run.md`:

```markdown
# Agentic Run Skill

Execute a feature request using the Planner → Executor → Verifier workflow.

## Trigger

`/agentic-run "task description"`

or

`claude --skill agentic-run "build authentication system"`

## Workflow

This skill orchestrates three agents to implement features safely:

1. **Planner**: Analyzes requirements and creates execution plan
2. **Executor**: Implements the plan
3. **Verifier**: Validates the implementation

## Steps

### Step 1: Create Run Directory

```bash
RUN_ID=$(date +%Y%m%d_%H%M%S)
mkdir -p .claude/runs/$RUN_ID
```

### Step 2: Invoke Planner

```bash
claude --agent planner --run-id $RUN_ID "{{user_input}}"
```

The planner will:
- Read project state
- Analyze requirements
- Write `.claude/runs/$RUN_ID/plan.json`

Wait for planner to complete.

### Step 3: Review Plan

Read `.claude/runs/$RUN_ID/plan.json` and present it to the user:

```
Plan created. Tasks:
1. Modify src/auth.js - Add rate limiting
2. Create tests/auth.test.js - Test rate limiting
3. Update docs/api.md - Document rate limits

Proceed? (yes/no)
```

If user says no, exit. If yes, continue.

### Step 4: Invoke Executor

```bash
claude --agent executor --run-id $RUN_ID
```

The executor will:
- Read `plan.json`
- Implement changes
- Run tests
- Write `.claude/runs/$RUN_ID/changes.json`

Wait for executor to complete.

### Step 5: Invoke Verifier

```bash
claude --agent verifier --run-id $RUN_ID
```

The verifier will:
- Read `changes.json`
- Run full test suite
- Run linters and type checkers
- Write `.claude/runs/$RUN_ID/verification.json`

Wait for verifier to complete.

### Step 6: Report Results

Read `.claude/runs/$RUN_ID/verification.json` and report:

```
Verification Results:
- Tests: 45 passed, 0 failed
- Lint: 0 errors, 2 warnings
- Type check: Passed

Status: SUCCESS

Files changed:
- src/auth.js (modified)
- tests/auth.test.js (created)
- docs/api.md (modified)

Run ID: 20260205_103045
```

If verification failed, ask user if they want to retry with feedback.

## Error Handling

If any agent fails:
1. Stop the workflow
2. Report which agent failed and why
3. Preserve artifacts in `.claude/runs/$RUN_ID/`
4. Ask user how to proceed (retry/cancel)

## User Confirmation Points

- After plan generation (before execution)
- After verification failure (before retry)

## Success Criteria

- All agents complete successfully
- Verification passes
- No manual intervention required (unless verification fails)
```

**Invocation**:

```bash
/agentic-run "add OAuth2 support to the API"
```

or

```bash
claude --skill agentic-run "add OAuth2 support to the API"
```

## Example: Deep Research Skill

`.claude/skills/deep-research.md`:

```markdown
# Deep Research Skill

Conduct comprehensive research using hardened researcher agent with safety boundaries.

## Trigger

`/deep-research "research question"`

## Workflow

1. **Create research sandbox**: Isolated run directory
2. **Invoke researcher agent**: With strict read-only constraints
3. **Synthesize findings**: Generate structured report
4. **Cite sources**: All claims must be sourced

## Steps

### Step 1: Setup

```bash
RUN_ID=$(date +%Y%m%d_%H%M%S)
mkdir -p .claude/runs/$RUN_ID
```

### Step 2: Invoke Researcher

```bash
claude --agent researcher --run-id $RUN_ID "{{user_input}}"
```

Researcher constraints (enforced in `.claude/agents/researcher.md`):
- Read-only access to codebase
- No code execution
- No file modifications
- Web search allowed
- Web fetch allowed

### Step 3: Synthesize Findings

Read `.claude/runs/$RUN_ID/research.md` and create:

`.claude/runs/$RUN_ID/report.md`:

```markdown
# Research Report: {{topic}}

**Date**: {{timestamp}}
**Run ID**: {{run_id}}

## Executive Summary
[2-3 paragraphs synthesizing findings]

## Detailed Findings

### Finding 1: {{title}}
**Source**: {{source}}
**Confidence**: High/Medium/Low

[Details]

### Finding 2: {{title}}
...

## Recommendations
1. [Actionable recommendation]
2. [Actionable recommendation]

## Sources
- [Full bibliography]

## Methodology
- Codebase files examined: X
- Web sources consulted: Y
- Search queries executed: Z
```

### Step 4: Present Report

Display report to user and offer options:

```
Research complete. Report saved to:
.claude/runs/$RUN_ID/report.md

Options:
1. View full report
2. Export to docs/research/
3. Start agentic-run based on findings
4. Done
```

## Safety Features

- Researcher cannot modify code (read-only)
- All sources are cited
- Confidence levels on claims
- Audit trail in run directory

## Output

- `.claude/runs/$RUN_ID/research.md` (raw findings)
- `.claude/runs/$RUN_ID/report.md` (synthesized report)
```

**Invocation**:

```bash
/deep-research "What are the security implications of our current authentication approach?"
```

## Skill File Best Practices

### Orchestration Logic

Skills should contain the coordination logic:

```markdown
## Steps

1. Create run directory
2. Invoke agent A → wait → validate output
3. If A succeeds, invoke agent B → wait → validate output
4. If B succeeds, invoke agent C → wait → validate output
5. Report results
```

### Agent References

Reference agents explicitly:

```markdown
Invoke the executor agent:
`claude --agent executor --run-id $RUN_ID`

The executor will read its configuration from `.claude/agents/executor.md`.
```

### Error Handling

Define failure modes:

```markdown
If planner fails:
- Report error to user
- Preserve partial plan in run directory
- Exit with status code 1

If executor fails:
- Run verifier on partial changes
- Report which tasks succeeded/failed
- Ask user: retry failed tasks? rollback? abort?
```

### User Interaction

Skills can pause for user input:

```markdown
Present plan to user. Wait for confirmation.

If user approves:
  Continue to executor
If user rejects:
  Exit cleanly
If user requests changes:
  Re-invoke planner with feedback
```

## How to Invoke Skills

### Slash Command Style

```bash
/agentic-run "build feature X"
/deep-research "question Y"
/safe-refactor "refactor Z"
```

### CLI Style

```bash
claude --skill agentic-run "build feature X"
claude --skill deep-research --arg "question Y"
```

### Programmatic

From within another skill or agent, you can reference a skill:

```markdown
To implement this, invoke the agentic-run skill:

`/agentic-run "{{sub_task_description}}"`
```

Warning: Avoid deep skill nesting. It creates confusing execution traces.

## Example: Safe Refactor Skill

`.claude/skills/safe-refactor.md`:

```markdown
# Safe Refactor Skill

Refactor code with comprehensive testing before and after.

## Workflow

1. **Snapshot**: Run full test suite, capture coverage
2. **Plan**: Generate refactor plan
3. **Execute**: Perform refactor
4. **Verify**: Re-run tests, compare coverage
5. **Rollback**: If tests fail or coverage drops, rollback

## Steps

1. Create run directory
2. Run tests → save baseline to `baseline.json`
3. Invoke planner with "refactor {{target}}"
4. Invoke executor
5. Run tests → save results to `after.json`
6. Compare baseline vs after:
   - Tests: must pass
   - Coverage: must not decrease
7. If comparison fails:
   - `git checkout .` (rollback)
   - Report failure
8. If comparison succeeds:
   - Report success
   - Offer to commit

## Safety

- Automatic rollback on test failure
- Coverage regression protection
- Git-based rollback (requires clean working tree)
```

## Tips

**Single responsibility**: Each skill should do one thing well. Don't create mega-skills that try to do everything.

**Composability**: Skills should be composable. A complex skill can invoke simpler skills.

**Idempotency**: Skills should be safe to re-run. Use run IDs to avoid collisions.

**Observability**: Always write artifacts to `.claude/runs/$RUN_ID/`. Makes debugging possible.

**User control**: Give users confirmation points for destructive operations.
