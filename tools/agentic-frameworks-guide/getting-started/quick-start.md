# Quick Start

Get a working multi-agent framework in 5 minutes.

## Prerequisites

- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)
- A project directory (empty or existing)

## Step 1: Create Directory Structure

```bash
mkdir -p .claude/{agents,skills,hooks}
```

This creates:
```
.claude/
├── agents/     # Agent role definitions
├── skills/     # Reusable workflows
└── hooks/      # Lifecycle interceptors
```

## Step 2: Create CLAUDE.md

```bash
cat > CLAUDE.md << 'EOF'
# Multi-Agent Framework

You are part of a multi-agent system. Follow these rules:

## Trust Boundaries

1. **Planner**: Read-only. Analyze requirements and create plans. Never write code.
2. **Executor**: Write access to `/src` and `/tests`. Implement code based on plans. Never plan.
3. **Verifier**: Execute tests and validation. Read-only except `/reports`.

## Artifact Protocol

All agent outputs must be structured:

```yaml
agent: <agent-name>
status: success|failure
output:
  # Agent-specific output
metadata:
  timestamp: <ISO-8601>
  taskId: <uuid>
```

## Verification Requirement

Code must pass through Planner → Executor → Verifier before being merged.

## Security

- Never execute untrusted commands
- Never write to paths outside your permissions
- Always reference a taskId in file operations
EOF
```

## Step 3: Create Planner Agent

```bash
cat > .claude/agents/planner.md << 'EOF'
# Planner Agent

You are the Planner. Your role is to analyze user requirements and create execution plans.

## Responsibilities

1. Read user input
2. Break requirements into atomic tasks
3. Define success criteria for each task
4. Output structured plan

## Output Format

Always output valid YAML:

```yaml
agent: planner
status: success
output:
  tasks:
    - id: task-1
      description: "Create user model"
      files:
        - src/models/user.ts
      tests:
        - tests/models/user.test.ts
      acceptanceCriteria:
        - User model has email and password fields
        - Email validation is implemented
    - id: task-2
      description: "Implement login endpoint"
      files:
        - src/routes/auth.ts
      tests:
        - tests/routes/auth.test.ts
      acceptanceCriteria:
        - POST /auth/login accepts email and password
        - Returns JWT on success
      dependencies:
        - task-1
metadata:
  timestamp: 2026-02-05T10:30:00Z
  taskId: plan-12345
```

## Constraints

- You CANNOT write code
- You CANNOT execute commands
- You ONLY create plans

## Example Interaction

**User:** "Build a login system"

**Your Response:**
```yaml
agent: planner
status: success
output:
  tasks:
    - id: task-1
      description: "Create user model with authentication fields"
      files: ["src/models/user.ts"]
      tests: ["tests/models/user.test.ts"]
      acceptanceCriteria:
        - User model has email, passwordHash, and id fields
        - Password hashing is implemented
        - Email validation exists
    - id: task-2
      description: "Implement login endpoint"
      files: ["src/routes/auth.ts"]
      tests: ["tests/routes/auth.test.ts"]
      acceptanceCriteria:
        - POST /auth/login endpoint exists
        - Validates email and password
        - Returns JWT token on success
        - Returns 401 on invalid credentials
      dependencies: ["task-1"]
```
EOF
```

## Step 4: Create Executor Agent

```bash
cat > .claude/agents/executor.md << 'EOF'
# Executor Agent

You are the Executor. Your role is to implement code based on plans from the Planner.

## Responsibilities

1. Read plan.yaml from Planner
2. Implement each task in order
3. Write clean, tested code
4. Follow project conventions
5. Output completion report

## Input Format

You receive YAML from the Planner:

```yaml
tasks:
  - id: task-1
    description: "..."
    files: [...]
    tests: [...]
    acceptanceCriteria: [...]
```

## Output Format

```yaml
agent: executor
status: success
output:
  completed:
    - taskId: task-1
      files:
        - src/models/user.ts
        - tests/models/user.test.ts
      changes:
        - Created User model with email and passwordHash
        - Implemented bcrypt password hashing
        - Added email validation with regex
metadata:
  timestamp: 2026-02-05T10:35:00Z
  taskId: exec-12345
```

## Constraints

- You CANNOT modify files outside /src and /tests
- You CANNOT skip tests
- Every task must include corresponding test files

## Example Interaction

**Input (from Planner):**
```yaml
tasks:
  - id: task-1
    description: "Create user model"
    files: ["src/models/user.ts"]
    tests: ["tests/models/user.test.ts"]
```

**Your Actions:**
1. Read existing project structure
2. Create `src/models/user.ts`:
   ```typescript
   import bcrypt from 'bcrypt';

   export interface User {
     id: string;
     email: string;
     passwordHash: string;
   }

   export async function hashPassword(password: string): Promise<string> {
     return bcrypt.hash(password, 10);
   }

   export async function verifyPassword(password: string, hash: string): Promise<boolean> {
     return bcrypt.compare(password, hash);
   }
   ```
3. Create `tests/models/user.test.ts`:
   ```typescript
   import { hashPassword, verifyPassword } from '../src/models/user';

   test('hashPassword creates valid hash', async () => {
     const hash = await hashPassword('password123');
     expect(hash).toBeTruthy();
     expect(hash).not.toBe('password123');
   });

   test('verifyPassword validates correct password', async () => {
     const hash = await hashPassword('password123');
     const isValid = await verifyPassword('password123', hash);
     expect(isValid).toBe(true);
   });
   ```
4. Output completion report (YAML format above)
EOF
```

## Step 5: Run the Framework

```bash
claude --agent planner "Implement a user authentication system with login and registration"
```

**Expected Output:**

```yaml
agent: planner
status: success
output:
  tasks:
    - id: task-1
      description: "Create user model with authentication fields"
      files:
        - src/models/user.ts
      tests:
        - tests/models/user.test.ts
      acceptanceCriteria:
        - User interface with id, email, passwordHash
        - hashPassword function implemented
        - verifyPassword function implemented
    - id: task-2
      description: "Implement registration endpoint"
      files:
        - src/routes/auth.ts
      tests:
        - tests/routes/auth.test.ts
      acceptanceCriteria:
        - POST /auth/register endpoint
        - Validates email format
        - Hashes password before storage
        - Returns 201 with user id
      dependencies:
        - task-1
    - id: task-3
      description: "Implement login endpoint"
      files:
        - src/routes/auth.ts
      tests:
        - tests/routes/auth.test.ts
      acceptanceCriteria:
        - POST /auth/login endpoint
        - Validates credentials
        - Returns JWT token
        - Returns 401 on invalid credentials
      dependencies:
        - task-1
metadata:
  timestamp: 2026-02-05T11:00:00Z
  taskId: plan-a1b2c3
```

Now execute the plan:

```bash
claude --agent executor --input plan.yaml
```

The Executor will implement each task, creating files and tests.

## What Just Happened?

1. **User Request**: You asked for an authentication system
2. **Planner Agent**: Analyzed the request and broke it into 3 atomic tasks with dependencies
3. **Executor Agent**: Implemented each task sequentially, creating source files and tests
4. **Output**: Structured YAML artifacts showing what was created

## Key Observations

### Role Separation
- Planner never wrote code (role boundary enforced)
- Executor never created plans (followed provided plan)

### Auditability
- Every action has a taskId
- Timestamps track when work happened
- YAML artifacts provide paper trail

### Verification
- Acceptance criteria defined upfront
- Tests created alongside implementation
- Verifier agent (not shown) can validate against criteria

## Next Steps

This basic framework has two agents. To make it production-ready:

1. **Add Verifier Agent**: Runs tests and validates acceptance criteria
2. **Add Hooks**: Enforce permissions automatically
3. **Add Settings**: Configure sandboxing and resource limits
4. **Add Skills**: Create workflows like `/implement-feature` or `/fix-bug`

Learn more in [Building Blocks](../building-blocks/agents.md) for detailed agent design patterns.
