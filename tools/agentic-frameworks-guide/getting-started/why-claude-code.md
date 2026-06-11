# Why Claude Code?

Claude Code provides five native primitives for building agentic systems without external frameworks. The agent runtime IS the development environment, eliminating the complexity of integrating AI with tooling.

## The Five Primitives

### 1. CLAUDE.md (System Instructions)

Your framework's constitution. Defines global rules, trust boundaries, and agent protocols.

```markdown
# CLAUDE.md
You are part of a multi-agent system. Follow these rules:

1. **Trust Boundary**: Only execute tasks assigned to your role
2. **Artifact Protocol**: All outputs must be valid YAML
3. **Verification**: Never skip the Verifier agent before merging
```

Claude Code loads this file automatically in every session. It's the source of truth for agent behavior.

### 2. Subagents (Task Delegation)

Subagents are markdown files with YAML frontmatter in `.claude/agents/`. Each one runs in its own context window with its own tool allowlist, model, and permission mode.

```markdown
# .claude/agents/planner.md
---
name: planner
description: Breaks user requirements into atomic, verifiable tasks. Use for any non-trivial feature request.
tools: Read, Grep, Glob
model: opus
permissionMode: plan
---

You are the Planner agent. Your role:
- Read user requirements
- Break into atomic tasks
- Output plan.yaml with task dependencies
- NEVER write code directly
```

There are several ways to invoke a subagent:

```bash
# Run a whole session as the agent
claude --agent planner "Design login system"

# Inside a session: guarantee delegation with an @-mention
@agent-planner design the login system

# Or just describe the work — Claude auto-delegates based on the
# description field, spawning the subagent via its Agent tool
"Plan out the login system before touching any code"
```

Subagents inherit project context from `CLAUDE.md`, but their frontmatter controls what they can do: `tools` restricts the toolset, `model` picks an alias (`opus`, `sonnet`, `haiku`, `fable`), `maxTurns` caps the loop. The parent only sees the subagent's final summary — context stays clean.

### 3. Skills (Reusable Workflows)

Skills encapsulate multi-step procedures as a directory with a `SKILL.md` file (the successor to the old `.claude/commands/` files, which still work as aliases).

```markdown
# .claude/skills/implement-feature/SKILL.md
---
name: implement-feature
description: Full feature implementation pipeline — plan, execute, verify
---

Implement the feature described in: $ARGUMENTS

1. Delegate planning to the planner subagent; save the plan as an artifact
2. Delegate implementation to the executor subagent with the plan as input
3. Delegate verification to the verifier subagent
4. Report the verdict. If FAIL, stop and surface the reasons.
```

Skills are invoked with `/implement-feature login`, or automatically by Claude (via its `Skill` tool) when the description matches. They support `$ARGUMENTS`, dynamic context injection (`` !`git diff` `` runs before Claude sees the skill), supporting files, and `context: fork` for isolated execution.

### 4. Hooks (Lifecycle Enforcement)

Hooks intercept the agent lifecycle with deterministic code — the model can't talk its way past them. They're configured in settings files, not invented APIs:

```json
// .claude/settings.json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": ".claude/hooks/write-guard.sh" }]
      }
    ]
  }
}
```

A command hook receives JSON on stdin (`session_id`, `tool_name`, `tool_input`, `permission_mode`, ...) and can block the call — by exiting `2`, or by returning a JSON `permissionDecision` of `deny`, `allow`, or `ask`.

**Key hook events** (there are 30+): `PreToolUse` / `PostToolUse` / `PostToolUseFailure` around every tool call; `PermissionRequest` / `PermissionDenied` around the permission system; `SubagentStart` / `SubagentStop` around subagent invocations (matcher = agent name); `UserPromptSubmit`, `Stop`, `SessionStart`, `SessionEnd` for turn and session lifecycle. Besides `command`, hooks can be `prompt` (a fast model judges a decision), `agent`, `http`, or `mcp_tool`.

### 5. Settings/Permissions (Sandbox Boundaries)

Control what agents can access via `.claude/settings.json` permission rules:

```json
{
  "permissions": {
    "allow": ["Bash(npm test)", "Edit(src/**)", "Edit(tests/**)"],
    "deny": ["Read(//**/.env)", "Bash(curl *)", "WebFetch"],
    "ask": ["Bash(git push *)"]
  },
  "sandbox": {
    "enabled": true,
    "network": { "allowedDomains": ["registry.npmjs.org", "github.com"] }
  }
}
```

Rules are fine-grained per tool: `Bash(npm run *)` glob-matches commands, `Read(//**/.env)` matches file paths, `WebFetch(domain:example.com)` scopes by domain, `Agent(planner)` and `Skill(deploy)` gate delegation itself. The `sandbox` block applies **OS-level** filesystem and network isolation to Bash and its child processes — not prompt-level, kernel-level. Per-agent restrictions live in each subagent's frontmatter (`tools`, `permissionMode`).

Claude Code enforces these at runtime. An agent attempting unauthorized operations fails immediately.

## Comparison with Alternatives

| Feature | Claude Code | LangChain/LangGraph | CrewAI | AutoGen |
|---------|-------------|---------------------|---------|---------|
| **Setup Complexity** | Edit markdown files | Write Python boilerplate | Install external framework | Configure agents in code |
| **Agent Definition** | `.claude/agents/*.md` | Python classes | YAML + Python | Python classes |
| **Tool Integration** | Native (Bash, Read, Write) | Manual wrapper functions | Manual integrations | Manual integrations |
| **Permissions** | Fine-grained rules + OS sandbox | Manual enforcement | Not built-in | Not built-in |
| **Lifecycle Hooks** | 30+ events in settings.json | Custom middleware | Limited | Limited |
| **Development Experience** | AI runtime = IDE | AI separate from IDE | AI separate from IDE | AI separate from IDE |

### Why Claude Code is Simpler

**LangChain/LangGraph:**
```python
# Heavy abstraction
from langchain.agents import Agent, Tool
from langgraph.graph import StateGraph

class PlannerAgent(Agent):
    def __init__(self):
        self.tools = [ReadTool(), AnalyzeTool()]

    def run(self, input):
        # 50 lines of orchestration logic
```

**Claude Code:**
```markdown
# .claude/agents/planner.md
---
name: planner
description: Creates execution plans from requirements
---
You are the Planner. Analyze input and output plan.yaml.
```

**CrewAI:**
```python
# External framework
from crewai import Agent, Task, Crew

planner = Agent(
    role="Planner",
    goal="Create execution plans",
    tools=[...], # Manual tool integration
)

crew = Crew(agents=[planner, executor], tasks=[...])
crew.kickoff()
```

**Claude Code:**
```bash
claude --agent planner "Plan feature X"
```

## The Key Insight

External frameworks treat AI as a library you integrate into your codebase. Claude Code flips this: **your codebase is integrated into the AI runtime**.

This means:
- No API wrapper code
- No tool registration boilerplate
- No context serialization
- No state management hell

The agent already has native access to:
- Filesystem (via Read/Write/Edit tools)
- Shell (via Bash tool)
- Git (via Bash + git commands)
- Search (via Grep/Glob tools)

You just define **roles** and **boundaries**. The runtime handles execution.

## Beyond the Terminal

The same primitives work everywhere Claude Code runs:

- **Claude Agent SDK** (renamed from "Claude Code SDK"): embed the agent harness in your own apps via `@anthropic-ai/claude-agent-sdk` (npm) or `claude-agent-sdk` (PyPI). Same tools, hooks, subagents, permissions, and `.claude/` loading as the CLI. Docs: https://code.claude.com/docs/en/agent-sdk/overview
- **Claude Code on the web**: browser sessions on managed infrastructure — no local install, same `.claude/` config from your repo.
- **Model lineup**: Opus 4.8 is the default. Pin cheaper models per role with the `sonnet` and `haiku` aliases, or reach for `fable` (Claude Fable 5, the top tier) for the hardest reasoning.

## Production-Ready Features

Enterprise features ship out of the box: native OS-level sandboxing (`sandbox` settings), managed settings for org-wide policy that user/project files cannot loosen, OpenTelemetry export (`CLAUDE_CODE_ENABLE_TELEMETRY=1`) with per-subagent cost attribution, and six permission modes from fully supervised (`plan`) to fully autonomous (`bypassPermissions`).

No external logging services. No custom security layers. It's built-in.

## Next Steps

Ready to build your first multi-agent system? Follow the [Quick Start](quick-start.md) to create a working framework in 5 minutes.
