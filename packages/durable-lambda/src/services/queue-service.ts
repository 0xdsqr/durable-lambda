import { SendMessageCommand, type SQSClient } from "@aws-sdk/client-sqs"

interface PendingBatch {
  requests: Record<string, unknown>[]
  timer: NodeJS.Timeout | null
}

export function createQueueService(sqs: SQSClient, queueUrl: string) {
  const pendingBatches = new Map<string, PendingBatch>()

  async function send(
    actorId: string,
    payload: Record<string, unknown>,
    eventId = crypto.randomUUID(),
  ) {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageGroupId: actorId,
        MessageDeduplicationId: eventId,
        MessageBody: JSON.stringify({ actorId, eventId, payload }),
      }),
    )
  }

  async function coalesce(
    actorId: string,
    request: Record<string, unknown>,
    windowMs = 10,
  ) {
    const batchId = crypto.randomUUID()
    if (!pendingBatches.has(actorId)) {
      const batch: PendingBatch = { requests: [], timer: null }
      batch.timer = setTimeout(async () => {
        pendingBatches.delete(actorId)
        await send(actorId, { _batch: batch.requests }, batchId)
      }, windowMs)
      pendingBatches.set(actorId, batch)
    }
    const batch = pendingBatches.get(actorId)
    if (batch) {
      batch.requests.push(request)
    }
    return batchId
  }

  return { send, coalesce }
}
