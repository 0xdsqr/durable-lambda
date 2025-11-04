export interface DurableState<T> {
  actorId: string
  version: number
  data: T
  updatedAt: string
  lastEventId?: string
  alarms?: Record<string, number>
}
