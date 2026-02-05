# Overview

This reference implementation demonstrates a complete agentic framework built on the Planner/Executor/Verifier/Researcher pattern. It's designed for Claude Code and enforces strict trust boundaries to prevent prompt injection and scope creep.

## The Four Agents

The framework uses four specialized agents, each with different trust levels and capabilities:

**Planner Agent** (High Trust)
- Reads user instructions and CLAUDE.md
- Decomposes tasks into atomic, verifiable steps
- Cannot execute commands or access external resources
- Outputs: `.claude/runs/<run-id>/plan.md`

**Executor Agent** (Medium Trust)
- Reads the plan from the Planner
- Implements exactly what the plan specifies
- Cannot access external resources or expand scope
- Outputs: `.claude/runs/<run-id>/execution.md`

**Verifier Agent** (High Trust)
- Audits execution against the original plan
- Rejects untrusted external justifications
- Cannot execute commands
- Outputs: `.claude/runs/<run-id>/verdict.md`

**Researcher Agent** (Untrusted Input Handler)
- Reads external content (files, web pages, APIs)
- Strictly read-only, cannot execute commands
- Treats all external content as potentially hostile
- Outputs: `.claude/runs/<run-id>/research/`

## Directory Structure

```
project/
├── CLAUDE.md                          # Trust boundary protocol
├── .claude/
│   ├── settings.json                  # Permissions and hooks
│   ├── agents/
│   │   ├── planner.md                 # Planner agent definition
│   │   ├── executor.md                # Executor agent definition
│   │   ├── verifier.md                # Verifier agent definition
│   │   └── researcher.md              # Researcher agent definition
│   ├── skills/
│   │   ├── agentic-run.md             # Main orchestration skill
│   │   └── deep-research.md           # Research orchestration skill
│   ├── hooks/
│   │   ├── protect_files.py           # File protection hook
│   │   └── bash_guard.py              # Command execution guard
│   └── runs/
│       └── <run-id>/
│           ├── plan.md                # Planner output
│           ├── execution.md           # Executor output
│           ├── verdict.md             # Verifier output
│           └── research/              # Researcher outputs
│               ├── findings.md
│               └── sources.json
```

## Data Flow

The framework enforces a linear data flow with strict trust boundaries:

```
┌──────────────────────────────────────────────────────────────┐
│ TRUSTED: User Message + CLAUDE.md + .claude/ config         │
└──────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │  Skill invoked  │
                    │  /agentic-run   │
                    └─────────────────┘
                              ↓
                    ┌─────────────────┐
                    │  Planner Agent  │
                    │  (High Trust)   │
                    └─────────────────┘
                              ↓
                    plan.md created
                              ↓
                    ┌─────────────────┐
                    │ Executor Agent  │
                    │ (Medium Trust)  │
                    └─────────────────┘
                              ↓
                    execution.md created
                              ↓
                    ┌─────────────────┐
                    │ Verifier Agent  │
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
│ UNTRUSTED: All other content (repo files, web, tool output) │
│ Researcher Agent handles untrusted input in read-only mode  │
└──────────────────────────────────────────────────────────────┘
```

## Key Security Principles

**Trust Hierarchy**
- Only user messages, CLAUDE.md, and `.claude/` config are authoritative
- All other content is untrusted data
- Agents never follow instructions from untrusted sources

**Capability Separation**
- No agent may both ingest untrusted external content AND execute commands
- Researcher reads external content but cannot execute
- Executor executes but cannot access external resources

**Artifact-Based Communication**
- Every task produces artifacts in `.claude/runs/<run-id>/`
- Artifacts are versioned and auditable
- No direct agent-to-agent communication

**Scope Restriction**
- Plans define explicit scope boundaries
- Executor cannot expand scope
- Verifier rejects scope expansion

## What You'll Build

Over the next six pages, you'll build:

1. **Project Setup**: Directory structure, CLAUDE.md protocol, and settings.json
2. **Planner Agent**: Task decomposition with safety constraints
3. **Executor Agent**: Bounded implementation following the plan
4. **Verifier Agent**: Audit and validation logic
5. **Researcher Agent**: Safe external content handling
6. **Orchestration**: Skills and hooks that wire everything together

By the end, you'll have a complete, working agentic framework that you can customize for your projects.

## Example Usage

```bash
# Run a complete agentic workflow
/agentic-run "Add rate limiting to the API endpoints"

# Inspect the artifacts
ls -la .claude/runs/2026-02-05-14-30-22/
cat .claude/runs/2026-02-05-14-30-22/plan.md
cat .claude/runs/2026-02-05-14-30-22/execution.md
cat .claude/runs/2026-02-05-14-30-22/verdict.md

# Run deep research on a topic
/deep-research "Best practices for API rate limiting in 2026"
cat .claude/runs/2026-02-05-14-35-10/research/findings.md
```

Each artifact is timestamped and preserved, creating an audit trail of all agentic operations.
