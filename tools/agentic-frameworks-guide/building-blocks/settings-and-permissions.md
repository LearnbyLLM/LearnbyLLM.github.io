# Settings & Permissions

`.claude/settings.json` controls what Claude can and cannot do. It defines the sandbox boundary for your multi-agent system.

## Key Settings

```json
{
  "allowedTools": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
  "deniedTools": ["WebSearch", "WebFetch"],
  "sandbox": true,
  "networkAccess": false,
  "hooks": {
    "PreToolUse": [...],
    "PostToolUse": [...]
  }
}
```

## Allowed Tools

Whitelist of tools Claude can use:

```json
{
  "allowedTools": [
    "Read",
    "Write",
    "Edit",
    "Bash",
    "Grep",
    "Glob",
    "WebSearch",
    "WebFetch",
    "Skill",
    "NotebookEdit"
  ]
}
```

If `allowedTools` is not specified, all tools are allowed by default.

## Denied Tools

Blacklist of tools Claude cannot use:

```json
{
  "deniedTools": ["Bash", "WebFetch"]
}
```

`deniedTools` takes precedence over `allowedTools`.

## Example: Agentic Framework Settings

`.claude/settings.json`:

```json
{
  "allowedTools": [
    "Read",
    "Write",
    "Edit",
    "Bash",
    "Grep",
    "Glob",
    "Skill"
  ],
  "deniedTools": [],
  "sandbox": true,
  "bashRestrictions": {
    "deniedCommands": [
      "rm -rf /",
      "sudo",
      "dd",
      "mkfs",
      "curl",
      "wget",
      "ssh",
      "scp"
    ],
    "allowedCommands": [
      "npm test",
      "pytest",
      "cargo test",
      "go test",
      "npm run lint",
      "npm run build"
    ]
  },
  "networkAccess": false,
  "hooks": {
    "PreToolUse": [
      {
        "name": "protect_files",
        "command": ".claude/hooks/protect_files.py"
      },
      {
        "name": "bash_guard",
        "command": ".claude/hooks/bash_guard.py"
      },
      {
        "name": "network_guard",
        "command": ".claude/hooks/network_guard.py"
      }
    ],
    "PostToolUse": [
      {
        "name": "audit_log",
        "command": ".claude/hooks/audit_log.py"
      }
    ]
  },
  "agents": {
    "planner": {
      "allowedTools": ["Read", "Grep", "Glob"],
      "deniedTools": ["Write", "Edit", "Bash"]
    },
    "executor": {
      "allowedTools": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
      "deniedTools": ["WebSearch", "WebFetch"],
      "bashRestrictions": {
        "allowedCommands": ["npm test", "npm run build", "pytest"]
      }
    },
    "verifier": {
      "allowedTools": ["Read", "Bash", "Grep", "Glob"],
      "deniedTools": ["Write", "Edit", "WebSearch", "WebFetch"],
      "bashRestrictions": {
        "allowedCommands": ["npm test", "npm run lint", "pytest", "cargo test"]
      }
    },
    "researcher": {
      "allowedTools": ["Read", "Grep", "Glob", "WebSearch", "WebFetch"],
      "deniedTools": ["Write", "Edit", "Bash"]
    }
  }
}
```

## Permission Hierarchy

Settings are resolved in this order (later overrides earlier):

```
User settings (~/.claude/settings.json)
  ↓ overrides
Project settings (<project-root>/.claude/settings.json)
  ↓ overrides
Agent-level constraints (.claude/settings.json → agents.<name>)
  ↓ overrides
Runtime flags (--allow-network, --deny-tool, etc.)
```

## Agent-Level Settings

Override settings per agent:

```json
{
  "agents": {
    "executor": {
      "allowedTools": ["Read", "Write", "Edit", "Bash"],
      "deniedTools": ["WebSearch", "WebFetch"],
      "sandbox": true,
      "networkAccess": false
    },
    "researcher": {
      "allowedTools": ["Read", "WebSearch", "WebFetch"],
      "deniedTools": ["Write", "Edit", "Bash"],
      "networkAccess": true
    }
  }
}
```

When you run `claude --agent executor`, Claude uses the executor settings.

## Sandbox Mode

```json
{
  "sandbox": true
}
```

Sandbox mode:
- Restricts file system access to project directory
- Blocks writes outside project
- Isolates Claude from system

For agentic frameworks, always use `sandbox: true`.

## Network Access

```json
{
  "networkAccess": false
}
```

`networkAccess: false`:
- Blocks WebSearch
- Blocks WebFetch
- Blocks network commands in Bash (curl, wget, ssh, etc.)

Use this for executor and verifier agents. Only researcher should have network access.

## Bash Restrictions

Fine-grained control over bash commands:

```json
{
  "bashRestrictions": {
    "deniedCommands": [
      "rm -rf /",
      "sudo",
      "curl | bash"
    ],
    "allowedCommands": [
      "npm test",
      "pytest",
      "cargo test"
    ],
    "allowPattern": "^(npm|pytest|cargo)\\s+(test|build|lint)",
    "denyPattern": "(sudo|rm\\s+-rf\\s+/)"
  }
}
```

**deniedCommands**: Exact string matches (blocked)
**allowedCommands**: Exact string matches (allowed)
**allowPattern**: Regex for allowed commands
**denyPattern**: Regex for denied commands

If `allowedCommands` is set, only those commands are allowed (whitelist mode).

## Example: Per-Agent Bash Restrictions

```json
{
  "agents": {
    "executor": {
      "bashRestrictions": {
        "allowedCommands": [
          "npm test",
          "npm run build",
          "pytest",
          "cargo test"
        ]
      }
    },
    "verifier": {
      "bashRestrictions": {
        "allowedCommands": [
          "npm test",
          "npm run lint",
          "pytest --cov",
          "cargo clippy"
        ]
      }
    }
  }
}
```

Executor can build. Verifier cannot build (only test/lint).

## Pre-Tool Hooks for Validation

Settings define what's allowed. Hooks enforce it.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "name": "validate_permissions",
        "command": ".claude/hooks/validate_permissions.py"
      }
    ]
  }
}
```

`.claude/hooks/validate_permissions.py`:

```python
#!/usr/bin/env python3
import sys
import json
import os

def main():
    event = json.loads(sys.stdin.read())
    settings_file = '.claude/settings.json'

    with open(settings_file) as f:
        settings = json.load(f)

    tool_name = event.get('tool_name')
    agent_name = os.environ.get('CLAUDE_AGENT_NAME', 'default')

    # Get agent-specific settings
    agent_settings = settings.get('agents', {}).get(agent_name, {})

    # Check denied tools
    denied = agent_settings.get('deniedTools', [])
    if tool_name in denied:
        print(json.dumps({
            'allowed': False,
            'reason': f'{agent_name} agent cannot use {tool_name}'
        }))
        sys.exit(1)

    # Check allowed tools (whitelist mode)
    allowed = agent_settings.get('allowedTools')
    if allowed and tool_name not in allowed:
        print(json.dumps({
            'allowed': False,
            'reason': f'{tool_name} not in allowed tools for {agent_name}'
        }))
        sys.exit(1)

    print(json.dumps({'allowed': True}))
    sys.exit(0)

if __name__ == '__main__':
    main()
```

## How Permissions Interact with Agent Definitions

Belt-and-suspenders approach:

**Agent definition** (`.claude/agents/executor.md`):
```markdown
## Forbidden Tools

NEVER use:
- WebSearch
- WebFetch
```

**Settings** (`.claude/settings.json`):
```json
{
  "agents": {
    "executor": {
      "deniedTools": ["WebSearch", "WebFetch"]
    }
  }
}
```

**Hook** (`.claude/hooks/network_guard.py`):
```python
if agent_name == 'executor':
    if tool_name in ['WebSearch', 'WebFetch']:
        # Block it
```

Three layers of protection:
1. Prompt (agent definition) — probabilistic
2. Settings — configuration-based
3. Hook — deterministic enforcement

Even if the agent "forgets" the prompt, settings and hooks enforce the rule.

## Example: Complete Settings File

`.claude/settings.json`:

```json
{
  "allowedTools": [
    "Read",
    "Write",
    "Edit",
    "Bash",
    "Grep",
    "Glob",
    "Skill",
    "WebSearch",
    "WebFetch"
  ],
  "deniedTools": [],
  "sandbox": true,
  "networkAccess": true,
  "bashRestrictions": {
    "deniedCommands": [
      "rm -rf /",
      "sudo",
      "dd if=",
      "mkfs",
      ":(){ :|:& };:"
    ],
    "denyPattern": "(sudo|rm\\s+-rf\\s+/|>\\s*/dev/sd)"
  },
  "hooks": {
    "PreToolUse": [
      {
        "name": "protect_files",
        "command": ".claude/hooks/protect_files.py",
        "description": "Block writes to .claude/, .env, .git/"
      },
      {
        "name": "bash_guard",
        "command": ".claude/hooks/bash_guard.py",
        "description": "Validate bash commands against deny list"
      },
      {
        "name": "network_guard",
        "command": ".claude/hooks/network_guard.py",
        "description": "Restrict network access by agent"
      }
    ],
    "PostToolUse": [
      {
        "name": "audit_log",
        "command": ".claude/hooks/audit_log.py",
        "description": "Log all tool usage"
      }
    ],
    "Notification": [
      {
        "name": "notify_slack",
        "command": ".claude/hooks/notify_slack.py",
        "description": "Send notifications to Slack on errors"
      }
    ]
  },
  "agents": {
    "planner": {
      "allowedTools": ["Read", "Grep", "Glob"],
      "deniedTools": ["Write", "Edit", "Bash", "WebSearch", "WebFetch"],
      "networkAccess": false
    },
    "executor": {
      "allowedTools": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
      "deniedTools": ["WebSearch", "WebFetch"],
      "networkAccess": false,
      "bashRestrictions": {
        "allowedCommands": [
          "npm test",
          "npm run build",
          "npm run lint",
          "pytest",
          "pytest --cov",
          "cargo test",
          "cargo build",
          "go test"
        ]
      }
    },
    "verifier": {
      "allowedTools": ["Read", "Bash", "Grep", "Glob"],
      "deniedTools": ["Write", "Edit", "WebSearch", "WebFetch"],
      "networkAccess": false,
      "bashRestrictions": {
        "allowedCommands": [
          "npm test",
          "npm run lint",
          "pytest --cov",
          "cargo clippy",
          "cargo test",
          "go test"
        ]
      }
    },
    "researcher": {
      "allowedTools": ["Read", "Grep", "Glob", "WebSearch", "WebFetch"],
      "deniedTools": ["Write", "Edit", "Bash"],
      "networkAccess": true
    }
  }
}
```

## Runtime Flags

Override settings with CLI flags:

```bash
# Allow network for one-off research
claude --agent executor --allow-network "task"

# Deny a specific tool
claude --deny-tool Bash "task"

# Disable sandbox (dangerous!)
claude --no-sandbox "task"
```

Use runtime flags sparingly. Settings files are safer (version controlled, reviewed).

## Tips

**Start restrictive**: Begin with minimal permissions. Add as needed.

**Version control settings**: Track `.claude/settings.json` in git. Review changes carefully.

**Test agent permissions**: Run each agent with `--dry-run` to verify it has the tools it needs.

**Layer defenses**: Use settings AND hooks. Don't rely on prompts alone.

**Document exceptions**: If you allow a risky tool, comment why in settings.json:

```json
{
  "allowedTools": ["Bash"],
  "_comment": "Bash needed for test execution only. Restricted by bashRestrictions."
}
```

**Audit regularly**: Review `.claude/audit.jsonl` to see what agents are actually doing.
