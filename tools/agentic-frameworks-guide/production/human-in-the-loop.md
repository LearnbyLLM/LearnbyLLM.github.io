# Human-in-the-Loop

Agentic systems can operate autonomously, but that doesn't mean they should. Human oversight is critical for safety, correctness, and trust. Claude Code provides built-in mechanisms for human-in-the-loop (HITL) workflows.

## Claude Code's Built-in HITL

Claude Code already prompts for permission on risky operations:

```bash
$ claude-code --agent executor --plan plan.md

Executor wants to run: rm -rf /project/node_modules

This operation will delete files. Allow? [y/N]
```

This is the simplest form of HITL: permission prompts for dangerous tool calls. But you can add more sophisticated gates.

## Three Levels of Human Involvement

### 1. Approval Gates

The user approves the entire plan before the executor runs it.

```bash
# Run planner
claude-code --agent planner \
  --task "Add authentication to API" \
  --run-id 2025-02-05-add-auth

# Show plan to user
cat .claude/runs/2025-02-05-add-auth/plan.md

# User reviews and approves
echo "Plan approved by user at $(date)" >> .claude/runs/2025-02-05-add-auth/approval.txt

# Only then run executor
claude-code --agent executor \
  --plan .claude/runs/2025-02-05-add-auth/plan.md \
  --run-id 2025-02-05-add-auth
```

This is the highest level of control. The user sees exactly what will happen before it happens.

### 2. Permission Prompts

The user approves individual tool calls during execution.

This is Claude Code's default behavior for risky operations:

- File deletion
- Bash commands with sudo
- Git push to remote
- External API calls (if configured)

Configure which operations require permission in `.claude/settings.json`:

```json
{
  "permissions": {
    "require_approval": [
      "Bash:rm",
      "Bash:sudo",
      "Bash:git push",
      "Edit:/etc/*",
      "Write:/etc/*"
    ]
  }
}
```

### 3. Post-Verification Review

The user reviews the verifier's verdict before accepting changes.

```bash
# Run full PEV cycle
./run_agentic.sh "Add caching layer"

# Verifier produces verdict
cat .claude/runs/2025-02-05-add-caching/verdict.md

# If PASS, user reviews before committing
git diff
git commit -m "Add caching layer (verified by agent)"
```

This is the lowest level of control. The work is done, but the user reviews before finalizing.

## Configuring Approval Gates

Use skill orchestration to pause between agents and require approval.

Create an approval skill:

```markdown
# .claude/skills/approved-agentic-run.md

# Approved Agentic Run

This skill runs a full agentic workflow with approval gates.

## Steps

1. Run planner agent
2. PAUSE - show plan to user and wait for approval
3. Run executor agent
4. Run verifier agent
5. PAUSE - show verdict to user and wait for approval

## Usage

claude-code --skill approved-agentic-run --args "task description"
```

Implement the skill as a bash script:

```bash
#!/bin/bash
# .claude/skills/approved_agentic_run.sh

TASK="$1"
RUN_ID="$(date +%Y-%m-%d)-$(echo "$TASK" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | cut -c1-30)"

# Step 1: Plan
echo "Running planner..."
claude-code --agent planner --task "$TASK" --run-id "$RUN_ID"

# Step 2: Approval gate
echo ""
echo "=== PLAN ==="
cat ".claude/runs/$RUN_ID/plan.md"
echo ""
read -p "Approve this plan? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Plan rejected. Exiting."
    exit 1
fi

# Step 3: Execute
echo "Running executor..."
claude-code --agent executor \
  --plan ".claude/runs/$RUN_ID/plan.md" \
  --run-id "$RUN_ID"

# Step 4: Verify
echo "Running verifier..."
claude-code --agent verifier \
  --execution ".claude/runs/$RUN_ID/execution.md" \
  --run-id "$RUN_ID"

# Step 5: Approval gate
echo ""
echo "=== VERDICT ==="
cat ".claude/runs/$RUN_ID/verdict.md"
echo ""
read -p "Accept this result? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Result rejected. Changes not committed."
    exit 1
fi

echo "Workflow complete and approved."
```

Usage:

```bash
./claude/skills/approved_agentic_run.sh "Add input validation to signup form"

# Running planner...
# [planner output]
#
# === PLAN ===
# [plan content]
#
# Approve this plan? [y/N] y
#
# Running executor...
# [executor output]
#
# Running verifier...
# [verifier output]
#
# === VERDICT ===
# Verdict: PASS
# [verdict details]
#
# Accept this result? [y/N] y
#
# Workflow complete and approved.
```

## When to Require Human Approval

Use approval gates for:

**Production deployments:**

```json
{
  "permissions": {
    "require_approval": [
      "Bash:git push origin main",
      "Bash:kubectl apply",
      "Bash:terraform apply"
    ]
  }
}
```

**Destructive operations:**

```json
{
  "permissions": {
    "require_approval": [
      "Bash:rm -rf",
      "Bash:DROP TABLE",
      "Bash:docker system prune"
    ]
  }
}
```

**External API calls:**

```json
{
  "permissions": {
    "require_approval": [
      "Bash:curl",
      "Bash:wget",
      "CustomTool:send_email",
      "CustomTool:post_to_slack"
    ]
  }
}
```

**Cost-sensitive operations:**

```json
{
  "permissions": {
    "require_approval": [
      "Bash:npm publish",
      "Bash:aws ec2 run-instances",
      "CustomTool:train_model"
    ]
  }
}
```

## Example: Skill with Approval Gate

Full skill that pauses after planner and shows plan for approval:

```markdown
# .claude/skills/safe-refactor.md

# Safe Refactor

Refactor code with mandatory human approval at each stage.

## Process

1. Research: Gather best practices for the refactoring
2. Plan: Create detailed refactor plan
3. **APPROVAL REQUIRED**: User reviews plan
4. Execute: Perform refactoring
5. Verify: Check correctness and style
6. **APPROVAL REQUIRED**: User reviews changes
7. Test: Run full test suite
8. **APPROVAL REQUIRED**: User commits if all tests pass

## Safety

- No step proceeds without user approval
- All changes are reversible (git)
- Tests must pass before final approval
```

Implementation:

```bash
#!/bin/bash
# .claude/skills/safe_refactor.sh

REFACTOR_TARGET="$1"
RUN_ID="$(date +%Y-%m-%d)-refactor-$(echo "$REFACTOR_TARGET" | tr ' /' '-' | cut -c1-30)"

echo "Starting safe refactor workflow for: $REFACTOR_TARGET"

# Research
echo "Step 1: Research"
claude-code --agent researcher \
  --query "Best practices for refactoring $REFACTOR_TARGET" \
  --run-id "$RUN_ID"

# Plan
echo "Step 2: Plan"
claude-code --agent planner \
  --task "Refactor $REFACTOR_TARGET" \
  --context ".claude/runs/$RUN_ID/research.md" \
  --run-id "$RUN_ID"

# Approval gate 1
echo ""
echo "=== RESEARCH FINDINGS ==="
cat ".claude/runs/$RUN_ID/research.md"
echo ""
echo "=== PROPOSED PLAN ==="
cat ".claude/runs/$RUN_ID/plan.md"
echo ""
read -p "Approve plan? [y/N] " -n 1 -r
echo
[[ ! $REPLY =~ ^[Yy]$ ]] && { echo "Aborted."; exit 1; }

# Execute
echo "Step 3: Execute"
claude-code --agent executor \
  --plan ".claude/runs/$RUN_ID/plan.md" \
  --run-id "$RUN_ID"

# Verify
echo "Step 4: Verify"
claude-code --agent verifier \
  --execution ".claude/runs/$RUN_ID/execution.md" \
  --run-id "$RUN_ID"

# Approval gate 2
echo ""
echo "=== CHANGES MADE ==="
git diff
echo ""
echo "=== VERDICT ==="
cat ".claude/runs/$RUN_ID/verdict.md"
echo ""
read -p "Approve changes? [y/N] " -n 1 -r
echo
[[ ! $REPLY =~ ^[Yy]$ ]] && { echo "Changes rejected. Run 'git restore .' to undo."; exit 1; }

# Test
echo "Step 5: Test"
npm test
TEST_RESULT=$?

# Approval gate 3
if [ $TEST_RESULT -eq 0 ]; then
    echo ""
    echo "All tests passed."
    read -p "Commit changes? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "Refactor: $REFACTOR_TARGET (agent-assisted, human-approved)"
        echo "Committed."
    else
        echo "Not committed. Changes staged for manual commit."
    fi
else
    echo ""
    echo "Tests failed. Changes NOT committed."
    exit 1
fi
```

## Balancing Autonomy and Control

Too many approval prompts cause fatigue:

```bash
# Annoying - every single file edit requires approval
Approve edit to file1.js? [y/N] y
Approve edit to file2.js? [y/N] y
Approve edit to file3.js? [y/N] y
Approve edit to file4.js? [y/N] y
# User stops paying attention and just types 'y'
```

Too few prompts increase risk:

```bash
# Risky - no approval before production deploy
Deploying to production...
Deployment complete.
# User realizes too late that something was wrong
```

**Good balance:**

- Plan-level approval for non-trivial changes
- Operation-level approval for risky tools (deploy, delete, external API)
- Post-verification review for all production changes

**Example configuration:**

```json
{
  "permissions": {
    "require_approval": [
      "Bash:git push origin main",
      "Bash:rm -rf",
      "Bash:kubectl",
      "Bash:terraform"
    ],
    "auto_approve": [
      "Read",
      "Grep",
      "Glob",
      "Edit:src/**/*.js"
    ]
  }
}
```

This allows agents to autonomously read and edit source code, but requires approval for deployment and destructive operations.
