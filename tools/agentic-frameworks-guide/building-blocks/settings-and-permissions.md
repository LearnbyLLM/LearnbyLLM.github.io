# Settings & Permissions

`settings.json` controls what Claude can and cannot do. Together with the native sandbox, it defines the enforcement boundary for your multi-agent system — the rules that hold no matter what the model decides.

## Settings Files & Precedence

Settings resolve in this order (highest wins):

```
Managed policy settings (org-deployed, cannot be overridden)
  ↓
CLI arguments (session overrides, e.g. --permission-mode)
  ↓
.claude/settings.local.json (project-local, gitignored)
  ↓
.claude/settings.json (project, shared via git)
  ↓
~/.claude/settings.json (user)
```

A deny rule at *any* level blocks the action — a project allow can't override a user-level deny, and nothing overrides managed settings. For agentic frameworks: put your framework's guardrails in project `.claude/settings.json` (versioned, reviewed), personal tweaks in `settings.local.json`.

## Basic Structure

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "model": "claude-opus-4-8",
  "permissions": {
    "defaultMode": "default",
    "allow": ["Bash(npm run *)", "Read(~/.zshrc)"],
    "ask": ["Bash(git push *)"],
    "deny": ["Read(//**/.env)", "Bash(curl *)"]
  },
  "env": {"DEBUG": "1"},
  "hooks": { "...": "see hooks.md" }
}
```

The `$schema` line gets you autocomplete and validation in most editors — use it. The old `allowedTools`/`deniedTools`/`networkAccess`/`bashRestrictions` keys you may see in pre-2025 write-ups never shipped in this form; permission **rules** are the real mechanism.

## Permission Rules

Rules have the form `Tool` or `Tool(specifier)`, sorted into three lists:

- **allow**: use without prompting
- **ask**: always prompt
- **deny**: block outright

Evaluation order is deny → ask → allow; first match wins, regardless of specificity.

### Rule Syntax

| Rule | Effect |
|------|--------|
| `Bash(npm run build)` | Exact command |
| `Bash(npm run *)` | Prefix glob. The space before `*` is a word boundary: `Bash(ls *)` matches `ls -la`, not `lsof` |
| `Bash` or `Bash(*)` | All Bash commands |
| `Read(./.env)` | Specific file, relative to cwd |
| `Read(//**/.env)` | Any `.env` anywhere on the filesystem (`//` = absolute root) |
| `Edit(/src/**/*.ts)` | Relative to project root (single `/`) |
| `Read(~/.config/*)` | Home-relative |
| `WebFetch(domain:github.com)` | Fetches to one domain |
| `mcp__github__*` | All tools from the `github` MCP server |
| `Agent(researcher)` | Spawning a specific subagent |
| `Skill(deploy *)` | Invoking a specific skill (with any args) |

Two sharp edges worth knowing. First, `Bash(curl http://github.com/ *)`-style argument constraints are fragile (flags, redirects, variables all evade them) — deny `curl`/`wget` and grant `WebFetch(domain:...)` instead, or enforce with a PreToolUse hook. Second, Claude Code splits compound commands: `Bash(safe-cmd *)` does not approve `safe-cmd && rm -rf .`; each subcommand must match a rule.

## Permission Modes

Set via `permissions.defaultMode`, the `/permissions` UI, `--permission-mode` on the CLI, or per-subagent `permissionMode` frontmatter:

| Mode | Behavior |
|------|----------|
| `default` | Prompt on first use of each tool |
| `acceptEdits` | Auto-accept file edits and filesystem commands in the working directory |
| `plan` | Read-only exploration; no edits |
| `auto` | Auto-approve with background safety checks (research preview) |
| `dontAsk` | Auto-deny everything not pre-approved by allow rules |
| `bypassPermissions` | Skip prompts entirely (explicit `ask` rules and `rm -rf /`-class circuit breakers still prompt) |

For pipelines: give the executor `permissionMode: acceptEdits`, keep the planner in `plan`. Reserve `bypassPermissions` for containers/VMs, and note orgs can disable it (`permissions.disableBypassPermissionsMode: "disable"`).

## Example: Agentic Framework Settings

`.claude/settings.json`:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "defaultMode": "default",
    "allow": [
      "Bash(npm test *)",
      "Bash(npm run lint)",
      "Bash(npm run build)",
      "Bash(pytest *)",
      "Bash(cargo test *)",
      "Edit(/src/**)",
      "Edit(/tests/**)",
      "Skill(agentic-run *)",
      "Skill(deep-research *)"
    ],
    "ask": [
      "Bash(git push *)",
      "Bash(npm publish *)"
    ],
    "deny": [
      "Read(//**/.env)",
      "Read(~/.ssh/**)",
      "Edit(/.claude/**)",
      "Edit(//**/.env)",
      "Bash(sudo *)",
      "Bash(curl *)",
      "Bash(wget *)",
      "Agent(Explore)"
    ]
  },
  "sandbox": {
    "enabled": true
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/bash_guard.py"}
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

Note what's *not* here: per-agent tool restrictions. Those moved into each agent's frontmatter (`tools`, `disallowedTools`, `permissionMode`) — see [Subagents](subagents.md). Settings rules apply session-wide; agent frontmatter scopes restrictions to one role. `Agent(name)` deny rules are the settings-side lever: they control which subagents can be spawned at all.

## The Native Sandbox

Claude Code now ships OS-level sandboxing for Bash — filesystem and network isolation applied to commands and their child processes, which permission rules alone can't reach (a Python script that opens `.env` itself bypasses `Read` deny rules; the sandbox doesn't care).

```json
{
  "sandbox": {
    "enabled": true,
    "filesystem": {
      "allowRead": ["/tmp"],
      "denyRead": ["~/.ssh"],
      "allowWrite": ["/tmp"],
      "denyWrite": ["~/.ssh"]
    },
    "network": {
      "allowedDomains": ["github.com", "registry.npmjs.org"],
      "deniedDomains": ["internal.company.local"]
    },
    "autoAllowBashIfSandboxed": true
  }
}
```

Sandbox filesystem bounds merge with your `Read`/`Edit` deny rules; network bounds merge with `WebFetch(domain:...)` rules. With `autoAllowBashIfSandboxed: true` (the default), sandboxed Bash commands run without prompting — the sandbox boundary replaces the prompt. This is the single biggest UX win for agentic work: the executor runs freely *inside* the box instead of asking permission to do anything.

This replaces the old advice to set `"networkAccess": false` (a setting that never existed). Network control is sandbox `allowedDomains` + Bash deny rules for `curl`/`wget` + `WebFetch(domain:...)` allow rules.

## Per-Agent Restrictions

The old pattern of an `"agents": {...}` block in settings.json is not a real mechanism. Role-based restriction lives in three real places:

**Agent frontmatter** (`.claude/agents/executor.md`):
```yaml
---
name: executor
tools: Read, Write, Edit, Bash, Grep, Glob
disallowedTools: WebSearch, WebFetch
permissionMode: acceptEdits
---
```

**Settings**, to control which agents exist at all:
```json
{
  "permissions": {
    "deny": ["Agent(Explore)"]
  }
}
```

**Hooks in agent frontmatter**, for conditional rules (allow some Bash commands, block others) — see [Hooks](hooks.md).

## How Permissions Interact with Agent Definitions

Belt-and-suspenders, three layers:

1. **Prompt** (agent markdown body): "never touch `.env`" — probabilistic, shapes intent
2. **Permissions + frontmatter** (`deny` rules, `tools` allowlist): enforced by Claude Code on every tool call
3. **Sandbox + hooks**: OS-level and programmatic enforcement, covers what rules can't express

Even if the agent "forgets" the prompt, layers 2 and 3 hold. Permission rules are enforced by the client, not the model — nothing in CLAUDE.md or a system prompt can loosen them.

## Other Settings Worth Knowing

`settings.json` has grown to 50+ keys. Beyond `permissions`, `sandbox`, and `hooks`, the ones that matter for agentic frameworks:

| Key | What it does |
|-----|--------------|
| `model` | Default model for the session (Opus 4.8 / `claude-opus-4-8` is the current default; Sonnet 4.6, Haiku 4.5, and Fable 5 / `claude-fable-5` are also available) |
| `env` | Environment variables for every session — handy for `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` and friends |
| `autoMemoryEnabled` | Claude's self-maintained per-project memory (default `true`) |
| `claudeMdExcludes` | Glob patterns of CLAUDE.md files to skip (monorepos) |
| `additionalDirectories` | Extra directories Claude may access (under `permissions`) |
| `allowedMcpServers` / `deniedMcpServers` | MCP server allow/deny lists |
| `skillOverrides` | Adjust skill visibility without editing SKILL.md files |

Org admins get managed-only keys like `allowManagedPermissionRulesOnly`, `allowManagedHooksOnly`, and `strictPluginOnlyCustomization` (block skills/agents/hooks from user and project sources entirely) — relevant if you're deploying an agentic framework across a team.

## Example: Locked-Down Executor Project

A fuller project settings file for a pipeline where agents do real work unattended:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "defaultMode": "default",
    "allow": [
      "Bash(npm test *)",
      "Bash(npm run *)",
      "Bash(pytest *)",
      "Edit(/src/**)",
      "Edit(/tests/**)",
      "Edit(/.claude/runs/**)",
      "WebFetch(domain:docs.python.org)",
      "Agent(planner)",
      "Agent(executor)",
      "Agent(verifier)",
      "Agent(researcher)"
    ],
    "ask": [
      "Bash(git push *)"
    ],
    "deny": [
      "Read(//**/.env)",
      "Read(~/.ssh/**)",
      "Read(~/.aws/**)",
      "Edit(/.claude/settings.json)",
      "Edit(/.claude/agents/**)",
      "Edit(/.claude/hooks/**)",
      "Bash(sudo *)",
      "Bash(curl *)",
      "Bash(wget *)",
      "Bash(ssh *)",
      "Bash(scp *)"
    ]
  },
  "sandbox": {
    "enabled": true,
    "network": {
      "allowedDomains": ["registry.npmjs.org", "pypi.org"]
    }
  },
  "hooks": {
    "PreToolUse": [
      {"matcher": "Bash", "hooks": [
        {"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/bash_guard.py"}
      ]}
    ],
    "PostToolUse": [
      {"matcher": "*", "hooks": [
        {"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/audit_log.py", "async": true}
      ]}
    ],
    "SubagentStop": [
      {"matcher": "*", "hooks": [
        {"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/audit_log.py", "async": true}
      ]}
    ]
  }
}
```

Notice the self-protection deny rules: agents can't edit the settings, agent definitions, or hooks that constrain them. That closes the most embarrassing failure mode in agentic systems — the agent that "fixes" its own guardrails.

## Runtime Flags

Real CLI overrides (these sit above project/user settings, below managed policy):

```bash
# Add allow/deny rules for one session
claude --allowedTools "Bash(npm test *)"
claude --disallowedTools "Agent(Explore)" "WebFetch"

# Set the permission mode
claude --permission-mode plan

# Define one-off subagents as JSON (testing)
claude --agents '{"reviewer": {"description": "...", "prompt": "..."}}'

# Skip all permission checks — containers/CI only
claude --dangerously-skip-permissions
```

Flags like `--allow-network`, `--deny-tool`, and `--no-sandbox` from older write-ups don't exist. Use settings files for anything permanent — they're version controlled and reviewed.

## Tips

**Start restrictive**: Begin in `default` mode with a tight allow list. Widen as friction demands, not preemptively.

**Version control settings**: Track `.claude/settings.json` in git. Review changes like code — a loosened deny rule is a security diff.

**Deny by path, not by hope**: `Read(//**/.env)` and `Edit(/.claude/**)` deny rules are one line each. Write them before you need them.

**Sandbox first, prompts second**: `sandbox.enabled: true` removes most permission prompts *and* most risk at the same time. It should be your default for executor-style agents.

**Mind the deny-anywhere rule**: any scope's deny wins. If an agent mysteriously can't do something, run `/permissions` to see every rule and which file it came from.

**Audit regularly**: Review `.claude/audit.jsonl` (from your PostToolUse hook) to see what agents actually do, then tighten rules around reality instead of guesses.

Full reference: [code.claude.com/docs/en/settings](https://code.claude.com/docs/en/settings) and [code.claude.com/docs/en/permissions](https://code.claude.com/docs/en/permissions)
