# Overview

This reference implementation demonstrates a complete agentic framework built on the Planner/Executor/Verifier/Researcher pattern. It's designed for Claude Code and enforces strict trust boundaries to prevent prompt injection and scope creep.

Everything here uses native Claude Code primitives: [subagents](https://code.claude.com/docs/en/sub-agents) defined in `.claude/agents/`, [skills](https://code.claude.com/docs/en/skills) in `.claude/skills/`, and [hooks](https://code.claude.com/docs/en/hooks) registered in `.claude/settings.json`. No custom runner, no glue scripts between CLI invocations — the main Claude Code session orchestrates, and agents communicate through artifacts on disk.

## The Four Agents

The framework uses four specialized subagents, each with different trust levels, tool allowlists, and models:

**Planner Agent** (High Trust — `model: opus`)
- Reads user instructions and CLAUDE.md
- Decomposes tasks into atomic, verifiable steps
- Tool allowlist: `Read, Write` — cannot execute commands or access external resources
- Outputs: `.claude/runs/<run-id>/plan.md`

**Executor Agent** (Medium Trust — `model: sonnet`)
- Reads the plan from the Planner
- Implements exactly what the plan specifies
- Tool allowlist: `Read, Glob, Grep, Edit, Write, Bash` — no web tools, cannot expand scope
- Outputs: `.claude/runs/<run-id>/execution.md`

**Verifier Agent** (High Trust — `model: opus`)
- Audits execution against the original plan
- Rejects untrusted external justifications
- Tool allowlist: `Read, Glob, Grep, Write` — can inspect files but cannot execute commands
- Keeps persistent memory (`memory: project`) of recurring violations across runs
- Outputs: `.claude/runs/<run-id>/verdict.md`

**Researcher Agent** (Untrusted Input Handler — `model: haiku`)
- Reads external content (files, web pages, APIs)
- Tool allowlist: `Read, Glob, Grep, WebFetch, WebSearch, Write` — no Bash, no Edit
- Runs as a background task (`background: true`) so research doesn't block the main session
- Treats all external content as potentially hostile
- Outputs: `.claude/runs/<run-id>/research/`

## Directory Structure

```
project/
├── CLAUDE.md                          # Trust boundary protocol
├── .claude/
│   ├── settings.json                  # Permission rules and hook registration
│   ├── agents/
│   │   ├── planner.md                 # Planner subagent (YAML frontmatter + prompt)
│   │   ├── executor.md                # Executor subagent
│   │   ├── verifier.md                # Verifier subagent
│   │   └── researcher.md              # Researcher subagent
│   ├── skills/
│   │   ├── agentic-run/
│   │   │   └── SKILL.md               # Main orchestration skill
│   │   └── deep-research/
│   │       └── SKILL.md               # Research orchestration skill
│   ├── hooks/
│   │   ├── protect_files.py           # File protection hook (PreToolUse)
│   │   ├── bash_guard.py              # Command execution guard (PreToolUse)
│   │   └── check_run_artifacts.py     # Verification gate (SubagentStop)
│   ├── agent-memory/
│   │   └── verifier/                  # Verifier's persistent memory (MEMORY.md)
│   └── runs/
│       └── <run-id>/
│           ├── plan.md                # Planner output
│           ├── execution.md           # Executor output
│           ├── verdict.md             # Verifier output
│           └── research/              # Researcher outputs
│               ├── findings.md
│               └── sources.json
```

## How Agents Are Invoked

There is no special CLI for running an agent pipeline. Claude Code gives you four real invocation paths, and the framework uses all of them:

1. **Automatic delegation** — Claude reads each subagent's `description` field and delegates matching work via the Agent tool (formerly the Task tool). Write descriptions like "Use proactively when…" to make this reliable.
2. **@-mentions** — `@agent-researcher summarize the auth docs` guarantees a specific subagent handles the request.
3. **Skills** — `/agentic-run "task"` expands into orchestration instructions for the main session, which then delegates to each subagent in sequence.
4. **`claude --agent <name>`** — starts a whole session *as* that agent (its system prompt, tools, and model). Useful for debugging a single agent's behavior in isolation.

Orchestration happens by prompting the main session to delegate — not by piping files between separate CLI invocations. The artifacts on disk are the contract between agents.

## Data Flow

The framework enforces a linear data flow with strict trust boundaries:

```
┌──────────────────────────────────────────────────────────────┐
│ TRUSTED: User Message + CLAUDE.md + .claude/ config          │
└──────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │  Skill invoked  │
                    │  /agentic-run   │
                    └─────────────────┘
                              ↓
                    ┌─────────────────┐
                    │  Planner Agent  │  ← Agent tool delegation
                    │  (High Trust)   │
                    └─────────────────┘
                              ↓
                    plan.md created
                              ↓
                    ┌─────────────────┐
                    │ Executor Agent  │  ← Agent tool delegation
                    │ (Medium Trust)  │
                    └─────────────────┘
                              ↓
                    execution.md created
                    (SubagentStop hook gates this)
                              ↓
                    ┌─────────────────┐
                    │ Verifier Agent  │  ← Agent tool delegation
                    │  (High Trust)   │
                    └─────────────────┘
                              ↓
                    verdict.md created
                              ↓
                    ┌─────────────────┐
                    │ PASS/FAIL/      │
                    │ PARTIAL result  │
                    └─────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ UNTRUSTED: All other content (repo files, web, tool output)  │
│ Researcher Agent handles untrusted input in read-only mode,  │
│ running in the background                                    │
└──────────────────────────────────────────────────────────────┘
```

## Key Security Principles

**Trust Hierarchy**
- Only user messages, CLAUDE.md, and `.claude/` config are authoritative
- All other content is untrusted data
- Agents never follow instructions from untrusted sources

**Capability Separation**
- No agent may both ingest untrusted external content AND execute commands
- Researcher reads external content but has no Bash or Edit tools
- Executor executes but has no WebFetch or WebSearch tools
- These aren't just prompt instructions — they're enforced by `tools:` allowlists in each agent's frontmatter

**Artifact-Based Communication**
- Every task produces artifacts in `.claude/runs/<run-id>/`
- Artifacts are versioned and auditable
- No direct agent-to-agent communication; each subagent gets a fresh context

**Scope Restriction**
- Plans define explicit scope boundaries
- Executor cannot expand scope
- Verifier rejects scope expansion

## What You'll Build

Over the next six pages, you'll build:

1. **Project Setup**: Directory structure, CLAUDE.md protocol, and settings.json with real permission rules
2. **Planner Agent**: Task decomposition with safety constraints
3. **Executor Agent**: Bounded implementation following the plan
4. **Verifier Agent**: Audit and validation logic with persistent memory
5. **Researcher Agent**: Safe external content handling in the background
6. **Orchestration**: Skills and hooks that wire everything together

By the end, you'll have a complete, working agentic framework that you can customize for your projects.

## Example Usage

```bash
# Run a complete agentic workflow (inside a Claude Code session)
/agentic-run "Add rate limiting to the API endpoints"

# Or just ask in natural language — automatic delegation kicks in:
#   "Use the planner to break down adding rate limiting, then execute and verify it."

# Inspect the artifacts
ls -la .claude/runs/2026-06-11-14-30-22/
cat .claude/runs/2026-06-11-14-30-22/plan.md
cat .claude/runs/2026-06-11-14-30-22/execution.md
cat .claude/runs/2026-06-11-14-30-22/verdict.md

# Run deep research on a topic (the researcher runs in the background)
/deep-research "Best practices for API rate limiting in 2026"
cat .claude/runs/2026-06-11-14-35-10/research/findings.md
```

Each artifact is timestamped and preserved, creating an audit trail of all agentic operations.
