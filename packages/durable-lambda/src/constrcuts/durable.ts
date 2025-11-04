import {
  Duration,
  aws_dynamodb as dynamodb,
  aws_events as events,
  aws_iam as iam,
  type aws_lambda as lambda,
  aws_lambda_event_sources as sources,
  aws_sqs as sqs,
  aws_events_targets as targets,
} from "aws-cdk-lib"
import { Construct } from "constructs"

export interface DurableFabricProps {
  lambdas: (lambda.Function | lambda.IFunction)[]
  prefix?: string
}

export class DurableFabric extends Construct {
  public readonly queue: sqs.Queue
  public readonly dlq: sqs.Queue
  public readonly bus: events.EventBus
  public readonly stateTable: dynamodb.TableV2
  public readonly workflowTable: dynamodb.TableV2
  public readonly locksTable: dynamodb.TableV2

  constructor(scope: Construct, id: string, props: DurableFabricProps) {
    super(scope, id)

    const { lambdas, prefix = "Durable" } = props

    const stateTable = new dynamodb.TableV2(this, `${prefix}State`, {
      tableName: `${prefix}State`,
      partitionKey: { name: "actorId", type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
    })

    const workflowTable = new dynamodb.TableV2(this, `${prefix}Workflow`, {
      tableName: `${prefix}Workflow`,
      partitionKey: { name: "workflowId", type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      timeToLiveAttribute: "ttl",
    })

    const locksTable = new dynamodb.TableV2(this, `${prefix}Locks`, {
      tableName: `${prefix}Locks`,
      partitionKey: { name: "actorId", type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      timeToLiveAttribute: "ttl",
    })

    this.stateTable = stateTable
    this.workflowTable = workflowTable
    this.locksTable = locksTable

    this.dlq = new sqs.Queue(this, `${prefix}DLQ`, {
      queueName: `${prefix}DLQ.fifo`,
      fifo: true,
      contentBasedDeduplication: true,
      retentionPeriod: Duration.days(14),
    })

    this.queue = new sqs.Queue(this, `${prefix}Queue`, {
      queueName: `${prefix}Queue.fifo`,
      fifo: true,
      contentBasedDeduplication: true,
      visibilityTimeout: Duration.seconds(60),
      deadLetterQueue: { queue: this.dlq, maxReceiveCount: 3 },
    })

    this.bus = new events.EventBus(this, `${prefix}Bus`, {
      eventBusName: `${prefix}Bus`,
    })

    const sharedEnv = {
      DURABLE_TABLE: this.stateTable.tableName,
      WORKFLOW_TABLE: this.workflowTable.tableName,
      LOCKS_TABLE: this.locksTable.tableName,
      DURABLE_QUEUE: this.queue.queueUrl,
      DURABLE_BUS_NAME: this.bus.eventBusName,
    }

    const grantFns = [
      (fn: lambda.IFunction) => this.stateTable.grantReadWriteData(fn),
      (fn: lambda.IFunction) => this.workflowTable.grantReadWriteData(fn),
      (fn: lambda.IFunction) => this.locksTable.grantReadWriteData(fn),
      (fn: lambda.IFunction) => this.queue.grantConsumeMessages(fn),
      (fn: lambda.IFunction) => this.queue.grantSendMessages(fn),
      (fn: lambda.IFunction) => this.dlq.grantConsumeMessages(fn),
      (fn: lambda.IFunction) => this.bus.grantPutEventsTo(fn),
    ]

    lambdas.forEach((fn) => {
      const hasEnv =
        "addEnvironment" in fn &&
        typeof (fn as any).addEnvironment === "function"
      const hasEventSource =
        "addEventSource" in fn &&
        typeof (fn as any).addEventSource === "function"

      if (hasEnv) {
        const lf = fn as lambda.Function
        Object.entries(sharedEnv).forEach(([k, v]) => {
          lf.addEnvironment(k, v)
        })
        grantFns.forEach((grant) => {
          grant(lf)
        })
      } else {
        grantFns.forEach((grant) => {
          grant(fn)
        })
      }

      if (hasEventSource) {
        ;(fn as lambda.Function).addEventSource(
          new sources.SqsEventSource(this.queue, {
            batchSize: 1,
            maxConcurrency: 50,
            reportBatchItemFailures: true,
          }),
        )
      }

      new events.Rule(this, `${fn.node.id}TimerRule`, {
        eventBus: this.bus,
        eventPattern: {
          source: ["durable.lambda"],
          detailType: ["TimerFired", "AlarmFired"],
        },
        targets: [new targets.LambdaFunction(fn)],
      })

      new events.Rule(this, `${fn.node.id}SignalRule`, {
        eventBus: this.bus,
        eventPattern: { source: ["external.signal"] },
        targets: [new targets.LambdaFunction(fn)],
      })
    })

    this.bus.grantPutEventsTo(new iam.ServicePrincipal("events.amazonaws.com"))
  }
}
