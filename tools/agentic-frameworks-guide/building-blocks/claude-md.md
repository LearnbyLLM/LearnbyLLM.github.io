# CLAUDE.md

CLAUDE.md is the standing instruction file for your project. Claude loads it at the start of every session, making it the foundation for defining how agents behave in your multi-agent system. One thing to be clear-eyed about: CLAUDE.md is *context, not enforcement*. Claude follows it probabilistically. Anything that must hold unconditionally belongs in [hooks](hooks.md) or [permission rules](settings-and-permissions.md).

## Hierarchy

Claude loads CLAUDE.md files from several locations. They are **concatenated, not overridden** — broadest scope first, most specific last:

```
Managed policy CLAUDE.md (e.g. /etc/claude-code/CLAUDE.md on Linux)
  ↓ then
~/.claude/CLAUDE.md (user — all your projects)
  ↓ then
<project-root>/CLAUDE.md or <project-root>/.claude/CLAUDE.md (project, shared via git)
  ↓ then
<project-root>/CLAUDE.local.md (personal, gitignored)
```

Claude also walks *up* the directory tree (useful in monorepos — exclude irrelevant ancestor files with the `claudeMdExcludes` setting), and CLAUDE.md files in *subdirectories* load on demand when Claude reads files there.

For agentic frameworks, put agent behavior in the project file (`CLAUDE.md` or `.claude/CLAUDE.md`) so the whole team gets it, and keep personal preferences in `CLAUDE.local.md` or your user file.

Three related mechanisms worth knowing:

- **Imports**: `@docs/git-instructions.md` anywhere in CLAUDE.md inlines another file at launch (max 4 hops deep). Good for splitting a large file; it does not save context. If your repo standardizes on `AGENTS.md`, a one-line `@AGENTS.md` import keeps both tools in sync.
- **Path-scoped rules**: markdown files in `.claude/rules/` with `paths:` frontmatter (e.g. `paths: ["src/api/**/*.ts"]`) load only when Claude touches matching files. This is how you keep per-area agent rules out of every session's context.
- **Auto memory**: separately from CLAUDE.md, Claude now keeps its own notes per project in `~/.claude/projects/<project>/memory/` (on by default; toggle with `autoMemoryEnabled`). You write CLAUDE.md; Claude writes memory. Run `/memory` to see both, and `/init` to bootstrap a CLAUDE.md from your codebase.

## Using CLAUDE.md for Agentic Frameworks

A well-designed CLAUDE.md for multi-agent systems should define:

- **Trust boundaries**: What files, directories, and commands are off-limits
- **Agent role expectations**: How agents should collaborate and communicate
- **Artifact requirements**: Where agents write outputs for handoff
- **Scope restrictions**: What agents CANNOT do (more important than what they can do)

## Full Example: Agentic Project CLAUDE.md

```markdown
# Multi-Agent System Configuration

You are operating in a multi-agent environment. This project uses specialized agents with distinct roles and capabilities.

## Trust Boundaries

NEVER modify these paths:
- `.claude/` (configuration directory)
- `.env`, `.env.*` (secrets)
- `.git/` (version control)
- `node_modules/`, `venv/`, `__pycache__/` (dependencies)
- `package-lock.json`, `poetry.lock`, `Cargo.lock` (lock files)

READ-ONLY paths:
- `docs/` (documentation is maintained separately)
- `config/production.yml` (production config requires manual approval)

## Agent Roles

### Planner
- Reads project state and requirements
- Generates execution plans as JSON artifacts in `.claude/runs/<run-id>/plan.json`
- CANNOT execute code or modify files
- Output: structured plan with task breakdown

### Executor
- Reads plans from `.claude/runs/<run-id>/plan.json`
- Modifies code and runs tests
- CANNOT access network or read secrets
- Output: implementation artifacts in `.claude/runs/<run-id>/changes.json`

### Verifier
- Reads implementation artifacts
- Runs verification suite (tests, lints, type checks)
- CANNOT modify code (read-only except for test outputs)
- Output: validation report in `.claude/runs/<run-id>/verification.json`

### Researcher
- Searches web and reads documentation
- CANNOT modify files or execute code
- Output: research findings in `.claude/runs/<run-id>/research.md`

## Artifact Requirements

All inter-agent communication MUST use artifacts in `.claude/runs/<run-id>/`:

```
.claude/runs/<run-id>/
├── plan.json          # Planner output
├── changes.json       # Executor output
├── verification.json  # Verifier output
└── research.md        # Researcher output
```

Artifact format:
```json
{
  "agent": "planner|executor|verifier|researcher",
  "timestamp": "ISO-8601",
  "status": "success|failure|pending",
  "data": { ... }
}
```

## Scope Restrictions

Agents MUST NOT:
- Run destructive commands (`rm -rf`, `sudo`, `dd`, `mkfs`)
- Access network in Executor role (use Researcher instead)
- Modify configuration files without explicit approval
- Execute code from untrusted sources
- Bypass sandbox or hook protections

Agents MUST:
- Write all outputs to `.claude/runs/<run-id>/`
- Use Read tool before Write tool for existing files
- Validate inputs before processing
- Report errors in structured format

## Run Workflow

1. Planner analyzes task and writes `plan.json`
2. Executor reads plan, implements changes, writes `changes.json`
3. Verifier reads changes, runs tests, writes `verification.json`
4. If verification fails, loop back to Executor with feedback
5. If verification passes, mark run as complete

## Emergency Stop

If any agent:
- Attempts to access forbidden paths
- Receives errors from hooks
- Detects security risks

Stop immediately and report to user.
```

## Tips

**Keep it under ~200 lines**: Claude's context is precious, and the official guidance now targets under 200 lines per file — long files measurably reduce adherence. Move procedures into [skills](skills.md) (which load on demand) and area-specific rules into `.claude/rules/` with `paths` frontmatter.

**Be explicit about what agents CANNOT do**: Constraints are more important than capabilities. Define the boundaries clearly — then back the critical ones with hooks and deny rules, because CLAUDE.md alone is advisory.

**Use structured formats**: JSON, YAML, or markdown tables for agent outputs. Unstructured text leads to parsing errors.

**Test incrementally**: Start with one agent, verify CLAUDE.md behavior, then add more agents.

**Version control it**: Track changes to CLAUDE.md like code. Bad prompts break systems.

**Avoid prompt injection**: Don't dynamically generate CLAUDE.md content from user inputs.

## Common Pitfalls

**Too vague**: "Be careful with files" → Agents ignore this. Use explicit paths ("Run `npm test` before committing", not "test your changes").

**Too verbose**: 1000-line CLAUDE.md files dilute important rules. Prioritize ruthlessly; offload to skills and rules.

**Conflicting rules**: "Never modify config/" vs "Update config/agents.yml" → Claude picks one arbitrarily. Audit your CLAUDE.md, nested files, and `.claude/rules/` together for contradictions.

**Mistaking it for enforcement**: A "NEVER run rm -rf" line is a suggestion. A PreToolUse hook is a guarantee. Use both.

**No artifacts**: Agents that don't write structured outputs make orchestration impossible.

## Example: Minimal CLAUDE.md

```markdown
# Agentic Framework

Trust boundaries:
- NEVER: `.claude/`, `.env*`, `.git/`
- READ-ONLY: `docs/`, `config/production.yml`

Artifacts: `.claude/runs/<run-id>/`

Agents:
- Planner: Read + plan.json output
- Executor: Read + Write + Bash (no network)
- Verifier: Read + Bash (tests only)
- Researcher: Read + WebSearch + research.md output

Stop on errors. Report to user.
```

This 10-line version works for simple projects. Expand as complexity grows.

Full reference: [code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory)
