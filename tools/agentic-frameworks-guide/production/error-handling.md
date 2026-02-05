# Error Handling

Agent failures propagate differently than traditional function errors. An agentic system has multiple autonomous components, each with its own failure modes. Understanding how failures occur and how to handle them is critical for production use.

## Failure Modes

Four primary failure modes:

1. **Planner produces bad plan** - Too vague, too broad, or missing safety constraints
2. **Executor hits an error** - Tool fails, permission denied, scope expansion attempt
3. **Verifier rejects execution** - FAIL verdict for any reason
4. **Researcher finds conflicting information** - Contradictory sources or no data

Each requires different handling.

## Planner Failures

A bad plan is worse than no plan. Common planner failures:

**Too vague:**

```markdown
# Plan: Fix the bug

## Steps
1. Find the bug
2. Fix it
3. Test
```

This plan gives the executor no concrete guidance. The executor will have to make decisions that should be the planner's responsibility.

**Too broad scope:**

```markdown
# Plan: Refactor entire codebase

## Steps
1. Rewrite authentication system
2. Migrate database to Postgres
3. Add GraphQL API
4. Update all tests
```

This plan tries to do too much in one run. It should be split into multiple focused runs.

**Missing safety constraints:**

```markdown
# Plan: Clean up old files

## Steps
1. Delete all .log files
2. Delete all .tmp files
3. Delete unused dependencies
```

This plan doesn't specify what "old" means or how to determine "unused". The executor might delete important files.

**Solution: Add verification criteria to catch bad plans.**

Update your planner agent definition:

```markdown
# Planner Agent

## Output Requirements

Every plan MUST include:

1. **Concrete steps** - Each step must be specific and actionable
2. **Scope limits** - Explicitly state what is OUT of scope
3. **Safety constraints** - Define what must NOT be modified
4. **Success criteria** - Measurable verification points

If you cannot produce a plan meeting these requirements, output CANNOT_PLAN with reasoning.
```

Example of a good plan with verification criteria:

```markdown
# Plan: Clean up old log files

## Scope
Delete log files older than 30 days in /var/log/app/ directory only

## Safety Constraints
- DO NOT delete files in /var/log/system/
- DO NOT delete files modified in the last 30 days
- DO NOT delete files with extension other than .log

## Steps
1. List files in /var/log/app/ with .log extension
2. Filter to files with mtime > 30 days
3. Show list to user for approval
4. Delete approved files
5. Verify deletion

## Success Criteria
- Only .log files older than 30 days are deleted
- No files in /var/log/system/ are touched
- User approved the deletion list
```

## Executor Failures

The executor runs the plan. When it hits an error, it must stop and report, not work around the problem.

**Tool errors:**

```markdown
## Step 3: Install package
Tool: Bash
Command: npm install nonexistent-package
Result: FAILED - package not found
```

The executor should stop here and report the failure. It should not try alternative packages or change the plan.

**Permission denied:**

```markdown
## Step 2: Modify system file
Tool: Edit
File: /etc/hosts
Result: FAILED - Permission denied
```

The executor should not try to use sudo or work around permissions. It should report the failure and let the user decide how to proceed.

**Scope expansion attempt:**

```markdown
## Step 4: Update tests
Tool: Read
File: /project/tests/auth.test.js
Result: Found that login tests also need updating (not in plan)
Action: STOPPING - scope expansion detected
```

Good executor behavior. It noticed work outside the plan's scope and stopped instead of doing extra work.

**Executor agent definition should enforce this:**

```markdown
# Executor Agent

## Constraints

- Execute ONLY the steps in the plan
- If a step fails, STOP immediately and report the failure
- DO NOT work around errors or try alternative approaches
- DO NOT expand scope beyond the plan
- If you encounter unexpected work, STOP and report

## Output Format

For each step:
- Step number and description
- Tool used
- Result: SUCCESS or FAILED
- If FAILED, stop execution and report
```

## Verifier Failures

A FAIL verdict means the verifier found issues with the execution. This is not necessarily a bad thing - it's the safety check working.

Example `verdict.md` with FAIL:

```markdown
# Verdict: FAIL

## Verification Results

- Authentication works: PASS
- Tests pass: PASS
- Security check: FAIL - password stored in plaintext in logs

## Issues Found

Line 45 of auth.js logs the raw password:
```js
console.log('Login attempt:', { username, password });
```

This is a security vulnerability.

## Recommendation

Remove password from log statement and re-verify.
```

**Handling a FAIL verdict:**

1. Read the verdict to understand the issue
2. Decide: re-plan or escalate to user
3. If re-planning, create a new focused plan to fix the specific issue
4. If escalating, show the verdict to the user

Example re-plan flow:

```bash
# Original run failed
cat .claude/runs/2025-02-05-add-auth/verdict.md
# Verdict: FAIL - password in logs

# Create focused fix plan
claude-code --agent planner \
  --context "Previous run 2025-02-05-add-auth failed verification: password logged in plaintext. Plan fix." \
  --run-id 2025-02-05-fix-auth-logging

# Execute the fix
claude-code --agent executor \
  --plan .claude/runs/2025-02-05-fix-auth-logging/plan.md \
  --run-id 2025-02-05-fix-auth-logging

# Verify again
claude-code --agent verifier \
  --execution .claude/runs/2025-02-05-fix-auth-logging/execution.md \
  --run-id 2025-02-05-fix-auth-logging
```

## Research Failures

The researcher agent can fail in two ways:

**Contradictory sources:**

```markdown
# Research: Best caching strategy

## Sources

Source 1 (Redis docs): "Redis is best for caching due to in-memory speed"
Source 2 (Memcached docs): "Memcached is faster than Redis for simple caching"
Source 3 (Blog): "Don't use Redis or Memcached, use CDN caching"

## Finding: CONTRADICTORY

The sources disagree on the best approach. Recommendation: User should decide based on specific requirements.
```

**No information found:**

```markdown
# Research: Obscure API compatibility

## Sources Searched

- Official documentation (nothing found)
- GitHub issues (no relevant discussions)
- Stack Overflow (no questions on this topic)

## Finding: INSUFFICIENT_DATA

Cannot find information about compatibility between LibraryX v2.0 and LibraryY v3.0.
```

**Researcher agent should report uncertainty explicitly:**

```markdown
# Researcher Agent

## Output Requirements

When sources disagree: Output CONTRADICTORY with summary of each position
When no data found: Output INSUFFICIENT_DATA with sources searched
When confident: Output CONFIDENT with synthesized finding

DO NOT:
- Choose one source arbitrarily when sources disagree
- Make up information when data is missing
- Present uncertain findings as confident
```

## Retry Strategies

When to retry vs when to escalate:

**Retry if:**
- Transient network error (API timeout, DNS failure)
- Resource temporarily unavailable (file locked, rate limit)
- Non-deterministic test failure (flaky test)

**Escalate if:**
- Plan is fundamentally flawed (bad approach)
- Permission or access issue (can't be auto-resolved)
- Verifier finds correctness issue (logic bug)
- Researcher can't find needed information

**Simple retry wrapper:**

```python
# .claude/scripts/retry_run.py
import subprocess
import sys
import time

def run_with_retry(command, max_retries=3):
    for attempt in range(max_retries):
        result = subprocess.run(command, shell=True)

        if result.returncode == 0:
            return 0

        # Check if error is retryable
        # (In real implementation, parse error output)
        if attempt < max_retries - 1:
            print(f"Attempt {attempt + 1} failed, retrying...")
            time.sleep(2 ** attempt)  # Exponential backoff
        else:
            print(f"All {max_retries} attempts failed")
            return 1

if __name__ == "__main__":
    sys.exit(run_with_retry(sys.argv[1]))
```

## Anti-Patterns

**Silently swallowing errors:**

```markdown
## Step 3: Run tests
Tool: Bash
Command: npm test
Result: 2 tests failed
Action: Continuing anyway...  # BAD - should stop
```

**Reducing scope to "make it work":**

```markdown
## Step 4: Update all routes
Tool: Edit
File: /project/src/routes/users.js
Result: Updated 3 routes
Note: Skipped /admin routes because they were complex  # BAD - scope change
```

**Working around errors without reporting:**

```markdown
## Step 2: Install package
Tool: Bash
Command: npm install typescript
Result: Permission denied
Action: Used npx instead  # BAD - should report and stop
```

Always fail loudly and explicitly. The user or orchestration layer should decide how to handle failures, not individual agents.
