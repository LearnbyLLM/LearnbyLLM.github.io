# Subagents

Subagents are how Claude Code delegates work. Each subagent runs in its own context window with a custom system prompt, defined tool access, and independent permissions, making them the core abstraction for multi-agent systems. Claude spawns them with the **Agent tool** (renamed from Task in v2.1.63 — `Task(...)` still works as an alias) and receives back only the subagent's final summary, keeping your main context clean.

## Agent Definition Files

Agent definitions live in `.claude/agents/<name>.md`. Each file is markdown with YAML frontmatter; the body becomes the subagent's system prompt.

```
.claude/agents/
├── planner.md
├── executor.md
├── verifier.md
└── researcher.md
```

When names collide, definitions resolve in priority order: managed settings, the `--agents` CLI flag (JSON, useful for one-off testing), project `.claude/agents/`, user `~/.claude/agents/`, then plugin `agents/` directories (namespaced as `my-plugin:agent-name`).

## Anatomy of an Agent File

Only `name` and `description` are required. The `description` matters more than you'd think: Claude uses it to decide when to auto-delegate.

| Field | Purpose |
|-------|---------|
| `name` | Unique identifier (lowercase, hyphens). Hooks see it as the agent type. |
| `description` | When Claude should delegate to this agent. Drives automatic delegation. |
| `tools` | Allowlist. Default: inherits all tools. Supports `Agent(worker, researcher)` to restrict which agents a `--agent` main session can spawn. |
| `disallowedTools` | Denylist, removed from the inherited or specified list. |
| `model` | `sonnet`, `opus`, `haiku`, `fable`, a full ID like `claude-opus-4-8`, or `inherit` (default). Route cheap grunt work to Haiku. |
| `permissionMode` | `default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, or `bypassPermissions`. |
| `maxTurns` | Hard cap on agentic turns. Cheap insurance against runaways. |
| `skills` | Skills whose full content is preloaded into context at startup. |
| `memory` | `user`, `project`, or `local` — persistent memory directory across sessions. |
| `background` | `true` to run concurrently with the main conversation. |
| `isolation` | `worktree` — run against an isolated git worktree copy of the repo. |
| `hooks` | Lifecycle hooks scoped to this subagent only (see [Hooks](hooks.md)). |

## Example: Research Agent

`.claude/agents/researcher.md`:

```markdown
---
name: researcher
description: Gathers information from the web and project files. Use for any research question. Read-only — never modifies files or runs commands.
tools: Read, Grep, Glob, WebSearch, WebFetch
model: haiku
maxTurns: 30
---

You are a research agent. Your role is to gather information from the web and project files to answer questions.

## Constraints

- NEVER access sensitive files (.env, .git/, .claude/)
- Read-only access only

## Output Format

Write your findings into your final response using this format:

# Research Findings

**Query**: [original question]
**Date**: [ISO-8601 timestamp]

## Summary
[2-3 sentence summary]

## Findings
1. [Finding with source]
2. [Finding with source]

## Sources
- [URL or file path]

## Confidence
[High/Medium/Low] - [reasoning]

## Success Criteria

- All claims are sourced
- No speculation without labeling it as such
- Clear distinction between project documentation and external sources
```

Note the layering: the `tools` allowlist means the agent *cannot* call Write, Edit, or Bash — that's enforced by Claude Code, not by the prompt. The prose constraints handle what tool restriction can't (which files to avoid reading).

## Example: Executor Agent

`.claude/agents/executor.md`:

```markdown
---
name: executor
description: Implements code changes from a plan artifact. Use after a plan exists in .claude/runs/<run-id>/plan.json.
tools: Read, Write, Edit, Bash, Grep, Glob
disallowedTools: WebSearch, WebFetch
permissionMode: acceptEdits
maxTurns: 50
---

You are an executor agent. Implement changes based on plans from the planner agent.

## Constraints

- ALWAYS read files before writing/editing
- NEVER modify: `.claude/`, `.env*`, `.git/`, lock files
- ONLY run safe bash commands (tests, builds, lints)
- NEVER run: `rm -rf`, `sudo`, `curl`, `wget`, network commands

## Input Format

Read your plan from `.claude/runs/<run-id>/plan.json` (the run id is given in your prompt):

{
  "tasks": [
    {"id": "task-1", "action": "create|modify|delete", "target": "path/to/file", "description": "what to do"}
  ]
}

## Output Format

Write results to `.claude/runs/<run-id>/changes.json`:

{
  "agent": "executor",
  "timestamp": "2026-06-11T10:30:00Z",
  "status": "success|failure",
  "changes": [
    {"task_id": "task-1", "file": "path/to/file", "action": "created|modified|deleted", "status": "success|failure", "error": "error message if failed"}
  ],
  "tests_run": true,
  "test_output": "..."
}

## Error Handling

If ANY task fails:
- Stop execution
- Write partial results to `changes.json` with `status: "failure"`
- Include error details in the failed task
```

The Bash command restrictions in the body are prompt-level only. Back them with deny rules in [settings](settings-and-permissions.md) and a PreToolUse [hook](hooks.md) — those are enforced regardless of what the model decides.

## How to Invoke Agents

There are four real invocation paths:

**Automatic delegation.** Claude reads each agent's `description` and delegates matching work via the Agent tool. This is the primary mechanism — invest in good descriptions.

**@-mention.** `@agent-researcher how does auth work in this codebase?` guarantees invocation of a specific agent.

**The Agent tool, explicitly.** Tell Claude "use the executor agent to implement the plan in .claude/runs/abc123/". The orchestrating session passes the prompt; the subagent returns a summarized result.

**Main-session mode.** `claude --agent researcher "How does authentication work here?"` runs an entire session with that agent's system prompt, tool restrictions, and model. Useful for scripting and CI.

There is no `--run-id` or `--context` flag. Pass run IDs and extra context in the prompt itself — agents read them from there.

One structural rule to design around: **subagents cannot spawn other subagents**. Orchestration lives in the main session (or a `--agent` main session, where `tools: Agent(worker, researcher)` restricts what it may spawn). Don't design pipelines that assume nested delegation.

## Foreground vs Background

Subagents can run in the foreground (blocking, permission prompts surface to you) or in the background (concurrent, permission prompts are auto-denied, results arrive as a message when done). Claude picks based on context; you can:

- Ask for it: "run this in the background"
- Press **Ctrl+B** to background a running task
- Set `background: true` in frontmatter for always-background agents
- Disable entirely with `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`

Background mode is what makes a verifier-running-in-parallel pattern practical. Just remember the auto-deny behavior: a background executor that needs a permission it doesn't have will fail, not wait.

## Persistent Memory

`memory: user|project|local` gives a subagent a memory directory that survives across sessions. The agent maintains a `MEMORY.md` index plus topic files, accumulating codebase patterns and recurring issues over time. A code-reviewer agent with `memory: project` gets meaningfully better after a few weeks of use.

## Worktree Isolation

`isolation: worktree` runs the subagent against a temporary git worktree — an isolated copy of the repo. Edits land in the worktree, not your checkout, and the worktree is cleaned up automatically if nothing changed. This is the right default for experimental or destructive work: let the executor go wild, then review the diff.

## Forks and Agent Teams

Two newer mechanisms worth knowing:

**Forked subagents** (`/fork`, or `CLAUDE_CODE_FORK_SUBAGENT=1`) inherit the parent's full conversation history and tool setup instead of starting fresh, run in the background, and reuse the parent's prompt cache — cheaper than a fresh subagent when the task needs your session's context. Forks cannot spawn further forks.

**Agent teams** (experimental, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) let multiple sessions communicate with each other via a SendMessage tool, rather than only reporting back to a parent. Powerful, but the artifact-based patterns below are still the more debuggable choice for production pipelines.

## Agent-to-Agent Communication

Subagents return a summary to their parent, but for durable multi-step pipelines, communicate through artifacts in `.claude/runs/<run-id>/`:

```
.claude/runs/abc123/
├── plan.json          # Planner writes
├── research.md        # Researcher writes
├── changes.json       # Executor writes
└── verification.json  # Verifier writes
```

### Example Flow

1. **Planner** reads requirements, writes `plan.json`:
```json
{
  "tasks": [
    {"id": "1", "action": "modify", "target": "src/auth.js", "description": "Add rate limiting"}
  ]
}
```

2. **Executor** reads `plan.json`, implements changes, writes `changes.json`:
```json
{
  "status": "success",
  "changes": [
    {"task_id": "1", "file": "src/auth.js", "action": "modified", "status": "success"}
  ]
}
```

3. **Verifier** reads `changes.json`, runs tests, writes `verification.json`:
```json
{
  "status": "success",
  "tests_passed": 42,
  "tests_failed": 0
}
```

Artifacts survive crashes, are diffable, and make every handoff auditable — which a transcript summary is not.

## Tips

**Principle of least privilege**: Use the `tools` allowlist, not prose. Research agents don't get Write. Executor agents don't get WebSearch.

**Descriptions are an API**: Auto-delegation is only as good as your `description` fields. Write them like routing rules, including when *not* to use the agent.

**Model routing saves money**: `model: haiku` for search and triage, `opus` or `fable` for planning and hard reasoning. Default is `inherit`.

**Cap turns**: Set `maxTurns` on every production agent. A stuck agent burning 200 turns is a real failure mode.

**Structured outputs**: JSON for machine-readable artifacts, markdown for human-readable reports.

**Idempotency**: Design agents to be re-runnable. If the executor fails halfway, re-running against the same `plan.json` should be safe. `isolation: worktree` makes this nearly free.

## Example: Verifier Agent

`.claude/agents/verifier.md`:

```markdown
---
name: verifier
description: Validates implementations by running tests, lints, and type checks. Read-only except test outputs.
tools: Read, Grep, Glob, Bash
model: sonnet
maxTurns: 20
---

Validate implementation quality.

## Input
`.claude/runs/<run-id>/changes.json` (run id provided in your prompt)

## Output
`.claude/runs/<run-id>/verification.json`:

{
  "status": "pass|fail",
  "tests": {"passed": 10, "failed": 0},
  "lint": {"errors": 0, "warnings": 2},
  "type_check": "pass",
  "issues": []
}

## Workflow
1. Read changes.json
2. Run: tests, lints, type checks
3. Write verification.json
4. State PASS or FAIL clearly in your final response
```

Full reference: [code.claude.com/docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents)
