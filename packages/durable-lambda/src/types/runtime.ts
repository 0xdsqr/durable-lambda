import type { DurableState } from "./durable"

export interface StateService {
  load<T>(actorId: string): Promise<DurableState<T>>
  save<T>(state: DurableState<T>): Promise<void>
}

export interface LockService {
  acquire(actorId: string, ttlSeconds?: number): Promise<boolean>
  renew(actorId: string, ttlSeconds?: number): Promise<void>
  release(actorId: string): Promise<void>
}

export interface QueueService {
  send(
    actorId: string,
    payload: Record<string, unknown>,
    eventId?: string,
  ): Promise<void>
  coalesce(
    actorId: string,
    request: Record<string, unknown>,
    windowMs?: number,
  ): Promise<string>
}

export interface EventService {
  sleep(actorId: string, delay: string | number): Promise<void>
  setAlarm(actorId: string, name: string, delay: string | number): Promise<void>
  signal(
    targetActor: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void>
}

export interface WorkflowService {
  create(): Promise<string>
  resolve(id: string, output: Record<string, unknown>): Promise<void>
  get(id: string): Promise<Record<string, unknown> | undefined>
}

export interface DurableRuntime {
  state: StateService
  locks: LockService
  queue: QueueService
  events: EventService
  workflows: WorkflowService
}
