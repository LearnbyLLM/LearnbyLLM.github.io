# Hooks

Hooks run handlers at specific points in Claude's lifecycle. They provide deterministic enforcement of rules, not prompt-based suggestions. For multi-agent systems, hooks are critical for safety.

Hooks are configured in `settings.json` — there is no magic `.claude/hooks/` config directory. Putting your hook *scripts* in `.claude/hooks/` is a fine convention, but a script does nothing until it's registered under the `hooks` key in a settings file (or in a subagent's or skill's frontmatter).

## Hook Events

Claude Code now has 30+ hook events. The ones that matter most for agentic frameworks:

**Tool lifecycle** (the workhorses):
- `PreToolUse` — before a tool executes; can block or rewrite it
- `PostToolUse` — after a tool succeeds
- `PostToolUseFailure` — after a tool fails
- `PermissionRequest` / `PermissionDenied` — around the permission system

**Subagent lifecycle**:
- `SubagentStart` / `SubagentStop` — matcher is the agent type name (`executor`, `verifier`...). This is how you wire per-agent setup, teardown, and auditing.

**Session and turn**:
- `SessionStart` / `SessionEnd`, `UserPromptSubmit`, `Stop` (Claude finished a turn), `StopFailure`

**Context and environment**:
- `PreCompact` / `PostCompact` — context compaction (re-inject critical state here)
- `FileChanged`, `CwdChanged`, `ConfigChange`, `InstructionsLoaded`, `Notification`, `TaskCreated` / `TaskCompleted`, `WorktreeCreate` / `WorktreeRemove`

## Why Hooks Matter for Agents

Prompts are probabilistic. Hooks are deterministic.

**Prompt**: "Never modify files in `.claude/`"
**Reality**: Agent might still try if the context is compelling.

**Hook**: Blocks write operations to `.claude/` before they execute.
**Reality**: Enforced by Claude Code regardless of what the model decides. A blocking hook even overrides `allow` permission rules.

## Hook Configuration

Register hooks in `.claude/settings.json` under event name → matcher → handlers:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
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
          {"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/audit_log.py", "async": true}
        ]
      }
    ]
  }
}
```

**Matchers**: `*` (or omitted) matches everything; `Bash` or `Edit|Write` are exact/alternation; anything else is treated as a regex (`mcp__github__.*`). For tool events the matcher tests the tool name; for `SubagentStart`/`SubagentStop` it tests the agent type; for `SessionStart` it tests the source (`startup`, `resume`, `clear`, `compact`).

Hooks can live in managed settings, project `settings.json`, `settings.local.json`, user settings, plugins, and — scoped to a single agent or skill — in subagent/skill frontmatter. `$CLAUDE_PROJECT_DIR` resolves to the project root so commands work from any cwd.

## Handler Types

`command` is the default, but hooks support five handler types:

```json
{"type": "command", "command": "./check.py", "args": ["--strict"], "timeout": 60}
{"type": "http", "url": "https://hooks.internal/claude", "headers": {"Authorization": "Bearer $TOKEN"}}
{"type": "mcp_tool", "server": "guardrails", "tool": "validate_action"}
{"type": "prompt", "prompt": "Does this change touch billing code? If so, flag it."}
{"type": "agent", ...}
```

`http` is the production pattern for centralized policy services; `prompt`/`agent` handlers let a model evaluate the event (useful for fuzzy policies, but they're back to probabilistic — don't use them as your only guard). Command hooks support `async: true` for fire-and-forget work like logging.

## Hook Input Format

Command hooks receive JSON on **stdin**:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/home/user/project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file",
    "content": "..."
  }
}
```

The fields are `tool_name` and `tool_input` (not `parameters`), plus event-specific fields per event. There are no `CLAUDE_AGENT_NAME`/`CLAUDE_RUN_ID` environment variables — to scope a hook to one agent, define it in that agent's frontmatter (below) or match the agent type on `SubagentStart`/`SubagentStop`.

## Hook Output Format

Two ways to respond, and the exit codes are **not** a simple 0/1:

- **Exit 0** — success. Claude Code parses stdout as JSON (optional).
- **Exit 2** — blocking error. stderr is fed to Claude as the error; for `PreToolUse` this blocks the tool call. JSON on stdout is ignored.
- **Any other exit code** — *non-blocking* error. Execution continues. Do not assume a crash blocks the tool.

The JSON form (on exit 0) gives finer control:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Cannot write to protected path: .env",
    "additionalContext": "Optional extra context injected for Claude"
  }
}
```

`permissionDecision` is `allow`, `deny`, `ask` (force a prompt), or `defer`. Top-level fields like `"continue": false` (halt Claude entirely), `"systemMessage"`, and `"suppressOutput"` work across events. `updatedInput` lets a PreToolUse hook rewrite the tool's input before execution.

## Example: Protect Files Hook

`.claude/hooks/protect_files.py` (registered on `PreToolUse` with matcher `Write|Edit`):

```python
#!/usr/bin/env python3
"""PreToolUse hook: Block writes to protected paths."""
import sys
import json

PROTECTED_PATHS = [
    '.claude/', '.env', '.git/',
    'package-lock.json', 'poetry.lock', 'Cargo.lock',
]

def main():
    event = json.loads(sys.stdin.read())
    file_path = event.get('tool_input', {}).get('file_path', '')

    for protected in PROTECTED_PATHS:
        if protected in file_path:
            print(json.dumps({
                'hookSpecificOutput': {
                    'hookEventName': 'PreToolUse',
                    'permissionDecision': 'deny',
                    'permissionDecisionReason':
                        f'Cannot write to protected path: {file_path}'
                }
            }))
            sys.exit(0)

    sys.exit(0)  # no decision: normal permission flow applies

if __name__ == '__main__':
    main()
```

Make it executable: `chmod +x .claude/hooks/protect_files.py`. Note that exiting 0 *without* a decision doesn't approve anything — it just defers to the normal permission flow.

## Example: Bash Guard Hook

The exit-2 style is simpler when all you need is block-or-pass:

`.claude/hooks/bash_guard.py` (matcher `Bash`):

```python
#!/usr/bin/env python3
"""PreToolUse hook: Block dangerous bash commands."""
import sys
import json
import re

DANGEROUS_PATTERNS = [
    r'rm\s+-rf\s+/',        # Recursive delete from root
    r'sudo\s+',             # Sudo commands
    r'curl\s+.*\|\s*(ba)?sh',  # Pipe to shell
    r'wget\s+.*\|\s*(ba)?sh',
    r'dd\s+if=',            # Disk operations
    r'mkfs\.',              # Format filesystem
    r':\(\)\{.*\}',         # Fork bombs
    r'>\s*/dev/sd',         # Write to disk devices
]

def main():
    event = json.loads(sys.stdin.read())
    command = event.get('tool_input', {}).get('command', '')

    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, command):
            # Exit 2 = blocking error; stderr is shown to Claude
            print(f'Blocked dangerous command (matched: {pattern})',
                  file=sys.stderr)
            sys.exit(2)

    sys.exit(0)

if __name__ == '__main__':
    main()
```

## Scoping Hooks to One Agent

The old pattern of sniffing an agent-name environment variable inside a global hook doesn't exist. The real mechanism is better: define hooks in the subagent's frontmatter, and they run only while that agent is active:

```markdown
---
name: executor
description: Implements code changes from a plan artifact
tools: Read, Write, Edit, Bash, Grep, Glob
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "$CLAUDE_PROJECT_DIR/.claude/hooks/block_network_cmds.py"
---
```

Where `block_network_cmds.py` exits 2 for `curl`, `wget`, `nc`, `ssh`, `scp`. Combine with `disallowedTools: WebSearch, WebFetch` in the same frontmatter and the executor is offline by construction. A `Stop` hook in frontmatter is automatically converted to `SubagentStop` when the agent runs as a subagent.

For main-session visibility into agent activity, match agent types in `settings.json`:

```json
{
  "hooks": {
    "SubagentStop": [
      {"matcher": "executor|verifier", "hooks": [
        {"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/audit_log.py"}
      ]}
    ]
  }
}
```

## Example: Audit Log Hook

`.claude/hooks/audit_log.py` (registered on `PostToolUse`, matcher `*`):

```python
#!/usr/bin/env python3
"""PostToolUse hook: Log all tool usage."""
import sys
import json
import os
from datetime import datetime, timezone

def main():
    event = json.loads(sys.stdin.read())

    log_file = os.path.join(
        os.environ.get('CLAUDE_PROJECT_DIR', '.'), '.claude', 'audit.jsonl')

    log_entry = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'session': event.get('session_id'),
        'event': event.get('hook_event_name'),
        'tool': event.get('tool_name'),
        'tool_input': event.get('tool_input'),
    }

    with open(log_file, 'a') as f:
        f.write(json.dumps(log_entry) + '\n')

    sys.exit(0)

if __name__ == '__main__':
    main()
```

This creates `.claude/audit.jsonl`:

```json
{"timestamp": "2026-06-11T10:30:00+00:00", "session": "abc123", "event": "PostToolUse", "tool": "Read", "tool_input": {"file_path": "src/auth.js"}}
{"timestamp": "2026-06-11T10:31:00+00:00", "session": "abc123", "event": "PostToolUse", "tool": "Write", "tool_input": {"file_path": "src/auth.js"}}
```

Register `PostToolUseFailure` to the same script and you also capture every failed call — usually the more interesting half of the log.

## Example: Coverage Guard Hook

Prevent commits that reduce test coverage. Registered on `PreToolUse` with matcher `Bash`:

`.claude/hooks/coverage_guard.py`:

```python
#!/usr/bin/env python3
"""PreToolUse hook: Block git commits if coverage decreased."""
import sys
import json
import os
import subprocess

def get_coverage():
    """Run tests and extract coverage percentage."""
    subprocess.run(
        ['pytest', '--cov=src', '--cov-report=json'],
        capture_output=True, text=True
    )
    with open('coverage.json') as f:
        return json.load(f)['totals']['percent_covered']

def main():
    event = json.loads(sys.stdin.read())
    command = event.get('tool_input', {}).get('command', '')

    if 'git commit' not in command:
        sys.exit(0)

    baseline_file = '.claude/baseline_coverage.txt'
    if not os.path.exists(baseline_file):
        sys.exit(0)  # no baseline, allow

    with open(baseline_file) as f:
        baseline = float(f.read().strip())

    try:
        current = get_coverage()
    except Exception as e:
        print(f'Coverage check failed: {e}', file=sys.stderr)
        sys.exit(2)  # fail closed

    if current < baseline:
        print(f'Coverage decreased: {baseline}% -> {current}%', file=sys.stderr)
        sys.exit(2)

    sys.exit(0)

if __name__ == '__main__':
    main()
```

This one violates the "under 100ms" rule by design — running a test suite in a hook is slow. Set a generous `"timeout"` on the handler and only pay the cost on `git commit`, which the early return guarantees.

## Hooks vs Prompt Instructions

| Aspect | Prompts | Hooks |
|--------|---------|-------|
| Enforcement | Probabilistic | Deterministic |
| Bypass risk | High | None (enforced by the client) |
| Error messages | Generic | Specific |
| Performance | No overhead | Minimal overhead |
| Debugging | Hard (hidden in context) | Easy (logs, exit codes) |
| Trust | "Hope it works" | "Know it works" |

For safety-critical rules, always use hooks.

## Hook Development Tips

**Fast execution**: PreToolUse hooks run on every matching tool call. Keep them under 100ms, set a `timeout`, and use `async: true` for anything that doesn't need to block (logging, notifications).

**Clear errors**: When blocking, explain why — the stderr (exit 2) or `permissionDecisionReason` is shown to Claude, which uses it to self-correct. "Blocked" is useless. "Blocked write to .env (protected file)" is actionable.

**Fail closed deliberately**: A crashing hook does *not* block the tool — non-2 exit codes are non-blocking. Wrap your logic in try/except and `sys.exit(2)` on internal errors if you want fail-closed behavior.

**Match narrowly**: Use matchers (`Bash`, `Edit|Write`) instead of `*` plus in-script filtering. Less code, fewer subprocess spawns.

**Test thoroughly**: Hooks are code — unit test them by piping sample JSON to stdin.

**Log everything**: PostToolUse + PostToolUseFailure into `.claude/audit.jsonl`. Invaluable for debugging multi-agent runs.

## Common Hook Patterns

**File protection**: `PreToolUse` on `Write|Edit`, deny protected paths
**Command validation**: `PreToolUse` on `Bash`, regex deny list, exit 2
**Role enforcement**: hooks + `disallowedTools` in subagent frontmatter
**Audit logging**: `PostToolUse`/`PostToolUseFailure` → JSONL
**Quality gates**: `PreToolUse` on `Bash` matching `git commit`, block on failing tests or coverage regression
**Compaction safety**: `PreCompact`/`PostCompact` to snapshot and re-inject pipeline state
**Run lifecycle**: `SubagentStart`/`SubagentStop` for per-agent setup, teardown, and metrics

Full reference: [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks)
