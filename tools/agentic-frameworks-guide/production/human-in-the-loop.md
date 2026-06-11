# Human-in-the-Loop

Agentic systems can operate autonomously, but that doesn't mean they should. Human oversight is critical for safety, correctness, and trust. Claude Code provides built-in mechanisms for human-in-the-loop (HITL) workflows.

## Claude Code's Built-in HITL

Claude Code already prompts for permission on risky operations:

```
Claude wants to run: rm -rf node_modules

Allow this command?
❯ 1. Yes
  2. Yes, and don't ask again for rm commands in this project
  3. No, and tell Claude what to do differently
```

This is the simplest form of HITL: permission prompts for tool calls that aren't pre-approved. How often you see them is governed by the **permission mode**:

| Mode | Behavior | Human involvement |
|------|----------|-------------------|
| `default` | Prompt for anything not pre-approved by rules | High |
| `acceptEdits` | Auto-accept file edits in the working directory | Medium |
| `plan` | Read-only — no edits or commands at all | Total (nothing happens without you) |
| `auto` | Auto-approve, with background safety checks | Low |
| `dontAsk` | Auto-deny anything not explicitly allowed | Rules decide, not prompts |
| `bypassPermissions` | Skip prompts entirely (explicit `ask` rules still fire) | Minimal — sandboxes only |

Set the mode via `/permissions`, in settings files, with `--permission-mode` on the CLI, or per-subagent with `permissionMode` in the agent's frontmatter. But you can add more sophisticated gates.

## Three Levels of Human Involvement

### 1. Approval Gates (Plan Mode)

The user approves the entire plan before anything executes. This is built in: plan mode makes the session read-only, and Claude presents its plan for explicit approval before switching to execution.

```bash
# Start in plan mode (or press Shift+Tab to cycle modes in-session)
claude --permission-mode plan

> Add JWT authentication to the API

# Claude explores the codebase, then presents a plan.
# Nothing is edited or executed until you approve it.
```

In a multi-agent setup, give the planner subagent `permissionMode: plan` in its frontmatter so it is *architecturally incapable* of writing, then review its `plan.md` artifact before invoking the executor.

This is the highest level of control. The user sees exactly what will happen before it happens.

### 2. Permission Prompts (ask rules)

The user approves individual tool calls during execution. Configure exactly which operations require approval with `ask` rules in `.claude/settings.json` — the real syntax is tool name plus a specifier:

```json
{
  "permissions": {
    "ask": [
      "Bash(rm *)",
      "Bash(sudo *)",
      "Bash(git push *)",
      "Edit(//etc/**)",
      "Write(//etc/**)"
    ]
  }
}
```

`ask` rules even fire in `bypassPermissions` mode — they're the non-negotiable checkpoints. For approval logic that pattern-matching can't express ("ask only if this touches a migration"), a `PreToolUse` hook can return `"permissionDecision": "ask"` to force a prompt dynamically, and `PermissionRequest` hooks can auto-answer prompts based on your own policy code.

### 3. Post-Verification Review

The user reviews the verifier's verdict before accepting changes.

```bash
# Run full PEV cycle
claude -p "/implement-feature Add caching layer"

# Verifier produces verdict
cat .claude/runs/2026-06-10-add-caching/verdict.md

# If PASS, user reviews before committing
git diff
git commit -m "Add caching layer (verified by agent)"
```

This is the lowest level of control. The work is done, but the user reviews before finalizing.

## Letting the Agent Ask

There's a fourth mechanism that inverts the flow: Claude Code's built-in **AskUserQuestion** tool lets the agent pause mid-task and put a structured multiple-choice question to the human — "Should I migrate the schema now or generate a migration script for review?" — instead of guessing.

Encourage it in your agent definitions:

```markdown
# .claude/agents/executor.md (body)

When a step is ambiguous, irreversible, or touches production config,
use the AskUserQuestion tool to confirm direction before proceeding.
Never resolve ambiguity in favor of the more destructive option.
```

And for cheap automated judgment calls that don't need a human, hooks support `"type": "prompt"` — a fast model evaluates the event and returns an allow/deny decision:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "prompt",
        "prompt": "Deny if this command could deploy, publish, or delete data; otherwise allow: $ARGUMENTS"
      }]
    }]
  }
}
```

Use prompt hooks to *triage* — let them auto-allow the obviously safe calls so human attention is reserved for the genuinely risky ones.

## Configuring Approval Gates in a Workflow

Use a skill to orchestrate the pipeline and pause for approval between agents:

```markdown
# .claude/skills/approved-agentic-run/SKILL.md
---
name: approved-agentic-run
description: Full plan-execute-verify workflow with human approval gates
disable-model-invocation: true
---

Run an approved agentic workflow for: $ARGUMENTS

1. Delegate to the planner subagent. Save its plan to .claude/runs/<run-id>/plan.md.
2. APPROVAL GATE: Show the plan, then use AskUserQuestion to ask whether to
   proceed. If the user declines, stop and report.
3. Delegate to the executor subagent with the approved plan.
4. Delegate to the verifier subagent.
5. APPROVAL GATE: Show the verdict, then use AskUserQuestion to ask whether
   to accept the result. If declined, leave the working tree for manual review.
```

Invoke it with `/approved-agentic-run Add input validation to signup form`. The `disable-model-invocation: true` flag means only a human can start this workflow — Claude can't trigger it on its own.

Prefer driving from CI or a terminal script? The same gates work headlessly with real CLI flags:

```bash
#!/bin/bash
# scripts/approved_run.sh
TASK="$1"
RUN_ID="$(date +%Y-%m-%d)-$(echo "$TASK" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | cut -c1-30)"

# Step 1: Plan (planner agent is read-only via permissionMode: plan)
claude --agent planner -p "Create a plan for: $TASK. Write it to .claude/runs/$RUN_ID/plan.md"

# Step 2: Approval gate
echo "=== PLAN ==="
cat ".claude/runs/$RUN_ID/plan.md"
read -p "Approve this plan? [y/N] " -n 1 -r; echo
[[ ! $REPLY =~ ^[Yy]$ ]] && { echo "Plan rejected. Exiting."; exit 1; }

# Step 3 & 4: Execute, then verify
claude --agent executor -p "Execute the plan in .claude/runs/$RUN_ID/plan.md. Log steps to .claude/runs/$RUN_ID/execution.md"
claude --agent verifier -p "Verify .claude/runs/$RUN_ID/execution.md against the plan. Write verdict to .claude/runs/$RUN_ID/verdict.md"

# Step 5: Approval gate
echo "=== VERDICT ==="
cat ".claude/runs/$RUN_ID/verdict.md"
read -p "Accept this result? [y/N] " -n 1 -r; echo
[[ ! $REPLY =~ ^[Yy]$ ]] && { echo "Result rejected. Changes not committed."; exit 1; }

echo "Workflow complete and approved."
```

## When to Require Human Approval

Use `ask` rules for:

**Production deployments:**

```json
{
  "permissions": {
    "ask": [
      "Bash(git push *)",
      "Bash(kubectl apply *)",
      "Bash(terraform apply*)"
    ]
  }
}
```

**Destructive operations:**

```json
{
  "permissions": {
    "ask": [
      "Bash(rm -rf *)",
      "Bash(docker system prune*)"
    ],
    "deny": [
      "Bash(* DROP TABLE *)"
    ]
  }
}
```

Some things shouldn't be a question at all — put them in `deny`, not `ask`.

**External calls and messaging** (MCP tools use the `mcp__server__tool` rule format):

```json
{
  "permissions": {
    "ask": [
      "Bash(curl *)",
      "Bash(wget *)",
      "WebFetch",
      "mcp__email__send_email",
      "mcp__slack__post_message"
    ]
  }
}
```

**Cost-sensitive operations:**

```json
{
  "permissions": {
    "ask": [
      "Bash(npm publish*)",
      "Bash(aws ec2 run-instances *)",
      "mcp__ml_platform__train_model"
    ]
  }
}
```

## Example: Skill with Approval Gates at Every Stage

```markdown
# .claude/skills/safe-refactor/SKILL.md
---
name: safe-refactor
description: Refactor code with mandatory human approval at each stage
disable-model-invocation: true
context: fork
---

Refactor the target described in: $ARGUMENTS

Current branch state (injected before you start):
!`git status --short`

## Process

1. Research: delegate to the researcher subagent for refactoring best practices
2. Plan: delegate to the planner subagent, using the research as context
3. **APPROVAL REQUIRED**: present research + plan; AskUserQuestion before continuing
4. Execute: delegate to the executor subagent
5. Verify: delegate to the verifier subagent; show `git diff` summary + verdict
6. **APPROVAL REQUIRED**: AskUserQuestion before running the full test suite
7. Test: run the project test suite
8. **APPROVAL REQUIRED**: only commit if tests pass AND the user approves

## Safety

- No stage proceeds without explicit user approval
- All changes are reversible (git); on rejection, tell the user how to restore
- Tests must pass before the final approval is even offered
```

Note the `` !`git status --short` `` line — skills can inject live command output into their own context before Claude sees them, so the approval conversation starts from real state, not assumptions.

## Balancing Autonomy and Control

Too many approval prompts cause fatigue:

```
# Annoying - every single file edit requires approval
Allow edit to file1.js? y
Allow edit to file2.js? y
Allow edit to file3.js? y
Allow edit to file4.js? y
# User stops paying attention and just types 'y'
```

Too few prompts increase risk:

```
# Risky - no approval before production deploy
Deploying to production...
Deployment complete.
# User realizes too late that something was wrong
```

**Good balance:**

- Plan-level approval (plan mode) for non-trivial changes
- Operation-level `ask` rules for risky tools (deploy, delete, external API)
- Post-verification review for all production changes

**Example configuration:**

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Grep",
      "Glob",
      "Edit(src/**)",
      "Bash(npm test)",
      "Bash(npm run lint)"
    ],
    "ask": [
      "Bash(git push *)",
      "Bash(rm -rf *)",
      "Bash(kubectl *)",
      "Bash(terraform *)"
    ],
    "deny": [
      "Read(//**/.env)"
    ]
  }
}
```

This allows agents to autonomously read and edit source code, but requires approval for deployment and destructive operations — and makes secrets a non-question. If prompt fatigue persists, `acceptEdits` mode plus tight `ask`/`deny` rules is usually the right trade: edits flow freely (they're reversible via git), while irreversible operations still stop for a human.
