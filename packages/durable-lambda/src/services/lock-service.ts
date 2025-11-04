import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"
import { DeleteCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb"

export function createLockService(
  ddb: DynamoDBDocumentClient,
  tableName: string,
) {
  const lambdaInstanceId = crypto.randomUUID()

  async function acquire(actorId: string, ttlSeconds = 30): Promise<boolean> {
    const now = Date.now()
    const expiresAt = now + ttlSeconds * 1000

    try {
      await ddb.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            actorId,
            lockHolder: lambdaInstanceId,
            acquiredAt: now,
            expiresAt,
            ttl: Math.floor(expiresAt / 1000),
          },
          ConditionExpression:
            "attribute_not_exists(actorId) OR expiresAt < :now",
          ExpressionAttributeValues: { ":now": now },
        }),
      )
      return true
    } catch (error) {
      const err = error as Record<string, unknown>
      if (err.name === "ConditionalCheckFailedException") return false
      throw error
    }
  }

  async function renew(actorId: string, ttlSeconds = 30) {
    const expiresAt = Date.now() + ttlSeconds * 1000
    await ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { actorId },
        UpdateExpression: "SET expiresAt = :exp, #ttl = :ttl",
        ConditionExpression: "lockHolder = :holder",
        ExpressionAttributeNames: { "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":exp": expiresAt,
          ":ttl": Math.floor(expiresAt / 1000),
          ":holder": lambdaInstanceId,
        },
      }),
    )
  }

  async function release(actorId: string) {
    try {
      await ddb.send(
        new DeleteCommand({
          TableName: tableName,
          Key: { actorId },
          ConditionExpression: "lockHolder = :holder",
          ExpressionAttributeValues: { ":holder": lambdaInstanceId },
        }),
      )
    } catch {
      /* ignore */
    }
  }

  return { acquire, renew, release }
}
