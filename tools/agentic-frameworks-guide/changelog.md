# Changelog

Updates to this guide. Claude Code's agent features evolve — this tracks when the guide was revised.

---

## June 2026

**Major Revision — brought current with Claude Code as of June 2026**

Claude Code changed substantially between this guide's initial release and mid-2026. This revision updates every page. Highlights:

- **Corrected agent invocation.** Early versions of this guide showed CLI flags that never shipped (e.g. `claude --agent planner --input plan.yaml`). All examples now use the real mechanisms: automatic delegation via the `description` field, `@agent-name` mentions, the Agent tool, and `claude --agent <name>` to run a session as an agent.
- **Task tool → Agent tool.** The tool subagents are spawned with was renamed; `Task(...)` permission rules still work as an alias, but examples now use `Agent(...)`.
- **Skills overhaul.** Skills are now directories (`.claude/skills/<name>/SKILL.md`) with rich frontmatter — `context: fork`, `allowed-tools`, dynamic `` !`command` `` context injection, `$ARGUMENTS` substitution. The old `.claude/commands/` slash commands still work but are deprecated into the skills system.
- **Hooks expanded from ~10 to 30+ events** — including `SubagentStart`/`SubagentStop`, `PostToolUseFailure`, `PreCompact`/`PostCompact`, and `FileChanged` — plus new handler types (`command`, `http`, `mcp_tool`, `prompt`, `agent`). Hook templates updated to the current JSON contract (`permissionDecision`, `additionalContext`).
- **New subagent capabilities** woven into the architecture chapters: background execution (`background: true`), persistent memory (`memory: user|project|local`), git worktree isolation (`isolation: worktree`), per-agent `permissionMode` and `maxTurns`, and experimental agent teams.
- **Native sandboxing.** Claude Code now ships OS-level filesystem and network isolation for Bash (`sandbox` settings) — the security chapters now build on it instead of ad-hoc approaches.
- **Permission system update.** Six permission modes, fine-grained rule syntax (`Bash(npm run *)`, `Read(//**/.env)`, `Agent(name)`, `Skill(name)`), and managed (org-wide) settings.
- **Models refreshed.** Examples now use the current lineup — Opus 4.8 (default), Sonnet 4.6, Haiku 4.5, and the new Fable 5 — via frontmatter aliases, with current pricing in the cost chapter.
- **SDK rename.** "Claude Code SDK" is now the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk` / `claude-agent-sdk` on PyPI); docs moved to code.claude.com.
- **Fixed broken links** throughout.

---

## February 2025

**Initial Release**
- Complete guide to multi-agent systems in Claude Code
- Reference implementation: four-agent system (Planner, Executor, Verifier, Researcher)
- Building blocks: subagents, skills, hooks, CLAUDE.md configuration
- Architecture patterns for task decomposition and delegation
- Security model and permission boundaries
- Production patterns for testing and monitoring
- Ready-to-use agent templates

**What's Covered:**
- Agent primitives and when to use them
- Role-based agent design (vs general-purpose agents)
- Sandboxing and permission isolation
- Error handling and verification workflows
- Cost analysis and performance trade-offs
- Complete code examples for `.claude/agents/`, `.claude/skills/`, `.claude/hooks/`

---

## Planned Updates

- Additional architecture patterns as use cases emerge
- Performance optimization techniques
- Integration examples with external tools
- Advanced verification strategies
- User-contributed agent configurations
- Updates when Claude Code agent features change

---

## Contributing

Found an issue or have an agent pattern to share?

This guide is open for contributions. Submit issues or pull requests on the GitHub repo.

**What we're looking for:**
- Real production agent configurations
- Security issues or boundary violations
- Performance optimization examples
- Clarifications or corrections

**What we're not looking for:**
- Theoretical frameworks without working code
- External dependencies or non-Claude-Code solutions
- Configurations that violate security boundaries

---

## Claude Code Feature Updates

This section tracks major Claude Code changes affecting agent features:

| Date | Claude Code Change | Guide Impact |
|------|-------------------|--------------|
| Feb 2025 | — | Guide created based on stable agent features |
| 2025 | Task tool renamed to Agent tool | Permission rules and examples updated; `Task(...)` still works as an alias |
| 2025 | Slash commands deprecated into skills (`SKILL.md`) | Skills chapter rewritten for the current format |
| 2025 | Claude Agent SDK rename (was Claude Code SDK) | References and package names updated |
| 2025–26 | Hooks expanded to 30+ events, new handler types | Hooks chapter and templates rewritten |
| 2025–26 | Native sandboxing, permission modes, managed settings | Security and settings chapters updated |
| 2025–26 | Background subagents, persistent memory, worktree isolation, agent teams (experimental) | Architecture and reference implementation updated |
| Jun 2026 | Claude Fable 5 released; Opus 4.8 default in Claude Code | Model references and pricing updated |

---

## Breaking Changes

**June 2026 revision:** if you copied configurations from the February 2025 version of this guide, note:

- Agent definitions **must** have YAML frontmatter (`name`, `description`); plain markdown files in `.claude/agents/` without frontmatter were never valid.
- `claude --agent <name> --input <file>` does not exist. Use in-session delegation, `@agent-name` mentions, or `claude --agent <name> "<prompt>"`.
- Prefer `Agent(...)` over `Task(...)` in permission rules (the alias still works).
- New skills should use `.claude/skills/<name>/SKILL.md`, not `.claude/commands/`.

---

## Feedback

This guide was built from production experience, but multi-agent patterns are still emerging. If you're using these techniques in production:

- What worked?
- What failed?
- What's missing from this guide?

Open an issue or submit a pull request. All feedback improves the guide.
