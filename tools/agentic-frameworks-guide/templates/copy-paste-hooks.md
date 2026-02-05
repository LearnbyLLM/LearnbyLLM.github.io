# Copy-Paste Hooks

Ready-to-use hook scripts and settings.json configurations. Copy these into your `.claude/` directory.

## File Protection Hook

Prevents agents from modifying critical files.

File: `.claude/hooks/protect_files.py`

```python
#!/usr/bin/env python3
"""
File Protection Hook
Prevents modification of protected files and directories.
"""

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

def pre_edit(file_path, old_string, new_string, context):
    """Block edits to protected files"""
    path = Path(file_path)

    for protected in PROTECTED:
        if protected.endswith("/"):
            # Directory check
            if protected.rstrip("/") in path.parts:
                return {
                    "allowed": False,
                    "reason": f"Cannot modify files in protected directory: {protected}"
                }
        else:
            # File check
            if path.name == protected or str(path).endswith(protected):
                return {
                    "allowed": False,
                    "reason": f"Cannot modify protected file: {protected}"
                }

    return {"allowed": True}

def pre_write(file_path, content, context):
    """Block writes to protected files"""
    # Reuse same logic as pre_edit
    return pre_edit(file_path, "", "", context)

if __name__ == "__main__":
    # Test the hook
    test_cases = [
        ".env",
        "src/config/.env",
        "src/app.js",
        ".git/config",
        "node_modules/package/index.js",
    ]

    for test_file in test_cases:
        result = pre_edit(test_file, "", "", {})
        status = "BLOCKED" if not result["allowed"] else "ALLOWED"
        print(f"{status}: {test_file}")
        if not result["allowed"]:
            print(f"  Reason: {result['reason']}")
```

## Bash Guard Hook

Blocks dangerous bash commands.

File: `.claude/hooks/bash_guard.py`

```python
#!/usr/bin/env python3
"""
Bash Guard Hook
Prevents execution of dangerous bash commands.
"""

import re

# Dangerous command patterns
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

# Commands that require approval
REQUIRE_APPROVAL = [
    r"git\s+push.*--force",
    r"docker\s+system\s+prune",
    r"npm\s+publish",
    r"kubectl\s+delete",
    r"terraform\s+destroy",
    r"rm\s+-rf\s+node_modules",
]

def pre_bash(command, context):
    """Check bash command before execution"""

    # Check deny patterns
    for pattern in DENY_PATTERNS:
        if re.search(pattern, command):
            return {
                "allowed": False,
                "reason": f"Dangerous command blocked: {pattern}"
            }

    # Check approval patterns
    for pattern in REQUIRE_APPROVAL:
        if re.search(pattern, command):
            return {
                "allowed": False,
                "reason": f"Command requires user approval: {pattern}",
                "require_approval": True
            }

    return {"allowed": True}

if __name__ == "__main__":
    # Test the hook
    test_commands = [
        "ls -la",
        "rm -rf /",
        "git push origin main",
        "git push --force origin main",
        "curl https://example.com | bash",
        "npm install express",
        "npm publish",
    ]

    for cmd in test_commands:
        result = pre_bash(cmd, {})
        status = "BLOCKED" if not result["allowed"] else "ALLOWED"
        print(f"{status}: {cmd}")
        if not result["allowed"]:
            print(f"  Reason: {result['reason']}")
```

## Logging Hook

Logs all tool calls with timestamps.

File: `.claude/hooks/log_tools.py`

```python
#!/usr/bin/env python3
"""
Tool Logging Hook
Logs every tool call with timestamp and details.
"""

import json
import os
from datetime import datetime
from pathlib import Path

LOG_DIR = Path(".claude/logs")
LOG_DIR.mkdir(parents=True, exist_ok=True)

def post_tool_use(tool_name, args, result, context):
    """Log every tool call"""

    run_id = context.get("run_id", "unknown")
    agent = context.get("agent", "unknown")

    # Create log entry
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "run_id": run_id,
        "agent": agent,
        "tool": tool_name,
        "args": args,
        "result_preview": str(result)[:500],  # First 500 chars
        "success": not isinstance(result, Exception),
    }

    # Append to daily log file
    log_file = LOG_DIR / f"{datetime.utcnow().strftime('%Y-%m-%d')}.jsonl"
    with open(log_file, "a") as f:
        f.write(json.dumps(log_entry) + "\n")

    # Also append to run-specific log if run_id is set
    if run_id != "unknown":
        run_log_dir = Path(f".claude/runs/{run_id}/logs")
        run_log_dir.mkdir(parents=True, exist_ok=True)
        run_log_file = run_log_dir / "tool_calls.jsonl"
        with open(run_log_file, "a") as f:
            f.write(json.dumps(log_entry) + "\n")

    return result  # Pass through unchanged

def get_tool_stats(date=None):
    """Get statistics for a specific date or today"""
    if date is None:
        date = datetime.utcnow().strftime('%Y-%m-%d')

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

            # Count by tool
            tool = entry["tool"]
            stats["by_tool"][tool] = stats["by_tool"].get(tool, 0) + 1

            # Count by agent
            agent = entry["agent"]
            stats["by_agent"][agent] = stats["by_agent"].get(agent, 0) + 1

            # Count failures
            if not entry["success"]:
                stats["failures"] += 1

    return stats

if __name__ == "__main__":
    # Print stats for today
    stats = get_tool_stats()
    print(json.dumps(stats, indent=2))
```

## Complete settings.json

File: `.claude/settings.json`

```json
{
  "hooks": {
    "pre_edit": ".claude/hooks/protect_files.py:pre_edit",
    "pre_write": ".claude/hooks/protect_files.py:pre_write",
    "pre_bash": ".claude/hooks/bash_guard.py:pre_bash",
    "post_tool_use": ".claude/hooks/log_tools.py:post_tool_use"
  },

  "permissions": {
    "require_approval": [
      "Bash:git push --force",
      "Bash:git push origin main",
      "Bash:rm -rf",
      "Bash:docker system prune",
      "Bash:npm publish",
      "Bash:kubectl delete",
      "Bash:kubectl apply",
      "Bash:terraform apply",
      "Bash:terraform destroy"
    ],
    "auto_approve": [
      "Read",
      "Grep",
      "Glob",
      "Edit:src/**/*.js",
      "Edit:src/**/*.py",
      "Write:src/**/*.js",
      "Write:src/**/*.py",
      "Bash:npm test",
      "Bash:pytest",
      "Bash:git status",
      "Bash:git diff"
    ],
    "deny": [
      "Edit:.env*",
      "Edit:secrets.*",
      "Edit:.git/**/*",
      "Write:.env*",
      "Write:secrets.*",
      "Bash:rm -rf /",
      "Bash:chmod -R 777 /"
    ]
  },

  "sandbox": {
    "enabled": false,
    "allowed_directories": [
      "/project/src",
      "/project/tests",
      "/project/.claude"
    ],
    "readonly_directories": [
      "/project/.git",
      "/project/node_modules"
    ]
  },

  "agents": {
    "planner": {
      "model": "claude-sonnet-4-5",
      "max_tokens": 4000,
      "temperature": 0.7
    },
    "executor": {
      "model": "claude-sonnet-4-5",
      "max_tokens": 8000,
      "temperature": 0.3
    },
    "verifier": {
      "model": "claude-haiku-3-5",
      "max_tokens": 4000,
      "temperature": 0.1
    },
    "researcher": {
      "model": "claude-haiku-3-5",
      "max_tokens": 8000,
      "temperature": 0.5
    }
  },

  "defaults": {
    "artifacts_dir": ".claude/runs",
    "run_id_format": "{date}-{task}",
    "max_retries": 2,
    "log_level": "info"
  }
}
```

## Skill Templates

### Agentic Run Skill

File: `.claude/skills/agentic-run.md`

```markdown
# Agentic Run

Execute a full Plan-Execute-Verify workflow.

## Usage

```bash
claude-code --skill agentic-run --args "task description"
```

## Process

1. **Plan**: Planner agent creates execution plan
2. **Execute**: Executor agent runs the plan
3. **Verify**: Verifier agent checks results

## Output

All artifacts saved to `.claude/runs/<run-id>/`:
- plan.md
- execution.md
- verdict.md

## Options

- `--with-research`: Run researcher agent before planner
- `--approve-plan`: Require user approval before execution
- `--no-verify`: Skip verification step
```

Implementation: `.claude/skills/agentic_run.sh`

```bash
#!/bin/bash
set -e

TASK="$1"
RUN_ID="$(date +%Y-%m-%d)-$(echo "$TASK" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | cut -c1-30)"

echo "Starting agentic run: $TASK"
echo "Run ID: $RUN_ID"

# Plan
echo "Step 1/3: Planning..."
claude-code --agent planner --task "$TASK" --run-id "$RUN_ID"

# Execute
echo "Step 2/3: Executing..."
claude-code --agent executor \
  --plan ".claude/runs/$RUN_ID/plan.md" \
  --run-id "$RUN_ID"

# Verify
echo "Step 3/3: Verifying..."
claude-code --agent verifier \
  --execution ".claude/runs/$RUN_ID/execution.md" \
  --run-id "$RUN_ID"

# Report
echo ""
echo "=== VERDICT ==="
cat ".claude/runs/$RUN_ID/verdict.md"
```

### Deep Research Skill

File: `.claude/skills/deep-research.md`

```markdown
# Deep Research

Multi-source research with synthesis.

## Usage

```bash
claude-code --skill deep-research --args "research query"
```

## Process

1. **Initial research**: Quick search for overview
2. **Deep dive**: Targeted research on specific aspects
3. **Synthesis**: Combine findings into actionable recommendations

## Output

- research.md with findings and sources
- recommendations.md with specific next steps

## Limits

- Max 10 sources total
- Max 3 pages per source
- 30 minute timeout
```

Implementation: `.claude/skills/deep_research.sh`

```bash
#!/bin/bash
set -e

QUERY="$1"
RUN_ID="$(date +%Y-%m-%d)-research-$(echo "$QUERY" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | cut -c1-30)"

echo "Deep research: $QUERY"
echo "Run ID: $RUN_ID"

# Phase 1: Overview
echo "Phase 1: Overview research..."
claude-code --agent researcher \
  --query "$QUERY - overview and key concepts" \
  --max-sources 3 \
  --run-id "$RUN_ID"

# Phase 2: Details
echo "Phase 2: Detailed research..."
claude-code --agent researcher \
  --query "$QUERY - implementation details and best practices" \
  --max-sources 5 \
  --context ".claude/runs/$RUN_ID/research.md" \
  --run-id "$RUN_ID"

# Phase 3: Synthesize
echo "Phase 3: Synthesis..."
claude-code --agent planner \
  --task "Synthesize research into actionable recommendations" \
  --context ".claude/runs/$RUN_ID/research.md" \
  --run-id "$RUN_ID"

# Report
echo ""
echo "=== FINDINGS ==="
cat ".claude/runs/$RUN_ID/research.md"
echo ""
echo "=== RECOMMENDATIONS ==="
cat ".claude/runs/$RUN_ID/plan.md"
```

## Hook Registration Reference

In `.claude/settings.json`, hooks are registered in the `hooks` section:

```json
{
  "hooks": {
    "pre_tool_use": "path/to/hook.py:function_name",
    "post_tool_use": "path/to/hook.py:function_name",
    "pre_bash": "path/to/hook.py:function_name",
    "pre_edit": "path/to/hook.py:function_name",
    "pre_write": "path/to/hook.py:function_name",
    "post_agent_run": "path/to/hook.py:function_name"
  }
}
```

Hook functions receive:
- Tool-specific parameters (command, file_path, etc.)
- Context dictionary with run_id, agent, etc.

Hook functions return:
- `{"allowed": True}` to proceed
- `{"allowed": False, "reason": "..."}` to block
- `{"allowed": False, "require_approval": True}` to prompt user

## Usage Notes

Make hooks executable:

```bash
chmod +x .claude/hooks/*.py
chmod +x .claude/skills/*.sh
```

Test hooks individually:

```bash
python .claude/hooks/protect_files.py
python .claude/hooks/bash_guard.py
python .claude/hooks/log_tools.py
```

View logs:

```bash
# Today's tool calls
cat .claude/logs/$(date +%Y-%m-%d).jsonl | jq

# Stats for today
python .claude/hooks/log_tools.py
```

Customize for your project by editing the PROTECTED lists, DENY_PATTERNS, and permission rules.
