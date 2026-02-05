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

Invoke specialized agents using `claude --agent <name>` or programmatically through the Skill system.

```bash
# Direct invocation
claude --agent planner "Design login system"

# From within an agent
claude --agent executor --input plan.yaml
```

**Agent files** live in `.claude/agents/`:

```markdown
# .claude/agents/planner.md
You are the Planner agent. Your role:
- Read user requirements
- Break into atomic tasks
- Output plan.yaml with task dependencies
- NEVER write code directly
```

Agents inherit from `CLAUDE.md` but can override specific behaviors.

### 3. Skills (Reusable Workflows)

Encapsulate multi-step operations as callable functions.

```typescript
// .claude/skills/implement-feature.ts
export default {
  name: "implement-feature",
  description: "Full feature implementation pipeline",

  async execute(args: { feature: string }) {
    // Step 1: Plan
    const plan = await claude.agent("planner", {
      input: `Feature: ${args.feature}`
    });

    // Step 2: Execute
    const code = await claude.agent("executor", {
      input: plan.artifact
    });

    // Step 3: Verify
    const results = await claude.agent("verifier", {
      input: code.artifact
    });

    return results;
  }
};
```

Skills are invoked with `/implement-feature feature="login"` or programmatically.

### 4. Hooks (Lifecycle Enforcement)

Intercept agent operations to enforce policies.

```typescript
// .claude/hooks/pre-write.ts
export default {
  name: "pre-write",

  async execute(context: WriteContext) {
    // Enforce: Only Executor can write to /src
    if (context.agent !== "executor" && context.path.startsWith("/src")) {
      throw new Error("Unauthorized: Only Executor can modify /src");
    }

    // Enforce: All writes must be planned
    if (!context.metadata.taskId) {
      throw new Error("Missing taskId: All writes must reference a task");
    }

    return context;
  }
};
```

**Hook types:**
- `pre-write`: Before file modifications
- `post-write`: After file modifications
- `pre-execute`: Before command execution
- `post-execute`: After command execution
- `pre-agent`: Before subagent invocation
- `post-agent`: After subagent returns

### 5. Settings/Permissions (Sandbox Boundaries)

Control what agents can access via `.claude/settings.json`.

```json
{
  "agents": {
    "planner": {
      "permissions": {
        "read": ["**/*"],
        "write": [],
        "execute": []
      }
    },
    "executor": {
      "permissions": {
        "read": ["**/*"],
        "write": ["src/**", "tests/**"],
        "execute": ["npm test", "npm run build"]
      }
    },
    "verifier": {
      "permissions": {
        "read": ["**/*"],
        "write": ["reports/**"],
        "execute": ["npm test", "npm run lint"]
      }
    }
  }
}
```

Claude Code enforces these at runtime. An agent attempting unauthorized operations fails immediately.

## Comparison with Alternatives

| Feature | Claude Code | LangChain/LangGraph | CrewAI | AutoGen |
|---------|-------------|---------------------|---------|---------|
| **Setup Complexity** | Edit markdown files | Write Python boilerplate | Install external framework | Configure agents in code |
| **Agent Definition** | `.claude/agents/*.md` | Python classes | YAML + Python | Python classes |
| **Tool Integration** | Native (Bash, Read, Write) | Manual wrapper functions | Manual integrations | Manual integrations |
| **Permissions** | `.claude/settings.json` | Manual enforcement | Not built-in | Not built-in |
| **Lifecycle Hooks** | `.claude/hooks/*.ts` | Custom middleware | Limited | Limited |
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

## Production-Ready Features

Claude Code includes enterprise features out of the box:

```json
{
  "security": {
    "sandboxMode": true,
    "allowedCommands": ["npm", "git", "pytest"],
    "blockedPaths": [".env", "credentials.json"]
  },
  "observability": {
    "logLevel": "info",
    "auditLog": ".claude/audit.jsonl"
  },
  "resourceLimits": {
    "maxFileSize": "10MB",
    "maxExecutionTime": "300s"
  }
}
```

No external logging services. No custom security layers. It's built-in.

## Next Steps

Ready to build your first multi-agent system? Follow the [Quick Start](quick-start.md) to create a working framework in 5 minutes.
