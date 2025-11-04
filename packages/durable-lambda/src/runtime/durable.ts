import type { DurableRuntime } from "../types/runtime"
import { createDurableRuntime } from "./index"

interface DurableEvent extends Record<string, unknown> {
  actorId: string
  payload: Record<string, unknown>
  sync?: boolean
}

export function durable<T>(
  fn: (
    ctx: {
      actorId: string
      state: T
      version: number
      save: (ns?: T) => Promise<void>
      resolve: (id: string, output: Record<string, unknown>) => Promise<void>
    },
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>,
) {
  return async (event: DurableEvent) => {
    const runtime = createDurableRuntime()
    const { actorId, payload: userPayload, sync } = event

    if (sync) {
      const state = await runtime.state.load<T>(actorId)
      const ctx = {
        actorId,
        state: state.data,
        version: state.version,
        save: async (ns?: T) => {
          state.data = ns ?? ctx.state
          await runtime.state.save(state)
        },
        resolve: async (
          workflowId: string,
          output: Record<string, unknown>,
        ) => {
          await runtime.workflows.resolve(workflowId, output)
        },
      }

      const result = await fn(ctx, userPayload)
      return result || { ok: true, state: ctx.state }
    }

    await fn(runtime as any, event)
    return { ok: true, processed: true, actorId }
  }
}
