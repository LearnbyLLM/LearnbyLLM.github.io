# CLAUDE.md

CLAUDE.md is the system prompt for your project. Claude reads it before every interaction, making it the foundation for defining how agents behave in your multi-agent system.

## Hierarchy

Claude resolves CLAUDE.md files in a cascading hierarchy:

```
~/.claude/CLAUDE.md (global)
  ↓ overrides
<project-root>/CLAUDE.md
  ↓ overrides
<project-root>/.claude/CLAUDE.md (local)
```

**Global**: Applies to all Claude sessions on your machine.
**Project**: Applies to a specific project directory.
**Local**: Applies to the `.claude/` configuration (highest priority).

For agentic frameworks, use the local `.claude/CLAUDE.md` to isolate agent behavior from your personal preferences.

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

**Keep it under 500 lines**: Claude's context is precious. Be concise.

**Be explicit about what agents CANNOT do**: Constraints are more important than capabilities. Define the boundaries clearly.

**Use structured formats**: JSON, YAML, or markdown tables for agent outputs. Unstructured text leads to parsing errors.

**Test incrementally**: Start with one agent, verify CLAUDE.md behavior, then add more agents.

**Version control it**: Track changes to CLAUDE.md like code. Bad prompts break systems.

**Avoid prompt injection**: Don't dynamically generate CLAUDE.md content from user inputs.

## Common Pitfalls

**Too vague**: "Be careful with files" → Agents ignore this. Use explicit paths.

**Too verbose**: 1000-line CLAUDE.md files dilute important rules. Prioritize ruthlessly.

**Conflicting rules**: "Never modify config/" vs "Update config/agents.yml" → Agents get confused.

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
