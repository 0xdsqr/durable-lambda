import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { EventBridgeClient } from "@aws-sdk/client-eventbridge"
import { SQSClient } from "@aws-sdk/client-sqs"
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"

export interface AwsClients {
  ddb: DynamoDBDocumentClient
  bus: EventBridgeClient
  sqs: SQSClient
}

export function createAwsClients(region?: string): AwsClients {
  const ddbClient = new DynamoDBClient({ region })
  const ddb = DynamoDBDocumentClient.from(ddbClient)
  const bus = new EventBridgeClient({ region })
  const sqs = new SQSClient({ region })
  return { ddb, bus, sqs }
}
