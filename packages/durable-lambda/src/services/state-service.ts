import {
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb"
import type { DurableState } from "../types/durable"

export function createStateService(
  ddb: DynamoDBDocumentClient,
  tableName: string,
) {
  return {
    async load<T>(actorId: string): Promise<DurableState<T>> {
      const res = await ddb.send(
        new GetCommand({ TableName: tableName, Key: { actorId } }),
      )
      if (!res.Item)
        return {
          actorId,
          version: 0,
          data: {} as T,
          updatedAt: new Date().toISOString(),
          alarms: {},
        }
      return res.Item as DurableState<T>
    },

    async save<T>(state: DurableState<T>) {
      const nextVersion = state.version + 1
      await ddb.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            ...state,
            version: nextVersion,
            updatedAt: new Date().toISOString(),
          },
          ConditionExpression: "attribute_not_exists(version) OR version = :v",
          ExpressionAttributeValues: { ":v": state.version },
        }),
      )
      state.version = nextVersion
    },
  }
}
