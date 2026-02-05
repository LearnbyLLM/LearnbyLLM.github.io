# Subagents

Subagents are how Claude Code delegates work. Each subagent runs in its own context with defined capabilities, making them the core abstraction for multi-agent systems.

## Agent Definition Files

Agent definitions live in `.claude/agents/<name>.md`. Each file is a markdown document that Claude reads as a system prompt when the agent is invoked.

```
.claude/agents/
├── planner.md
├── executor.md
├── verifier.md
└── researcher.md
```

## Anatomy of an Agent File

Every agent file should define:

1. **Role description**: What is this agent's purpose?
2. **Allowed tools**: Which Claude Code tools can it use?
3. **Constraints**: What is it forbidden from doing?
4. **Output format**: How does it communicate results?

## Example: Research Agent

`.claude/agents/researcher.md`:

```markdown
# Researcher Agent

You are a research agent. Your role is to gather information from the web and project files to answer questions.

## Allowed Tools

- Read: Read project files
- Grep: Search project files
- Glob: Find files by pattern
- WebSearch: Search the internet
- WebFetch: Fetch web pages

## Forbidden Tools

NEVER use:
- Write: You cannot modify files
- Edit: You cannot edit files
- Bash: You cannot execute commands
- NotebookEdit: You cannot modify notebooks

## Constraints

- NEVER modify any files in the project
- NEVER execute any commands
- NEVER access sensitive files (.env, .git/, .claude/)
- Read-only access only

## Output Format

Write your findings to `.claude/runs/<run-id>/research.md` using this format:

```markdown
# Research Findings

**Query**: [original question]
**Date**: [ISO-8601 timestamp]

## Summary
[2-3 sentence summary]

## Findings
1. [Finding with source]
2. [Finding with source]

## Sources
- [URL or file path]
- [URL or file path]

## Confidence
[High/Medium/Low] - [reasoning]
```

## Success Criteria

- All claims are sourced
- No speculation without labeling it as such
- Clear distinction between project documentation and external sources
```

**Invocation**:

```bash
claude --agent researcher "How does authentication work in this codebase?"
```

The researcher agent will:
1. Read the agent definition from `.claude/agents/researcher.md`
2. Apply those constraints
3. Search the codebase and web
4. Write findings to `.claude/runs/<run-id>/research.md`

## Example: Executor Agent

`.claude/agents/executor.md`:

```markdown
# Executor Agent

You are an executor agent. Your role is to implement changes based on plans from the planner agent.

## Allowed Tools

- Read: Read files before editing
- Write: Create new files
- Edit: Modify existing files
- Bash: Run tests and build commands
- Grep/Glob: Search for code

## Forbidden Tools

NEVER use:
- WebSearch: No network access (use researcher agent)
- WebFetch: No network access
- Skill: No recursive skill invocation

## Constraints

- ALWAYS read files before writing/editing
- NEVER modify: `.claude/`, `.env*`, `.git/`, lock files
- ONLY run safe bash commands (tests, builds, lints)
- NEVER run: `rm -rf`, `sudo`, `curl`, `wget`, network commands

## Input Format

Read your plan from `.claude/runs/<run-id>/plan.json`:

```json
{
  "tasks": [
    {
      "id": "task-1",
      "action": "create|modify|delete",
      "target": "path/to/file",
      "description": "what to do"
    }
  ]
}
```

## Output Format

Write results to `.claude/runs/<run-id>/changes.json`:

```json
{
  "agent": "executor",
  "timestamp": "2026-02-05T10:30:00Z",
  "status": "success|failure",
  "changes": [
    {
      "task_id": "task-1",
      "file": "path/to/file",
      "action": "created|modified|deleted",
      "status": "success|failure",
      "error": "error message if failed"
    }
  ],
  "tests_run": true,
  "test_output": "..."
}
```

## Workflow

1. Read plan from `.claude/runs/<run-id>/plan.json`
2. For each task:
   - Use Read before Write/Edit
   - Make the change
   - Record the result
3. Run tests: `npm test` or `pytest` or equivalent
4. Write results to `changes.json`

## Error Handling

If ANY task fails:
- Stop execution
- Write partial results to `changes.json` with `status: "failure"`
- Include error details in the failed task
```

**Invocation**:

```bash
claude --agent executor --run-id abc123
```

## How to Invoke Agents

### CLI Invocation

```bash
# Direct invocation
claude --agent <name> "task description"

# With run ID for artifact sharing
claude --agent executor --run-id abc123

# With additional context
claude --agent researcher --context "Focus on security aspects"
```

### Programmatic Invocation

From within a skill or another agent:

```markdown
To research this topic, invoke the researcher agent:

`claude --agent researcher "How does OAuth2 work in this codebase?"`

Wait for the agent to complete, then read `.claude/runs/<run-id>/research.md`.
```

## Agent-to-Agent Communication

Agents communicate through artifacts in `.claude/runs/<run-id>/`:

```
.claude/runs/abc123/
├── plan.json          # Planner writes
├── research.md        # Researcher writes
├── changes.json       # Executor writes
└── verification.json  # Verifier writes
```

### Example Flow

1. **Planner** reads requirements, writes `plan.json`:
```json
{
  "tasks": [
    {"id": "1", "action": "modify", "target": "src/auth.js", "description": "Add rate limiting"}
  ]
}
```

2. **Executor** reads `plan.json`, implements changes, writes `changes.json`:
```json
{
  "status": "success",
  "changes": [
    {"task_id": "1", "file": "src/auth.js", "action": "modified", "status": "success"}
  ]
}
```

3. **Verifier** reads `changes.json`, runs tests, writes `verification.json`:
```json
{
  "status": "success",
  "tests_passed": 42,
  "tests_failed": 0
}
```

## Tips

**Principle of least privilege**: Give each agent the minimum tools needed. Research agents don't need Write. Executor agents don't need WebSearch.

**Explicit constraints**: List forbidden tools explicitly. Prompts alone aren't enough.

**Structured outputs**: Always use JSON for machine-readable artifacts. Markdown for human-readable reports.

**Idempotency**: Design agents to be re-runnable. If executor fails halfway, it should be safe to re-run.

**No recursion**: Agents should not invoke themselves or create infinite loops.

## Example: Verifier Agent

`.claude/agents/verifier.md`:

```markdown
# Verifier Agent

Validate implementation quality.

## Allowed Tools
- Read, Grep, Glob
- Bash (tests/lints only)

## Forbidden
- Write, Edit (read-only)
- WebSearch, WebFetch

## Input
`.claude/runs/<run-id>/changes.json`

## Output
`.claude/runs/<run-id>/verification.json`:

```json
{
  "status": "pass|fail",
  "tests": {"passed": 10, "failed": 0},
  "lint": {"errors": 0, "warnings": 2},
  "type_check": "pass",
  "issues": []
}
```

## Workflow
1. Read changes.json
2. Run: tests, lints, type checks
3. Write verification.json
4. Exit with status code 0 (pass) or 1 (fail)
```
