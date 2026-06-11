# Skills

Skills are reusable workflows. Think of them as slash commands with superpowers: invocable by you (`/skill-name`), invocable by Claude automatically when relevant, and capable of orchestrating multiple subagents to accomplish complex tasks.

> **Note on `.claude/commands/`**: custom slash commands have been merged into skills. A file at `.claude/commands/deploy.md` and a skill at `.claude/skills/deploy/SKILL.md` both create `/deploy`. Old command files keep working (and support the same frontmatter), but skills are the recommended format — they get a directory for supporting files, invocation control, and automatic invocation. If both exist with the same name, the skill wins.

## Skill Files

Each skill is a directory containing a `SKILL.md`, plus any supporting files (templates, scripts, examples) the workflow needs:

```
.claude/skills/
├── agentic-run/
│   └── SKILL.md
├── deep-research/
│   ├── SKILL.md
│   └── report-template.md
└── safe-refactor/
    └── SKILL.md
```

Skills also live at the user level (`~/.claude/skills/`) and in plugins (namespaced `plugin-name:skill-name`). On a name collision, enterprise beats personal beats project.

## Anatomy of a Skill File

`SKILL.md` is YAML frontmatter plus markdown instructions. The fields that matter most for agentic frameworks:

| Field | Purpose |
|-------|---------|
| `description` | What the skill does and when to use it. Claude reads this to auto-invoke. |
| `disable-model-invocation` | `true` = only you can trigger it via `/name`. Use for anything with side effects (deploys, commits). |
| `user-invocable` | `false` = hidden from the `/` menu; only Claude invokes it. Use for background knowledge. |
| `allowed-tools` | Tools pre-approved while the skill is active (e.g. `Bash(git commit *)`). Permission deny rules still apply. |
| `disallowed-tools` | Tools removed from the pool while the skill is active. Clears on your next message. |
| `context: fork` | Run the skill in an isolated subagent instead of your main conversation. |
| `agent` | Which subagent type executes a `context: fork` skill (default: general-purpose). |
| `model` | Model to use while the skill is active (`opus`, `sonnet`, `haiku`, `fable`). |
| `argument-hint` | Autocomplete hint, e.g. `[task description]`. |
| `paths` | Glob patterns limiting when the skill auto-activates. |

Arguments flow in via `$ARGUMENTS` (everything after the skill name), `$0`/`$1`/... for positional access, or named arguments declared in an `arguments` frontmatter list. Lines like `` !`git diff HEAD` `` are **dynamic context injection**: Claude Code runs the command first and inlines its output before Claude ever sees the skill.

## Example: Agentic Run Skill

`.claude/skills/agentic-run/SKILL.md`:

```markdown
---
description: Execute a feature request using the Planner → Executor → Verifier workflow
argument-hint: [task description]
disable-model-invocation: true
allowed-tools: Bash(mkdir *) Bash(date *)
---

# Agentic Run

Execute this feature request using the three-stage agent workflow: $ARGUMENTS

Current state of the working tree:
!`git status --short`

## Steps

### Step 1: Create Run Directory

Generate a run id from the current timestamp and create `.claude/runs/<run-id>/`.

### Step 2: Invoke Planner

Use the Agent tool to invoke the **planner** subagent. Pass it the run id and
the task: "$ARGUMENTS". The planner will analyze requirements and write
`.claude/runs/<run-id>/plan.json`.

### Step 3: Review Plan

Read `plan.json` and present the task list to the user:

    Plan created. Tasks:
    1. Modify src/auth.js - Add rate limiting
    2. Create tests/auth.test.js - Test rate limiting

    Proceed? (yes/no)

If the user says no, stop. If yes, continue.

### Step 4: Invoke Executor

Use the Agent tool to invoke the **executor** subagent with the run id.
It reads `plan.json`, implements changes, runs tests, and writes `changes.json`.

### Step 5: Invoke Verifier

Use the Agent tool to invoke the **verifier** subagent with the run id.
It runs the full test suite, linters, and type checks, and writes `verification.json`.

### Step 6: Report Results

Read `verification.json` and report tests/lint/type-check results, the list of
changed files, and the run id. If verification failed, ask the user whether to
retry the executor with the failure feedback.

## Error Handling

If any agent fails:
1. Stop the workflow
2. Report which agent failed and why
3. Preserve artifacts in `.claude/runs/<run-id>/`
4. Ask the user how to proceed (retry/cancel)

## User Confirmation Points

- After plan generation (before execution)
- After verification failure (before retry)
```

**Invocation**:

```
/agentic-run add OAuth2 support to the API
```

Two things changed from the old (pre-2026) way of writing this. First, orchestration goes through the **Agent tool** — the skill instructs Claude to spawn subagents, not to shell out to `claude --agent` (there is no `--skill` CLI flag, and spawning nested CLI processes loses all permission context). Second, `disable-model-invocation: true` means Claude can never decide on its own that your code "looks ready" and kick off an execution run.

## Example: Deep Research Skill

`.claude/skills/deep-research/SKILL.md`:

```markdown
---
description: Conduct comprehensive, cited research on a question using the read-only researcher agent
argument-hint: [research question]
context: fork
agent: researcher
---

# Deep Research

Research this question thoroughly: $ARGUMENTS

1. Search the codebase and the web for relevant information
2. Cross-check claims across at least two sources
3. Produce your final response as a report following the structure in
   report-template.md in this skill's directory: executive summary, detailed
   findings with per-finding confidence (High/Medium/Low), recommendations,
   full source list.

All claims must be sourced. Label speculation explicitly.
```

The researcher agent is read-only (no Write tool), so the report comes back as the fork's final response rather than as a file — the main conversation can then save it to `.claude/runs/<run-id>/research.md` if you want the artifact.

`context: fork` is doing the heavy lifting here: the skill content becomes the prompt for an isolated subagent (the `researcher` agent, with its read-only tool restrictions), so a sprawling research session never pollutes your main context. You get back only the report. The supporting file `report-template.md` lives right next to `SKILL.md` — that's the point of skills being directories.

**Invocation**:

```
/deep-research What are the security implications of our current authentication approach?
```

## Skill File Best Practices

### Orchestration Logic

Skills own the coordination logic; agents own the work:

```markdown
## Steps

1. Create run directory
2. Invoke agent A via the Agent tool → validate its output artifact
3. If A succeeds, invoke agent B → validate output
4. If B succeeds, invoke agent C → validate output
5. Report results
```

Remember that subagents can't spawn subagents — a skill that orchestrates agents must run in the main conversation (no `context: fork`) for the Agent tool calls to work as a pipeline.

### Error Handling

Define failure modes explicitly:

```markdown
If the planner fails:
- Report the error to the user
- Preserve the partial plan in the run directory

If the executor fails:
- Run the verifier on partial changes
- Report which tasks succeeded/failed
- Ask the user: retry failed tasks? rollback? abort?
```

### User Interaction

Skills can pause for user input — write it as instructions:

```markdown
Present the plan to the user and wait for confirmation.

If the user approves: continue to the executor.
If the user rejects: stop cleanly.
If the user requests changes: re-invoke the planner with the feedback.
```

### Invocation Control

Decide who triggers each skill:

- **Side effects** (deploy, commit, agentic-run): `disable-model-invocation: true`. You pull the trigger.
- **Background knowledge** (architecture context, conventions): `user-invocable: false`. Claude loads it when relevant.
- **Both** (research, analysis): the default. You can `/invoke` it; Claude can too.

Permission rules also apply: `Skill(deploy)` / `Skill(deploy *)` in your settings `allow`/`deny` arrays control what Claude may invoke programmatically — see [Settings & Permissions](settings-and-permissions.md).

## How to Invoke Skills

### You: slash command

```
/agentic-run build feature X
/deep-research question Y
/migrate-component SearchBar React Vue
```

Everything after the name lands in `$ARGUMENTS`; indexed access uses shell-style quoting, so `/my-skill "hello world" second` gives `$0` = `hello world`.

### Claude: automatic + the Skill tool

Skill descriptions sit in Claude's context (the bodies don't), and Claude invokes relevant skills via the **Skill tool**. Control this in two places:

- Per skill: `disable-model-invocation: true` removes it from Claude's reach entirely
- Per project: permission rules in settings —

```json
{
  "permissions": {
    "allow": ["Skill(deep-research *)"],
    "deny": ["Skill(agentic-run *)"]
  }
}
```

### Subagents: preloaded skills

The inverse direction also exists: a subagent's `skills` frontmatter field injects full skill content into that agent's context at startup. Use it to give an executor your `api-conventions` skill as standing knowledge — see [Subagents](subagents.md).

### Composition

A skill can tell Claude to invoke another skill (`Now run /safe-refactor on the affected modules`). It works, but avoid deep nesting — it creates confusing execution traces, and invoked skill content stays in context for the rest of the session.

## Example: Safe Refactor Skill

`.claude/skills/safe-refactor/SKILL.md`:

```markdown
---
description: Refactor code with test and coverage comparison before and after, with automatic rollback
argument-hint: [refactor target]
disable-model-invocation: true
---

# Safe Refactor

Refactor with a safety net: $ARGUMENTS

Baseline check — current test status:
!`npm test 2>&1 | tail -5`

## Steps

1. Create a run directory; save the baseline test results and coverage to `baseline.json`
2. Invoke the planner subagent with "refactor $ARGUMENTS"
3. Invoke the executor subagent
4. Re-run tests → save results to `after.json`
5. Compare baseline vs after:
   - Tests: must pass
   - Coverage: must not decrease
6. If the comparison fails: `git checkout .` (rollback) and report failure
7. If it succeeds: report success and offer to commit

## Safety

- Automatic rollback on test failure
- Coverage regression protection
- Requires a clean working tree before starting — verify with git status first
```

## Tips

**Single responsibility**: Each skill should do one thing well. No mega-skills.

**Skills are lazy-loaded**: Only the `description` sits in context until the skill is invoked — so long reference material in a skill body is nearly free. This is why procedures belong in skills, not CLAUDE.md.

**Inject state, don't describe it**: Use `` !`command` `` to put real git diffs, test output, or PR data in front of Claude instead of hoping it runs the right command.

**Fork for isolation**: `context: fork` for anything noisy (research, log analysis). Keep orchestration skills inline.

**Idempotency**: Skills should be safe to re-run. Use run IDs to avoid collisions.

**Observability**: Always write artifacts to `.claude/runs/<run-id>/`. Makes debugging possible.

**User control**: `disable-model-invocation: true` plus explicit confirmation points for anything destructive.

Full reference: [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)
