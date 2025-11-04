import {
  createAwsClients,
  createEventService,
  createLockService,
  createQueueService,
  createStateService,
  createWorkflowService,
} from "../services"
import type { DurableRuntime } from "../types/runtime"

function getRequiredEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export function createDurableRuntime(): DurableRuntime {
  const { ddb, sqs, bus } = createAwsClients()

  return {
    state: createStateService(ddb, getRequiredEnv("DURABLE_TABLE")),
    locks: createLockService(ddb, getRequiredEnv("LOCKS_TABLE")),
    queue: createQueueService(sqs, getRequiredEnv("DURABLE_QUEUE")),
    events: createEventService(bus, getRequiredEnv("DURABLE_BUS_NAME")),
    workflows: createWorkflowService(ddb, getRequiredEnv("WORKFLOW_TABLE")),
  }
}
