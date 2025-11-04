<div align="center">
<img src="./.github/assets/durable-lambda.svg" alt="durable-lambda - Actor-based state management for AWS Lambda" width="300"/>

<p align="center">
  <a href="https://github.com/0xdsqr/durable-lambda"><img src="https://img.shields.io/badge/github-durable--lambda-blue?style=for-the-badge&logo=github" alt="GitHub"></a>
  <a href="#"><img src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="#"><img src="https://img.shields.io/badge/aws-lambda-FF9900?style=for-the-badge&logo=amazonaws" alt="AWS Lambda"></a>
  <a href="#"><img src="https://img.shields.io/badge/serverless-architecture-purple?style=for-the-badge" alt="Serverless"></a>
</p>
</div>

A **Cloudflare Durable Objects-inspired runtime** built on AWS serverless. Get actor-based state management with single-instance guarantees, using only **Lambda + DynamoDB + SQS + EventBridge**.

## ⇁ The Problem

You want stateful serverless actors like Cloudflare Durable Objects, but you're locked into AWS. You need distributed state that's isolated per actor, with single-instance guarantees and automatic persistence - without dealing with race conditions or complex infrastructure.

## ⇁ The Solution

Durable Lambda brings the actor model to AWS Lambda using DynamoDB for state, SQS for ordering, and distributed locking to guarantee single-instance execution. Write stateful functions that scale horizontally while staying coherent.

## ⇁ Key Features

- 🎯 **Actor Model** - Isolated state containers with guaranteed single-instance execution
- 🔒 **Distributed Locking** - DynamoDB-based locks prevent race conditions
- ⚡ **Sync & Async** - Call actors synchronously (wait for result) or asynchronously (fire & forget)
- 💾 **Automatic Persistence** - State auto-saved to DynamoDB with version tracking
- 📡 **State Isolation** - Each actor instance maintains isolated state
- 🏗️ **CDK Construct** - Deploy everything with one CDK stack

## ⇁ Quick Start

### 0. Create a New Project

Use the CLI to scaffold a new durable-lambda project:

```bash
# Install globally (once)
npm install -g @dsqr/durable-lambda

# Create a new project
durable-lambda create my-app
cd my-app
```

Or use it directly with npx:

```bash
npx @dsqr/durable-lambda create my-app
cd my-app
bun install
```

### 1. Deploy Infrastructure

```typescript
import { DurableFabric } from "@dsqr/durable-lambda"
import { Stack, aws_lambda_nodejs as lambdaNodejs } from "aws-cdk-lib"
import * as path from "path"

export class MyStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id)

    const fabric = new DurableFabric(this, "DurableFabric", {
      lambdas: [
        new lambdaNodejs.NodejsFunction(this, "MyActor", {
          entry: path.join(__dirname, "../lambda/handler.ts"),
          handler: "handler",
        })
      ],
      prefix: "MyApp"
    })
  }
}
```

### 2. Create a Handler

```typescript
import { durable } from "@dsqr/durable-lambda"

interface CounterState {
  count: number
}

export const handler = durable<CounterState>(async (ctx, request) => {
  ctx.state.count = ctx.state.count ?? 0

  if (request.action === "increment") {
    ctx.state.count += request.amount || 1
    await ctx.save()
  }

  return { count: ctx.state.count }
})
```

### 3. Call Your Actor

```typescript
// Sync call - wait for result
const result = await lambda.invoke({
  Payload: JSON.stringify({
    actorId: "counter-123",
    payload: { action: "increment", amount: 5 },
    sync: true
  })
})
console.log(result.Payload) // { count: 5 }

// Async call - fire and forget
await lambda.invoke({
  InvocationType: "Event",
  Payload: JSON.stringify({
    actorId: "counter-123",
    payload: { action: "increment" }
  })
})
```

## ⇁ API Reference

<details><summary><strong>Context Methods</strong></summary>

| Method | Description | Example |
|--------|-------------|---------|
| `ctx.state` | Current actor state (mutable) | `ctx.state.count++` |
| `ctx.actorId` | Unique actor identifier | `console.log(ctx.actorId)` |
| `ctx.version` | Current state version | `console.log(ctx.version)` |
| `await ctx.save()` | Persist state changes | `await ctx.save()` |
| `await ctx.resolve(workflowId, result)` | Return result for sync caller | `await ctx.resolve(id, { success: true })` |

**State Persistence Example**

```typescript
// Auto-save after mutation
ctx.state.count += 5
await ctx.save()

// State is persisted to DynamoDB
// Version is auto-incremented
```

</details>

<details><summary><strong>Synchronous Calls (Sync Path)</strong></summary>

When `sync: true`, the handler:
1. Loads actor state immediately
2. Executes the handler
3. Returns the handler's return value
4. Caller waits for result

```typescript
const result = await lambda.invoke({
  Payload: JSON.stringify({
    actorId: "my-actor",
    payload: { action: "fetch" },
    sync: true
  })
})
console.log(result.Payload) // Handler response
```

Use for: Queries, user-facing operations, decisions that need immediate results.

</details>

<details><summary><strong>Asynchronous Calls (Async Path)</strong></summary>

When `sync` is not set or `false`, the handler:
1. Queues message to SQS
2. Returns immediately
3. Processes asynchronously via SQS trigger
4. Guaranteed ordering per actor (FIFO queue)

```typescript
await lambda.invoke({
  InvocationType: "Event",
  Payload: JSON.stringify({
    actorId: "my-actor",
    payload: { action: "process" }
  })
})
```

Use for: Heavy work, background jobs, fire-and-forget operations.

</details>

## ⇁ Examples

<details><summary><strong>Counter with Lock Guarantee</strong></summary>

```typescript
import { durable } from "@dsqr/durable-lambda"

interface CounterState {
  count: number
  history: number[]
}

export const handler = durable<CounterState>(async (ctx, request) => {
  // Initialize
  if (!ctx.state.count) {
    ctx.state.count = 0
    ctx.state.history = []
  }

  // This is guaranteed to run on only ONE Lambda at a time!
  if (request.action === "increment") {
    ctx.state.count += request.amount || 1
    ctx.state.history.push(ctx.state.count)

    // Keep only last 100 values
    if (ctx.state.history.length > 100) {
      ctx.state.history = ctx.state.history.slice(-100)
    }

    await ctx.save()
  }

  if (request.action === "get") {
    return {
      count: ctx.state.count,
      history: ctx.state.history
    }
  }

  return { count: ctx.state.count }
})
```

**Usage:**
```typescript
// Fire and forget (async)
await lambda.invoke({
  InvocationType: "Event",
  Payload: JSON.stringify({
    actorId: "counter-1",
    payload: { action: "increment", amount: 5 }
  })
})

// Wait for result (sync)
const result = await lambda.invoke({
  Payload: JSON.stringify({
    actorId: "counter-1",
    payload: { action: "get" },
    sync: true
  })
})
console.log(result.Payload) // { count: 5, history: [1,2,3,4,5] }
```

</details>

<details><summary><strong>Rate Limiter with Cleanup</strong></summary>

```typescript
interface RateLimiterState {
  tokens: number
  lastRefill: number
  limit: number
  refillRate: number
}

export const handler = durable<RateLimiterState>(async (ctx, request) => {
  if (!ctx.state.tokens) {
    ctx.state.tokens = 10
    ctx.state.lastRefill = Date.now()
    ctx.state.limit = 10
    ctx.state.refillRate = 1 // 1 token per second
  }

  // Refill tokens based on elapsed time
  const now = Date.now()
  const secondsElapsed = (now - ctx.state.lastRefill) / 1000
  ctx.state.tokens = Math.min(
    ctx.state.limit,
    ctx.state.tokens + secondsElapsed * ctx.state.refillRate
  )
  ctx.state.lastRefill = now

  if (request.action === "check") {
    const allowed = ctx.state.tokens >= 1
    if (allowed) {
      ctx.state.tokens -= 1
    }
    await ctx.save()
    return {
      allowed,
      remaining: Math.floor(ctx.state.tokens)
    }
  }

  return { tokens: ctx.state.tokens }
})
```

</details>

<details><summary><strong>Leaderboard</strong></summary>

```typescript
interface LeaderboardState {
  scores: Map<string, number>
}

export const handler = durable<LeaderboardState>(async (ctx, request) => {
  if (!ctx.state.scores) {
    ctx.state.scores = new Map()
  }

  switch (request.action) {
    case "score":
      const userId = request.userId
      const newScore = Math.max(
        ctx.state.scores.get(userId) || 0,
        request.score
      )
      ctx.state.scores.set(userId, newScore)
      await ctx.save()
      break

    case "top10":
      return {
        topScores: Array.from(ctx.state.scores.entries())
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([userId, score]) => ({ userId, score }))
      }

    case "rank":
      const sorted = Array.from(ctx.state.scores.entries())
        .sort(([, a], [, b]) => b - a)
      const rank = sorted.findIndex(([id]) => id === request.userId) + 1
      return {
        userId: request.userId,
        score: ctx.state.scores.get(request.userId),
        rank: rank || null
      }
  }

  return {}
})
```

</details>

<details><summary><strong>Order Processing with Saga Pattern</strong></summary>

```typescript
interface OrderState {
  orderId: string
  status: "pending" | "processing" | "completed" | "failed"
  steps: Array<{ name: string; status: string }>
}

export const handler = durable<OrderState>(async (ctx, request) => {
  if (request.action === "create") {
    ctx.state.orderId = request.orderId
    ctx.state.status = "pending"
    ctx.state.steps = []
    await ctx.save()
    return { orderId: ctx.state.orderId, status: "pending" }
  }

  if (request.action === "process") {
    ctx.state.status = "processing"
    ctx.state.steps = [
      { name: "validate", status: "pending" },
      { name: "reserve", status: "pending" },
      { name: "charge", status: "pending" },
      { name: "ship", status: "pending" }
    ]
    await ctx.save()

    try {
      // Step 1: Validate
      ctx.state.steps[0].status = "completed"

      // Step 2: Reserve inventory
      ctx.state.steps[1].status = "completed"

      // Step 3: Charge payment
      ctx.state.steps[2].status = "completed"

      // Step 4: Create shipment
      ctx.state.steps[3].status = "completed"

      ctx.state.status = "completed"
    } catch (error) {
      ctx.state.status = "failed"
      // Compensation logic here
    }

    await ctx.save()
    return { orderId: ctx.state.orderId, status: ctx.state.status }
  }

  return { status: ctx.state.status }
})
```

</details>

<details><summary><strong>Distributed Cron with Timers</strong></summary>

```typescript
interface CronState {
  jobs: Map<string, {
    schedule: string
    lastRun: number
    nextRun: number
  }>
}

export const handler = durable<CronState>(async (ctx, request) => {
  if (!ctx.state.jobs) {
    ctx.state.jobs = new Map()
  }

  if (request.action === "schedule") {
    const { jobId, schedule, interval } = request
    const nextRun = Date.now() + interval

    ctx.state.jobs.set(jobId, {
      schedule,
      lastRun: 0,
      nextRun
    })

    await ctx.save()
    return { jobId, scheduled: true }
  }

  if (request.action === "run") {
    const { jobId } = request
    const job = ctx.state.jobs.get(jobId)

    if (job) {
      job.lastRun = Date.now()
      job.nextRun = Date.now() + 3600000 // 1 hour
      await ctx.save()
      return { jobId, executed: true }
    }
  }

  return {}
})
```

</details>

<details><summary><strong>Circuit Breaker Pattern</strong></summary>

```typescript
interface CircuitBreakerState {
  status: "closed" | "open" | "half-open"
  failures: number
  successCount: number
  lastFailureTime: number
}

export const handler = durable<CircuitBreakerState>(async (ctx, request) => {
  if (!ctx.state.status) {
    ctx.state.status = "closed"
    ctx.state.failures = 0
    ctx.state.successCount = 0
    ctx.state.lastFailureTime = 0
  }

  if (request.action === "record-failure") {
    ctx.state.failures++
    ctx.state.lastFailureTime = Date.now()

    if (ctx.state.failures >= 5) {
      ctx.state.status = "open"
    }

    await ctx.save()
    return { status: ctx.state.status }
  }

  if (request.action === "record-success") {
    if (ctx.state.status === "half-open") {
      ctx.state.successCount++
      if (ctx.state.successCount >= 3) {
        ctx.state.status = "closed"
        ctx.state.failures = 0
      }
    } else {
      ctx.state.failures = Math.max(0, ctx.state.failures - 1)
    }

    await ctx.save()
    return { status: ctx.state.status }
  }

  return { status: ctx.state.status }
})
```

</details>

## ⇁ Deployment

### CDK Construct

The `DurableFabric` construct handles all infrastructure:

```typescript
import { DurableFabric } from "@dsqr/durable-lambda"
import { Stack, aws_lambda_nodejs as lambdaNodejs, Duration } from "aws-cdk-lib"
import * as path from "path"

export class BasicStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id)

    // Create your Lambda function
    const durableHandler = new lambdaNodejs.NodejsFunction(this, "DurableHandler", {
      entry: path.join(__dirname, "../lambda/handler.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(60),
      memorySize: 512,
      bundling: {
        format: lambdaNodejs.OutputFormat.ESM,
        externalModules: ["@aws-sdk/*"],
      }
    })

    // Deploy all infrastructure with one construct
    const fabric = new DurableFabric(this, "DurableFabric", {
      lambdas: [durableHandler],
      prefix: "MyApp"
    })

    // Export important values
    new CfnOutput(this, "LambdaArn", {
      value: durableHandler.functionArn
    })
    new CfnOutput(this, "QueueUrl", {
      value: fabric.queue.queueUrl
    })
  }
}
```

This creates:
- ✅ DynamoDB tables (State, Workflows, Locks)
- ✅ SQS FIFO queue for ordered processing
- ✅ EventBridge bus for signals
- ✅ Lambda execution role with proper permissions

### Environment Variables

Automatically set by the CDK construct:

```bash
DURABLE_TABLE=DurableState
DURABLE_QUEUE=https://sqs.region.amazonaws.com/account/DurableQueue.fifo
WORKFLOW_TABLE=DurableWorkflow
LOCKS_TABLE=DurableLocks
DURABLE_BUS_NAME=DurableBus
```

## ⇁ Architecture

```
┌─────────────────────────────────────────┐
│        Your Lambda Handler              │
│  ┌───────────────────────────────────┐  │
│  │  ctx.state (mutable)              │  │
│  │  ctx.save()                       │  │
│  │  ctx.resolve(workflowId, result)  │  │
│  └───────────────────────────────────┘  │
└─────────────────┬───────────────────────┘
                  │
      ┌───────────┼───────────┐
      │           │           │
   ┌──▼──┐   ┌───▼────┐   ┌─▼────┐
   │DDB  │   │SQS     │   │Event │
   │State│   │FIFO    │   │Bridge│
   │Lock │   │Queue   │   │(Sig) │
   │Work │   └────────┘   └──────┘
   └─────┘
```

## ⇁ Performance & Limits

| Aspect | Value |
|--------|-------|
| Lock acquisition | 5-10ms |
| State load/save | 10-20ms |
| Sync call latency | 50-100ms |
| Async processing | 100-200ms |
| Max state size | 400KB (DynamoDB) |
| Max concurrent actors | Lambda concurrency limit |

## ⇁ Development

### Setup with Nix

Durable Lambda uses Nix for reproducible development environments:

```bash
nix flake update
direnv allow
```

This provides:
- **Bun** - Ultra-fast JavaScript runtime and bundler
- **Node.js** - TypeScript support
- **AWS CDK** - Infrastructure as code
- **Biome** - Linting and formatting
- **nixfmt** - Nix file formatting

### Build & Test

```bash
bun run build          # Build TypeScript → JavaScript
bun test               # Run test suite
nix fmt .              # Format all code
```

### Project Structure

```
packages/durable-lambda/
├── src/
│   ├── cli/            # CLI tool for scaffolding projects
│   ├── runtime/        # Core durable runtime
│   ├── services/       # AWS service integrations
│   ├── types/          # TypeScript interfaces
│   ├── constrcuts/     # CDK constructs
│   └── index.ts        # Main entry point
├── script/
│   └── build.ts        # Build script
└── dist/               # Compiled output
```

### Publish

```bash
cd packages/durable-lambda
bun run build
npm publish
```

## ⇁ Monitoring

### CloudWatch Logs

Each Lambda invocation is logged to CloudWatch with:
- Actor ID
- State version
- Lock holder
- Lock expiration

Query patterns:

```bash
# Find all invocations for an actor
aws logs filter-log-events \
  --log-group-name /aws/lambda/my-function \
  --filter-pattern '"actorId": "my-actor"'

# Find lock contention
aws logs filter-log-events \
  --log-group-name /aws/lambda/my-function \
  --filter-pattern 'ConditionalCheckFailedException'

# View state versions
aws logs filter-log-events \
  --log-group-name /aws/lambda/my-function \
  --filter-pattern '"version"'
```

### DynamoDB Metrics

Monitor state table usage:

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedWriteCapacityUnits \
  --dimensions Name=TableName,Value=DurableState \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 300 \
  --statistics Sum
```

### SQS Metrics

Track queue depth and processing:

```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.region.amazonaws.com/account/DurableQueue.fifo \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible
```

### EventBridge Rules

Monitor signal delivery:

```bash
aws events describe-rule --name DurableBus
aws events list-targets-by-rule --rule DurableBus
```

## ⇁ Contributing

Built for learning and experimentation. Open a PR or issue if you want, but no promises - this is a learning project. Feel free to fork it and make it your own!

## ⇁ License

MIT - Do whatever you want with it.