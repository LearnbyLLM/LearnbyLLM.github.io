# Quick Start

Get a working multi-agent framework in 5 minutes.

## Prerequisites

- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)
- A project directory (empty or existing)

## Step 1: Create Directory Structure

```bash
mkdir -p .claude/agents .claude/skills .claude/hooks
```

This creates:
```
.claude/
├── agents/     # Subagent definitions (one .md file per agent)
├── skills/     # Reusable workflows (one directory per skill)
└── hooks/      # Hook scripts (referenced from settings.json)
```

> Note: only `agents/` and `skills/` are special directories Claude Code reads automatically. `hooks/` is just a conventional place to keep hook scripts — hooks themselves are *configured* in `.claude/settings.json` (see [Hooks](../building-blocks/hooks.md)).

## Step 2: Create CLAUDE.md

```bash
cat > CLAUDE.md << 'EOF'
# Multi-Agent Framework

This project uses role-based subagents. Follow these rules:

## Trust Boundaries

1. **Planner**: Read-only. Analyzes requirements and writes plans to `plans/`. Never writes code.
2. **Executor**: Implements code in `src/` and `tests/` based on a plan. Never plans.
3. **Verifier**: Runs tests and validation. Reports to `reports/`. Never fixes code.

## Workflow

Non-trivial features go through: plan (Planner) → implement (Executor) → verify (Verifier).
Delegate to the matching subagent rather than doing the work directly.

## Artifact Protocol

Agents communicate through files in the repo:
- Plans: `plans/<task>.md` with numbered steps and acceptance criteria
- Reports: `reports/<task>.md` with pass/fail per criterion
EOF
```

## Step 3: Create the Planner Agent

Subagents are markdown files with YAML frontmatter. The `description` tells Claude when to delegate; `tools` restricts what the agent can do.

```bash
cat > .claude/agents/planner.md << 'EOF'
---
name: planner
description: Decomposes feature requests into ordered task plans with acceptance criteria. Use before implementing any non-trivial feature. Read-only — never writes code.
tools: Read, Glob, Grep, Write
model: opus
---

You are the Planner. Analyze the request and the existing codebase, then write
a plan to `plans/<task-name>.md`. Never modify source code.

## Plan format

# Plan: <task name>

## Tasks
1. <task> — files: <paths> — acceptance criteria: <criteria>
2. ...

Order tasks by dependency. Each task must be small enough to implement and
verify independently, and every task must list concrete acceptance criteria.

## Constraints

- You CANNOT write or edit source code (your only Write target is plans/)
- You CANNOT run shell commands
- You ONLY produce plans
EOF
```

## Step 4: Create the Executor Agent

```bash
cat > .claude/agents/executor.md << 'EOF'
---
name: executor
description: Implements code from a plan file in plans/. Use after the planner has produced a plan. Writes code and tests; does not plan or verify.
tools: Read, Glob, Grep, Edit, Write, Bash
model: sonnet
---

You are the Executor. Read the specified plan in `plans/`, implement each task
in order, and create the test files the plan calls for.

## Rules

- Follow the plan. If a step is impossible, stop and report why — don't improvise a new plan.
- Only modify files under `src/` and `tests/`.
- Every task must include its test files before you move to the next task.
- When done, summarize what was implemented per task ID.
EOF
```

## Step 5: Run the Framework

Start Claude Code and delegate. Three ways to invoke your agents:

**1. Automatic delegation** — Claude matches your request to agent `description` fields:

```
claude
> Plan a user authentication system with login and registration, then implement task 1.
```

Claude delegates planning to the `planner` subagent (it matches the description), waits for the plan file, then hands task 1 to the `executor`.

**2. Explicit @-mention** — guarantees the agent is used:

```
> @agent-planner plan a user authentication system
```

**3. Run a session as one agent** — for testing an agent in isolation:

```bash
claude --agent planner "Plan a user authentication system"
```

**Expected result:** a `plans/user-authentication.md` file like:

```markdown
# Plan: User Authentication

## Tasks
1. Create user model — files: src/models/user.ts, tests/models/user.test.ts —
   acceptance criteria: User has id/email/passwordHash; bcrypt hashing; email validation
2. Registration endpoint — files: src/routes/auth.ts, tests/routes/auth.test.ts —
   acceptance criteria: POST /auth/register validates email, hashes password, returns 201
   (depends on: 1)
3. Login endpoint — files: src/routes/auth.ts, tests/routes/auth.test.ts —
   acceptance criteria: POST /auth/login returns JWT on success, 401 on bad credentials
   (depends on: 1)
```

Then the executor implements it — and because its `tools` list and the trust boundaries in CLAUDE.md constrain it, it can't drift into re-planning.

## What Just Happened?

1. **User request**: You asked for an authentication system
2. **Planner subagent**: Ran in its own context window with read-only tools, wrote a plan with acceptance criteria
3. **Executor subagent**: Read the plan and implemented tasks with code + tests
4. **Artifacts**: The plan file is a durable, reviewable record of intent

## Key Observations

### Role separation is enforced, not requested
The planner's `tools: Read, Glob, Grep, Write` frontmatter means it *cannot* run shell commands or edit source — the restriction is structural. Compare that to merely asking a general-purpose agent to "please not write code."

### Each agent gets a clean context
Subagents run in their own context window. The executor isn't confused by the planner's exploration, and a long planning session doesn't eat the executor's context budget.

### Artifacts create auditability
Plans and reports live in the repo. You can review them, diff them, and trace every change back to a planned task.

## Next Steps

This basic framework has two agents. To make it production-ready:

1. **Add a Verifier agent**: Runs tests and validates acceptance criteria ([Verifier Agent](../reference-implementation/verifier-agent.md))
2. **Add hooks**: Enforce boundaries automatically — e.g. a `PreToolUse` hook that blocks the executor from touching files outside `src/` and `tests/` ([Hooks](../building-blocks/hooks.md))
3. **Add permissions**: Configure allow/deny rules and the native sandbox in settings ([Settings & Permissions](../building-blocks/settings-and-permissions.md))
4. **Add skills**: Package workflows like `/implement-feature` so the whole pipeline runs from one command ([Skills](../building-blocks/skills.md))
5. **Go parallel**: Run independent agents in the background, or give the executor an isolated git worktree ([Subagents](../building-blocks/subagents.md))

Learn more in [Subagents](../building-blocks/subagents.md) for detailed agent design patterns.
