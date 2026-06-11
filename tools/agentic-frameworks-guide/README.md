# Agentic Frameworks in Claude Code

<span class="last-updated">Last updated: June 2026</span>

A practical guide to building multi-agent systems using Claude Code's native features — no external frameworks needed.

---

## What You'll Learn

Claude Code has built-in primitives for multi-agent architectures: subagents, skills, hooks, and CLAUDE.md configuration. This guide shows you how to combine them into production-ready agentic systems.

This guide covers:

- **Getting Started** — Understand Claude Code's agent primitives and when to use them
- **Building Blocks** — Subagents, skills, hooks, and CLAUDE.md configuration
- **Architecture Patterns** — Decomposition strategies, delegation patterns, and error handling
- **Reference Implementation** — Four-agent system (Planner, Executor, Verifier, Researcher) with full code
- **Security** — Sandboxing, permission boundaries, and preventing agent escalation
- **Production Patterns** — Testing, monitoring, cost control, and debugging multi-agent flows
- **Templates** — Copy-paste agent configurations and skill implementations

---

## The Bottom Line

**This approach is great for:**
- Task decomposition and parallel execution
- Separating read-only research from write operations
- Building auditable workflows with verification steps
- Teams already using Claude Code who want agent capabilities

**This approach is NOT for:**
- Simple single-step tasks (just use base Claude Code)
- Complex state machines requiring external orchestration
- Workloads that are mostly API calls (use the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) directly)

Two limitations from earlier versions of this guide no longer apply: subagents can now run **in the background concurrently**, and they can keep **persistent memory across sessions** (`memory: project` in frontmatter). Direct agent-to-agent messaging ("agent teams") exists but is still experimental.

> If you take one thing from this guide: **agent boundaries enforce safety and clarity.** The right agent architecture makes dangerous operations impossible, not just unlikely.

---

## Quick Links

| I want to... | Go here |
|-------------|---------|
| Understand the basics | [What Are Agentic Frameworks?](getting-started/what-are-agentic-frameworks.md) |
| See the four-agent system | [Reference Implementation](reference-implementation/overview.md) |
| Secure my agents | [Trust Boundaries](security/trust-boundaries.md) |
| Copy a working setup | [Copy-Paste Agents](templates/copy-paste-agents.md) |

---

## About This Guide

Built from production experience with Claude Code's agent features. This guide shows working implementations, not theoretical patterns. All code examples are tested and can be dropped directly into `.claude/` directories.

The reference implementation demonstrates a real pattern: decompose tasks (Planner), execute safely (Executor), verify results (Verifier), and gather context (Researcher). Each agent has clear boundaries and specific permissions.

**What's different about this approach?**

Most agentic frameworks add complexity: new CLIs, configuration languages, orchestration layers. Claude Code's primitives are just files in `.claude/` that work with features you already use. No dependencies. No runtime. Just configuration.

**Who should use this?**

- Engineers building complex automation with Claude Code
- Teams wanting parallel task execution without external tools
- Anyone needing verifiable, auditable agent workflows
- Security-conscious teams requiring strict agent boundaries

**Who should skip this?**

- If your tasks are sequential and simple, you don't need agents
- If you need transactional state or queryable history, use a database — subagent `memory` is for accumulated knowledge, not application state
- If you're not already using Claude Code, start there first

---

## Architecture Philosophy

This guide advocates for **role-based agents with clear permissions**, not general-purpose agents with full system access. Each agent does one thing:

- **Planner**: Reads task, outputs decomposed plan (no execution)
- **Executor**: Receives plan steps, implements them (no planning)
- **Verifier**: Audits completed work, reports issues (no fixes)
- **Researcher**: Gathers context, never writes (read-only)

Why this matters: agent failures are local. A Planner hallucination can't corrupt your codebase. A Verifier bug can't deploy code. An Executor mistake gets caught by Verifier.

Compare to a single "do everything" agent: one mistake propagates everywhere.

---

## Cost and Performance

**Token costs**: Multi-agent systems use more tokens than single-agent flows. The reference implementation typically uses 2-3x tokens versus direct execution. This is a feature, not a bug — you're buying verification and safety.

**Latency**: The pipeline itself is sequential (Planner → Executor → Verifier), but independent work no longer has to wait: subagents can run in the background while the main session continues, and read-only research can fan out in parallel. For a strictly sequential run, expect 3-5x the latency of single-agent execution (see Architecture Patterns for parallelization).

**When it's worth it**: Complex tasks with high failure cost. Code generation that needs testing. Research requiring source verification. Financial operations needing audit trails.

**When it's not**: Simple CRUD operations. File renaming. Documentation updates. Anything where "just do it" is cheaper than "plan, do, verify."

---

## Prerequisites

- Claude Code installed and configured
- Basic understanding of Claude Code skills and hooks
- Familiarity with `.claude/` directory structure
- Understanding of file-based configuration (CLAUDE.md)

No external dependencies required. Everything runs with standard Claude Code.

---

## Guide Structure

1. **Getting Started**: Core concepts and when to use agents
2. **Building Blocks**: Deep dive on subagents, skills, hooks, CLAUDE.md
3. **Architecture Patterns**: How to structure multi-agent systems
4. **Reference Implementation**: Complete four-agent system with code
5. **Security**: Permission models and sandboxing strategies
6. **Production Patterns**: Testing, monitoring, debugging
7. **Templates**: Ready-to-use agent configurations

Each section builds on previous ones. Read sequentially or jump to Templates if you want working code immediately.

---

## Version and Compatibility

This guide is current as of **June 2026**. Agent primitives are stable features, but configuration syntax evolves — check the [changelog](changelog.md) for what changed in each revision, and the [official docs](https://code.claude.com/docs/en/sub-agents) for the latest syntax.

Code examples are written against:
- Claude Code 2.x (the `claude` CLI)
- Current models: Claude Opus 4.8 (default), Sonnet 4.6, Haiku 4.5, and Fable 5 — referenced by the `opus` / `sonnet` / `haiku` / `fable` aliases in agent frontmatter
- macOS and Linux (Windows is supported by Claude Code; examples use POSIX shell)

---

[Get Started →](getting-started/what-are-agentic-frameworks.md)
