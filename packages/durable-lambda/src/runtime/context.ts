import type { DurableRuntime } from "../types/runtime"

export interface DurableContext<T = Record<string, unknown>> {
  save(actorId: string, newState: T): Promise<void>
  send(actorId: string, payload: Record<string, unknown>): Promise<void>
  call(
    sourceActor: string,
    targetActor: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown> | undefined>
  setAlarm(actorId: string, name: string, delay: string | number): Promise<void>
}

export function buildContext<T = Record<string, unknown>>(
  runtime: DurableRuntime,
): DurableContext<T> {
  const { state, locks, queue, events, workflows } = runtime

  return {
    async save(actorId, newState) {
      const s = await state.load<T>(actorId)
      s.data = newState
      await state.save<T>(s)
    },
    async send(actorId, payload) {
      await queue.send(actorId, payload)
    },
    async call(_sourceActor, targetActor, payload) {
      const workflowId = await workflows.create()
      await queue.send(targetActor, { ...payload, _workflowId: workflowId })
      const result = await workflows.get(workflowId)
      return result
    },
    async setAlarm(actorId, name, delay) {
      await events.setAlarm(actorId, name, delay)
    },
  }
}
