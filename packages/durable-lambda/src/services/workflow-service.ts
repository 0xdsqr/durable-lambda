import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb"

export function createWorkflowService(
  ddb: DynamoDBDocumentClient,
  tableName: string,
) {
  async function create() {
    const workflowId = crypto.randomUUID()
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          workflowId,
          status: "PENDING",
          createdAt: Date.now(),
          ttl: Math.floor((Date.now() + 300000) / 1000),
        },
      }),
    )
    return workflowId
  }

  async function resolve(id: string, output: Record<string, unknown>) {
    await ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { workflowId: id },
        UpdateExpression: "SET #s=:s, #o=:o, resolvedAt=:t",
        ExpressionAttributeNames: { "#s": "status", "#o": "output" },
        ExpressionAttributeValues: {
          ":s": "RESOLVED",
          ":o": output,
          ":t": Date.now(),
        },
      }),
    )
  }

  async function get(id: string) {
    const res = await ddb.send(
      new GetCommand({ TableName: tableName, Key: { workflowId: id } }),
    )
    return res.Item
  }

  return { create, resolve, get }
}
