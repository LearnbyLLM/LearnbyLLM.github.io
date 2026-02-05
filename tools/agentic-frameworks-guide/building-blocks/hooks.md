# Hooks

Hooks run shell commands at specific points in Claude's lifecycle. They provide deterministic enforcement of rules, not prompt-based suggestions. For multi-agent systems, hooks are critical for safety.

## Hook Types

Claude Code supports four hook types:

1. **PreToolUse**: Runs before a tool executes (can block the tool)
2. **PostToolUse**: Runs after a tool executes (can validate output)
3. **Notification**: Runs on events (non-blocking)
4. **Stop**: Runs when Claude stops (cleanup, logging)

## Why Hooks Matter for Agents

Prompts are probabilistic. Hooks are deterministic.

**Prompt**: "Never modify files in `.claude/`"
**Reality**: Agent might still try if the context is compelling.

**Hook**: Blocks write operations to `.claude/` at the system level.
**Reality**: Physically impossible for agent to bypass.

## Example: Protect Files Hook

`.claude/hooks/protect_files.py`:

```python
#!/usr/bin/env python3
"""
PreToolUse hook: Block writes to protected paths.
"""
import sys
import json
import os

PROTECTED_PATHS = [
    '.claude/',
    '.env',
    '.env.local',
    '.env.production',
    '.git/',
    'package-lock.json',
    'poetry.lock',
    'Cargo.lock',
]

def is_protected(path):
    """Check if path is protected."""
    for protected in PROTECTED_PATHS:
        if path.startswith(protected):
            return True
    return False

def main():
    # Read tool invocation from stdin
    event = json.loads(sys.stdin.read())

    tool_name = event.get('tool_name')
    params = event.get('parameters', {})

    # Check Write tool
    if tool_name == 'Write':
        file_path = params.get('file_path', '')
        if is_protected(file_path):
            print(json.dumps({
                'allowed': False,
                'reason': f'Cannot write to protected path: {file_path}'
            }))
            sys.exit(1)

    # Check Edit tool
    if tool_name == 'Edit':
        file_path = params.get('file_path', '')
        if is_protected(file_path):
            print(json.dumps({
                'allowed': False,
                'reason': f'Cannot edit protected path: {file_path}'
            }))
            sys.exit(1)

    # Allow all other operations
    print(json.dumps({'allowed': True}))
    sys.exit(0)

if __name__ == '__main__':
    main()
```

Make it executable:

```bash
chmod +x .claude/hooks/protect_files.py
```

## Example: Bash Guard Hook

`.claude/hooks/bash_guard.py`:

```python
#!/usr/bin/env python3
"""
PreToolUse hook: Validate bash commands against deny list.
"""
import sys
import json
import re

DANGEROUS_PATTERNS = [
    r'rm\s+-rf\s+/',        # Recursive delete from root
    r'sudo\s+',             # Sudo commands
    r'curl\s+.*\|\s*bash',  # Pipe to bash
    r'wget\s+.*\|\s*bash',  # Pipe to bash
    r'dd\s+if=',            # Disk operations
    r'mkfs\.',              # Format filesystem
    r':\(\)\{.*\}',         # Fork bombs
    r'>\s*/dev/sd',         # Write to disk devices
    r'ssh\s+',              # SSH connections
    r'scp\s+',              # SCP transfers
    r'nc\s+.*-e',           # Netcat with command execution
    r'eval\s+',             # Eval (potential injection)
]

DENIED_COMMANDS = [
    'reboot',
    'shutdown',
    'halt',
    'poweroff',
    'init 0',
    'init 6',
]

def is_dangerous(command):
    """Check if command matches dangerous patterns."""
    # Check denied commands
    for denied in DENIED_COMMANDS:
        if denied in command:
            return True, f'Denied command: {denied}'

    # Check regex patterns
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, command):
            return True, f'Dangerous pattern detected: {pattern}'

    return False, None

def main():
    event = json.loads(sys.stdin.read())

    tool_name = event.get('tool_name')
    params = event.get('parameters', {})

    if tool_name == 'Bash':
        command = params.get('command', '')
        dangerous, reason = is_dangerous(command)

        if dangerous:
            print(json.dumps({
                'allowed': False,
                'reason': f'Blocked dangerous command: {reason}'
            }))
            sys.exit(1)

    # Allow
    print(json.dumps({'allowed': True}))
    sys.exit(0)

if __name__ == '__main__':
    main()
```

Make it executable:

```bash
chmod +x .claude/hooks/bash_guard.py
```

## Example: Network Guard Hook

Prevent executor agent from accessing network:

`.claude/hooks/network_guard.py`:

```python
#!/usr/bin/env python3
"""
PreToolUse hook: Block network access for executor agent.
"""
import sys
import json
import os

def main():
    event = json.loads(sys.stdin.read())

    tool_name = event.get('tool_name')
    agent_name = os.environ.get('CLAUDE_AGENT_NAME', 'default')

    # Block network tools for executor
    if agent_name == 'executor':
        if tool_name in ['WebSearch', 'WebFetch']:
            print(json.dumps({
                'allowed': False,
                'reason': f'Executor agent cannot use {tool_name}. Use researcher agent instead.'
            }))
            sys.exit(1)

        # Block network commands in bash
        if tool_name == 'Bash':
            command = event.get('parameters', {}).get('command', '')
            network_commands = ['curl', 'wget', 'nc', 'telnet', 'ftp', 'ssh', 'scp']
            for net_cmd in network_commands:
                if net_cmd in command:
                    print(json.dumps({
                        'allowed': False,
                        'reason': f'Executor cannot run network command: {net_cmd}'
                    }))
                    sys.exit(1)

    print(json.dumps({'allowed': True}))
    sys.exit(0)

if __name__ == '__main__':
    main()
```

## Hook Configuration

Register hooks in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "name": "protect_files",
        "command": ".claude/hooks/protect_files.py",
        "description": "Prevent writes to protected paths"
      },
      {
        "name": "bash_guard",
        "command": ".claude/hooks/bash_guard.py",
        "description": "Block dangerous bash commands"
      },
      {
        "name": "network_guard",
        "command": ".claude/hooks/network_guard.py",
        "description": "Restrict network access by agent role"
      }
    ],
    "PostToolUse": [
      {
        "name": "audit_log",
        "command": ".claude/hooks/audit_log.py",
        "description": "Log all tool usage for debugging"
      }
    ]
  }
}
```

## Hook Input Format

Hooks receive a JSON object on stdin:

```json
{
  "tool_name": "Write",
  "parameters": {
    "file_path": "/path/to/file",
    "content": "..."
  },
  "agent": "executor",
  "run_id": "20260205_103045"
}
```

Environment variables:

```bash
CLAUDE_AGENT_NAME=executor
CLAUDE_RUN_ID=20260205_103045
CLAUDE_TOOL_NAME=Write
```

## Hook Output Format

Hooks must output JSON:

**Allow**:
```json
{
  "allowed": true
}
```

**Block**:
```json
{
  "allowed": false,
  "reason": "Human-readable explanation"
}
```

Exit codes:
- `0`: Allowed
- `1`: Blocked

## Example: Audit Log Hook

`.claude/hooks/audit_log.py`:

```python
#!/usr/bin/env python3
"""
PostToolUse hook: Log all tool usage.
"""
import sys
import json
import os
from datetime import datetime

def main():
    event = json.loads(sys.stdin.read())

    log_file = '.claude/audit.jsonl'
    os.makedirs(os.path.dirname(log_file), exist_ok=True)

    log_entry = {
        'timestamp': datetime.utcnow().isoformat(),
        'tool': event.get('tool_name'),
        'agent': os.environ.get('CLAUDE_AGENT_NAME'),
        'run_id': os.environ.get('CLAUDE_RUN_ID'),
        'parameters': event.get('parameters'),
        'success': event.get('success'),
    }

    with open(log_file, 'a') as f:
        f.write(json.dumps(log_entry) + '\n')

    # PostToolUse hooks don't block
    print(json.dumps({'allowed': True}))
    sys.exit(0)

if __name__ == '__main__':
    main()
```

This creates `.claude/audit.jsonl`:

```json
{"timestamp": "2026-02-05T10:30:00Z", "tool": "Read", "agent": "planner", "run_id": "20260205_103045", "parameters": {"file_path": "src/auth.js"}, "success": true}
{"timestamp": "2026-02-05T10:31:00Z", "tool": "Write", "agent": "executor", "run_id": "20260205_103045", "parameters": {"file_path": "src/auth.js"}, "success": true}
```

## Hooks vs Prompt Instructions

| Aspect | Prompts | Hooks |
|--------|---------|-------|
| Enforcement | Probabilistic | Deterministic |
| Bypass risk | High | None (system-level) |
| Error messages | Generic | Specific |
| Performance | No overhead | Minimal overhead |
| Debugging | Hard (hidden in context) | Easy (logs, exit codes) |
| Trust | "Hope it works" | "Know it works" |

For safety-critical rules, always use hooks.

## Hook Development Tips

**Fast execution**: Hooks run on every tool call. Keep them under 100ms.

**Clear errors**: When blocking, explain why. "Blocked" is useless. "Blocked write to .env (protected file)" is actionable.

**Fail safe**: If hook crashes, Claude blocks the tool. Better safe than sorry.

**Test thoroughly**: Write unit tests for hooks. They're code.

**Log everything**: In PostToolUse hooks, log to `.claude/audit.jsonl`. Invaluable for debugging.

## Example: Coverage Guard Hook

Prevent commits that reduce test coverage:

`.claude/hooks/coverage_guard.py`:

```python
#!/usr/bin/env python3
"""
PreToolUse hook: Block git commits if coverage decreased.
"""
import sys
import json
import subprocess

def get_coverage():
    """Run tests and extract coverage percentage."""
    result = subprocess.run(
        ['pytest', '--cov=src', '--cov-report=json'],
        capture_output=True,
        text=True
    )

    with open('coverage.json') as f:
        data = json.load(f)

    return data['totals']['percent_covered']

def main():
    event = json.loads(sys.stdin.read())

    tool_name = event.get('tool_name')
    params = event.get('parameters', {})

    if tool_name == 'Bash':
        command = params.get('command', '')

        # Detect git commit
        if 'git commit' in command:
            # Check if baseline exists
            baseline_file = '.claude/baseline_coverage.txt'
            if not os.path.exists(baseline_file):
                # No baseline, allow
                print(json.dumps({'allowed': True}))
                sys.exit(0)

            with open(baseline_file) as f:
                baseline = float(f.read().strip())

            current = get_coverage()

            if current < baseline:
                print(json.dumps({
                    'allowed': False,
                    'reason': f'Coverage decreased: {baseline}% → {current}%'
                }))
                sys.exit(1)

    print(json.dumps({'allowed': True}))
    sys.exit(0)

if __name__ == '__main__':
    main()
```

## Common Hook Patterns

**File protection**: Block writes to sensitive paths
**Command validation**: Regex against dangerous bash patterns
**Role enforcement**: Restrict tools by agent name
**Rate limiting**: Prevent excessive API calls
**Audit logging**: Record all tool usage
**Quality gates**: Block commits on test/lint failures
