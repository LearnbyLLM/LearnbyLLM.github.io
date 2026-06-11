# Copy-Paste Hooks

Ready-to-use hook scripts and the settings.json config that wires them up.

Two things to get right before copying anything:

1. **Hooks are configured in settings.json** (project `.claude/settings.json`, user `~/.claude/settings.json`, or skill/agent frontmatter) — not by dropping files into a magic directory. The scripts themselves can live anywhere; `.claude/hooks/` is just a sensible convention for keeping them in the repo.
2. **The contract is stdin/stdout/exit code.** Claude Code pipes a JSON payload (with `hook_event_name`, `tool_name`, `tool_input`, etc.) to your script's stdin. Your script responds with an exit code — `0` for success (stdout parsed as JSON), `2` to block (stderr is fed back to Claude) — and optionally a JSON object on stdout.

Full reference: https://code.claude.com/docs/en/hooks

## File Protection Hook

Prevents agents from modifying critical files. Fires on `PreToolUse` for `Edit` and `Write`.

File: `.claude/hooks/protect_files.py`

```python
#!/usr/bin/env python3
"""
File Protection Hook (PreToolUse: Edit|Write)
Prevents modification of protected files and directories.
Reads the hook payload from stdin, emits a permission decision on stdout.
"""

import json
import sys
from pathlib import Path

# Protected files and directories
PROTECTED = [
    ".env",
    ".env.local",
    ".env.production",
    "secrets.json",
    "credentials.json",
    ".git/",
    "node_modules/",
    ".claude/hooks/",  # Don't let agents modify hooks
    "package-lock.json",  # Prevent lock file drift
]

def deny(reason):
    """Emit a PreToolUse deny decision and exit cleanly."""
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)

def main():
    payload = json.load(sys.stdin)
    file_path = payload.get("tool_input", {}).get("file_path", "")
    if not file_path:
        sys.exit(0)  # Nothing to check; defer to normal permission flow

    path = Path(file_path)

    for protected in PROTECTED:
        if protected.endswith("/"):
            # Directory check
            if protected.rstrip("/") in path.parts:
                deny(f"Cannot modify files in protected directory: {protected}")
        else:
            # File check
            if path.name == protected or str(path).endswith(protected):
                deny(f"Cannot modify protected file: {protected}")

    # No output, exit 0: defer to the normal permission flow
    sys.exit(0)

if __name__ == "__main__":
    main()
```

Register it in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/protect_files.py"
          }
        ]
      }
    ]
  }
}
```

The `matcher` filters by tool name: exact names, `|`-alternation, or a regex (`mcp__github__.*`). Use `"*"` or omit it to fire on every tool.

## Bash Guard Hook

Blocks dangerous bash commands outright; escalates risky-but-legitimate ones to the user via `permissionDecision: "ask"`.

File: `.claude/hooks/bash_guard.py`

```python
#!/usr/bin/env python3
"""
Bash Guard Hook (PreToolUse: Bash)
Denies destructive commands; forces a user prompt for risky ones.
"""

import json
import re
import sys

# Dangerous command patterns -> hard deny
DENY_PATTERNS = [
    r"rm\s+-rf\s+/",           # rm -rf / (delete root)
    r"rm\s+-rf\s+\*",          # rm -rf * (delete all in cwd)
    r":\(\)\{\s*:\|:\&\s*\};:", # Fork bomb
    r"dd\s+if=/dev/random",    # Overwrite disk
    r"mkfs\.",                 # Format disk
    r">\s*/dev/sda",           # Write to disk device
    r"mv\s+/\s+",              # Move root
    r"chmod\s+-R\s+777\s+/",   # Chmod root to 777
    r"curl.*\|\s*bash",        # Curl to bash (risky)
    r"wget.*\|\s*bash",        # Wget to bash (risky)
    r"eval\s*\$\(",            # Eval command substitution (risky)
]

# Commands that should always surface a permission prompt
ASK_PATTERNS = [
    r"git\s+push.*--force",
    r"docker\s+system\s+prune",
    r"npm\s+publish",
    r"kubectl\s+delete",
    r"terraform\s+destroy",
    r"rm\s+-rf\s+node_modules",
]

def decide(decision, reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,  # "allow" | "deny" | "ask" | "defer"
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)

def main():
    payload = json.load(sys.stdin)
    command = payload.get("tool_input", {}).get("command", "")

    for pattern in DENY_PATTERNS:
        if re.search(pattern, command):
            decide("deny", f"Dangerous command blocked: {pattern}")

    for pattern in ASK_PATTERNS:
        if re.search(pattern, command):
            decide("ask", f"Command requires user approval: {pattern}")

    sys.exit(0)  # Defer to normal permission flow

if __name__ == "__main__":
    main()
```

Registration:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/bash_guard.py",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

A note on exit codes as an alternative: instead of emitting JSON, a hook can simply `sys.exit(2)` with the reason on stderr — exit code 2 blocks the action and feeds stderr to Claude. The JSON form is preferred because it distinguishes deny (blocked, with reason) from ask (escalate to the human). Beware that exit code 1 does **not** block — anything other than 0 or 2 is treated as a non-blocking hook error and the action proceeds.

## Logging Hook

Logs every tool call with timestamps. Fires on `PostToolUse` (success) — register it on `PostToolUseFailure` too if you want failures captured with the same script.

File: `.claude/hooks/log_tools.py`

```python
#!/usr/bin/env python3
"""
Tool Logging Hook (PostToolUse / PostToolUseFailure)
Logs every tool call with timestamp and details.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

LOG_DIR = Path(".claude/logs")

def log_tool_call():
    payload = json.load(sys.stdin)
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session_id": payload.get("session_id", "unknown"),
        "agent_type": payload.get("agent_type"),  # set when inside a subagent
        "event": payload.get("hook_event_name"),
        "tool": payload.get("tool_name"),
        "tool_input": payload.get("tool_input"),
        # tool_response shape depends on the tool; keep a preview only
        "result_preview": str(payload.get("tool_response"))[:500],
        "success": payload.get("hook_event_name") == "PostToolUse",
    }

    log_file = LOG_DIR / f"{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.jsonl"
    with open(log_file, "a") as f:
        f.write(json.dumps(log_entry) + "\n")

    sys.exit(0)  # Never block on logging

def get_tool_stats(date=None):
    """Get statistics for a specific date or today"""
    if date is None:
        date = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    log_file = LOG_DIR / f"{date}.jsonl"
    if not log_file.exists():
        return {"error": "No logs for this date"}

    stats = {
        "total_calls": 0,
        "by_tool": {},
        "by_agent": {},
        "failures": 0,
    }

    with open(log_file) as f:
        for line in f:
            entry = json.loads(line)
            stats["total_calls"] += 1

            tool = entry["tool"]
            stats["by_tool"][tool] = stats["by_tool"].get(tool, 0) + 1

            agent = entry.get("agent_type") or "main"
            stats["by_agent"][agent] = stats["by_agent"].get(agent, 0) + 1

            if not entry["success"]:
                stats["failures"] += 1

    return stats

if __name__ == "__main__":
    if sys.stdin.isatty():
        # Run directly: print stats for today
        print(json.dumps(get_tool_stats(), indent=2))
    else:
        log_tool_call()
```

Registration (both success and failure events):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/log_tools.py"}
        ]
      }
    ],
    "PostToolUseFailure": [
      {
        "matcher": "*",
        "hooks": [
          {"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/log_tools.py"}
        ]
      }
    ]
  }
}
```

The `agent_type` field is present whenever the hook fires inside a subagent, so this one log gives you per-agent attribution for free — pair it with `SubagentStart`/`SubagentStop` hooks if you also want start/stop timestamps per delegation.

## Complete settings.json

Everything above, plus permission rules and sandboxing, in one file.

File: `.claude/settings.json`

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",

  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/protect_files.py"}
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/bash_guard.py", "timeout": 10}
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/log_tools.py"}
        ]
      }
    ],
    "PostToolUseFailure": [
      {
        "matcher": "*",
        "hooks": [
          {"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/log_tools.py"}
        ]
      }
    ]
  },

  "permissions": {
    "allow": [
      "Read",
      "Grep",
      "Glob",
      "Edit(src/**)",
      "Write(src/**)",
      "Bash(npm test)",
      "Bash(pytest *)",
      "Bash(git status)",
      "Bash(git diff *)"
    ],
    "ask": [
      "Bash(git push *)",
      "Bash(rm *)",
      "Bash(docker system prune *)",
      "Bash(npm publish)",
      "Bash(kubectl *)",
      "Bash(terraform *)"
    ],
    "deny": [
      "Read(./.env*)",
      "Edit(./.env*)",
      "Write(./.env*)",
      "Edit(./secrets.*)",
      "Write(./secrets.*)",
      "Edit(.git/**)"
    ]
  },

  "sandbox": {
    "enabled": true,
    "filesystem": {
      "allowWrite": ["./src", "./tests", "./.claude"],
      "denyWrite": ["./.git", "./node_modules"]
    },
    "network": {
      "allowedDomains": ["github.com", "registry.npmjs.org"]
    },
    "autoAllowBashIfSandboxed": true
  }
}
```

Notes on what changed versus older guides you may have seen:

- Permission rules are `allow` / `ask` / `deny` arrays with `Tool(specifier)` syntax — `Bash(npm run *)`, `Read(./.env)`, `WebFetch(domain:example.com)`, `Agent(researcher)`, `Skill(deploy *)`. Deny beats allow.
- Per-agent model and tool configuration does **not** live in settings.json. It lives in each agent's frontmatter in `.claude/agents/<name>.md` (see [Copy-Paste Agents](copy-paste-agents.md)). There are no `max_tokens`/`temperature` knobs to set here.
- The `sandbox` block is real OS-level filesystem and network isolation for Bash. With `autoAllowBashIfSandboxed`, commands that stay inside the sandbox boundary run without prompts — defense-in-depth on top of hooks and permission rules.

## Skill Templates

Skills live at `.claude/skills/<name>/SKILL.md` and become `/name` commands. They can also be invoked automatically by Claude based on their `description` — set `disable-model-invocation: true` if you only want manual invocation.

### Agentic Run Skill

File: `.claude/skills/agentic-run/SKILL.md`

```markdown
---
name: agentic-run
description: Execute a full Plan-Execute-Verify workflow for a task, with artifacts saved per run.
argument-hint: [task description]
disable-model-invocation: true
---

Execute a Plan-Execute-Verify workflow for: $ARGUMENTS

Set RUN_ID to today's date plus a short slug of the task. All artifacts go
in `.claude/runs/<RUN_ID>/`.

1. **Plan**: Delegate to the `planner` subagent. It must write
   `.claude/runs/<RUN_ID>/plan.md`.
2. **Approve**: Show me the plan and wait for my explicit approval before
   continuing.
3. **Execute**: Delegate to the `executor` subagent with the plan file. It
   must write `.claude/runs/<RUN_ID>/execution.md` and stop on the first
   failed step.
4. **Verify**: Delegate to the `verifier` subagent with both files. It must
   write `.claude/runs/<RUN_ID>/verdict.md`.
5. Report the verdict (PASS/FAIL) and the path to the run directory.

If any stage fails, stop and report — do not improvise around the failure.
```

Usage, inside a session:

```text
/agentic-run add password length validation to the login flow
```

Or non-interactively:

```bash
claude -p "/agentic-run add password length validation to the login flow"
```

### Deep Research Skill

File: `.claude/skills/deep-research/SKILL.md`

```markdown
---
name: deep-research
description: Multi-source research with synthesis into actionable recommendations.
argument-hint: [research query]
context: fork
agent: researcher
---

Research the following query in three phases: $ARGUMENTS

1. **Overview**: Search for the query's key concepts. Max 3 sources.
2. **Deep dive**: Targeted research on implementation details and best
   practices. Max 5 additional sources.
3. **Synthesis**: Combine findings into `.claude/runs/<RUN_ID>/research.md`
   (findings with citations) and `recommendations.md` (specific next steps).

Limits: 10 sources total, 3 pages per source. Report confidence level
honestly: CONFIDENT, CONTRADICTORY, or INSUFFICIENT_DATA.
```

`context: fork` runs the skill in a forked subagent so the research churn (search results, fetched pages) never lands in your main context — only the final report comes back. `agent: researcher` makes the fork use the researcher agent's tool restrictions, so the whole thing is read-only by construction.

Skills can carry supporting files (templates, scripts, examples) in their directory next to SKILL.md, and can inject live context with `` !`command` `` — e.g. `` !`git diff HEAD` `` runs before Claude sees the skill and inlines the output. See https://code.claude.com/docs/en/skills

## Hook Registration Reference

In settings.json, hooks are organized by event name, then matcher group, then handler list:

```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "ToolNameOrPattern",
        "hooks": [
          {"type": "command", "command": "path/to/script", "timeout": 60}
        ]
      }
    ]
  }
}
```

The events you'll actually use:

| Event | Fires | Matcher |
|-------|-------|---------|
| `PreToolUse` | Before a tool call (can block/allow/ask) | Tool name |
| `PostToolUse` | After a tool call succeeds | Tool name |
| `PostToolUseFailure` | After a tool call fails | Tool name |
| `UserPromptSubmit` | Before Claude processes your prompt | — |
| `SessionStart` | Session begins or resumes | `startup`, `resume`, `clear`, `compact` |
| `SessionEnd` | Session terminates | — |
| `Stop` | Claude finishes responding | — |
| `SubagentStart` / `SubagentStop` | Subagent lifecycle | Agent type name |
| `PreCompact` | Before context compaction | — |
| `Notification` | System notification | Notification type |
| `FileChanged` | A watched file is modified | Filename |

There are 30+ events in total (`PermissionRequest`, `TaskCompleted`, `WorktreeCreate`, ...); see the docs for the full list. Handlers can also be `type: "prompt"`, `"agent"`, `"http"`, or `"mcp_tool"` instead of `"command"`.

**Hook input** (stdin, JSON):

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/directory",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {"command": "npm test"}
}
```

`PostToolUse` adds `tool_response`; subagent contexts add `agent_type`.

**Hook output**:

- Exit `0` — success; stdout is parsed as JSON (e.g. `hookSpecificOutput.permissionDecision` for PreToolUse, `additionalContext` to inject context on UserPromptSubmit/SessionStart)
- Exit `2` — blocking error; stderr is shown to Claude; the action is stopped
- Any other exit code — non-blocking error; execution continues (yes, including exit 1)

## Usage Notes

Make hook scripts executable:

```bash
chmod +x .claude/hooks/*.py
```

Test hooks by piping a sample payload, exactly as Claude Code will:

```bash
echo '{"hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":".env"}}' \
  | .claude/hooks/protect_files.py

echo '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' \
  | .claude/hooks/bash_guard.py
```

View logs:

```bash
# Today's tool calls
cat .claude/logs/$(date +%Y-%m-%d).jsonl | jq

# Stats for today
python3 .claude/hooks/log_tools.py
```

Run `/hooks` in a session to review what's registered. Customize for your project by editing the PROTECTED lists, DENY_PATTERNS, and permission rules.
