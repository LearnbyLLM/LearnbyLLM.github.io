# Planner / Executor / Verifier

The Planner-Executor-Verifier (PEV) pattern separates concerns across three distinct agents. No single agent decides what to do, implements it, and confirms success. This separation prevents scope creep, ensures accountability, and provides clear audit trails.

## Why Separate Planning, Execution, and Verification

A monolithic agent that plans and executes has no incentive to verify its work honestly. An agent that executes and verifies can rationalize failures. The PEV pattern enforces checks and balances:

- The Planner never executes code
- The Executor never modifies its own plan
- The Verifier has no stake in passing or failing the task

## Flow Diagram

```
User Request
    ↓
┌─────────────────┐
│    Planner      │ → Outputs: plan.md
│  (read-only)    │
└─────────────────┘
    ↓
┌─────────────────┐
│    Executor     │ → Outputs: execution.md, code changes
│  (read-write)   │
└─────────────────┘
    ↓
┌─────────────────┐
│    Verifier     │ → Outputs: verdict.md (PASS/FAIL/PARTIAL)
│  (read-only)    │
└─────────────────┘
    ↓
Result → User
```

## Planner Role

The Planner decomposes tasks into atomic steps. Each step must include:

- Clear success criteria
- Concrete verification steps
- Safety constraints
- Estimated scope (lines changed, files touched)

Example plan.md structure:

```markdown
## Task: Refactor authentication module

### Step 1: Extract token validation logic
**Success criteria:** Token validation functions moved to auth/validators.js
**Verification:** Run `npm test auth/validators.test.js`, all tests pass
**Safety:** No changes to public API signatures
**Scope:** ~50 lines, 2 files (auth/index.js, auth/validators.js)

### Step 2: Update imports
**Success criteria:** All files importing old paths now import from auth/validators.js
**Verification:** `grep -r "require.*auth" src/` shows no old paths
**Safety:** No runtime errors, existing tests still pass
**Scope:** ~10 files, 1 line each

### Step 3: Remove deprecated code
**Success criteria:** Old validation functions removed from auth/index.js
**Verification:** `git diff` shows deletions only, no additions
**Safety:** Dead code removal only, no behavioral changes
**Scope:** ~30 lines deleted, 1 file
```

The Planner outputs plan.md to `.claude/runs/<run-id>/plan.md`.

## Executor Role

The Executor implements exactly what the plan specifies. It does not:

- Expand scope ("while I'm here, I'll also...")
- Skip steps
- Modify verification criteria

The Executor outputs execution.md documenting what was done:

```markdown
## Execution Log

### Step 1: Extract token validation logic
**Status:** COMPLETED
**Files modified:**
- src/auth/index.js (removed validateToken, validateRefreshToken)
- src/auth/validators.js (created, added validation functions)
**Diff summary:** +52 lines, -45 lines
**Tests run:** npm test auth/validators.test.js (8/8 passed)

### Step 2: Update imports
**Status:** COMPLETED
**Files modified:** 12 files in src/
**Grep result:** No old import paths found
**Tests run:** npm test (all suites passed)
```

The Executor saves execution.md to `.claude/runs/<run-id>/execution.md`.

## Verifier Role

The Verifier audits execution against the plan. It classifies results as:

- **PASS**: All steps completed, all success criteria met
- **FAIL**: Critical success criteria not met
- **PARTIAL**: Some steps completed, requires human review

The Verifier rejects untrusted justifications. If the Executor claims "tests passed" but the log shows failures, the Verifier marks it FAIL.

Example verdict.md:

```markdown
## Verification Report

### Step 1: Extract token validation logic
**Status:** PASS
**Verification:**
- ✓ auth/validators.js exists and exports validateToken, validateRefreshToken
- ✓ Tests pass (verified by running npm test auth/validators.test.js)
- ✓ No public API signature changes (checked exported functions)

### Step 2: Update imports
**Status:** FAIL
**Verification:**
- ✗ Found 2 files still using old import path: src/routes/admin.js, src/routes/user.js
- ✓ Tests pass, but imports not fully updated per plan

### Final Verdict: FAIL
**Reason:** Step 2 incomplete. Old import paths remain in 2 files.
**Recommendation:** Executor must complete Step 2 before proceeding to Step 3.
```

The Verifier saves verdict.md to `.claude/runs/<run-id>/verdict.md`.

## When to Use PEV

Use PEV for any task that:

- Modifies code in production repositories
- Changes infrastructure configuration
- Alters shared state (databases, APIs, file systems)
- Has compliance or safety requirements

Do not use PEV for:

- Read-only research tasks
- Trivial changes (fixing typos, formatting)
- Prototyping in isolated environments

## Strengths and Weaknesses

| Aspect | Strength | Weakness |
|--------|----------|----------|
| Safety | Clear separation prevents unchecked execution | Requires more agents (overhead) |
| Auditability | Every step documented and verified | Slower than single-agent execution |
| Accountability | Easy to identify which agent failed | Requires discipline to follow strictly |
| Scope control | Planner enforces boundaries upfront | Can feel bureaucratic for small tasks |
| Error recovery | Verifier catches mistakes before they propagate | Human must intervene on FAIL verdicts |

## Implementation in Claude Code

Create three agents in `.claude/agents/`:

```
.claude/
  agents/
    planner.md
    executor.md
    verifier.md
```

The orchestrator skill invokes them sequentially:

```bash
# In orchestrator skill
claude chat --agent planner --prompt "Create plan for: $TASK"
claude chat --agent executor --prompt "Execute: .claude/runs/$RUN_ID/plan.md"
claude chat --agent verifier --prompt "Verify: .claude/runs/$RUN_ID/execution.md"
```

Each agent has constrained permissions via settings:

- Planner: read-only, can write to `.claude/runs/<run-id>/` only
- Executor: read-write, follows plan strictly
- Verifier: read-only, can write verdict.md only
