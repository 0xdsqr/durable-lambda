import { DurableFabric } from "@dsqr/durable-lambda"
import {
  Duration,
  aws_lambda as lambda,
  aws_lambda_nodejs as lambdaNodejs,
  Stack,
  type StackProps,
} from "aws-cdk-lib"
import type { Construct } from "constructs"
import * as path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class BasicStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const durableLambda = new lambdaNodejs.NodejsFunction(
      this,
      "DurableHandler",
      {
        entry: path.join(__dirname, "../lambda/handler.ts"),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        timeout: Duration.seconds(60),
        memorySize: 512,
        reservedConcurrentExecutions: 100,
        bundling: {
          format: lambdaNodejs.OutputFormat.ESM,
          target: "es2022",
          minify: true,
          externalModules: ["@aws-sdk/*"],
          esbuildArgs: {
            "--banner:js":
              "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
          },
        },
      },
    )

    const fabric = new DurableFabric(this, "DurableFabric", {
      lambdas: [durableLambda],
      prefix: "Durable",
    })

    this.exportValue(durableLambda.functionArn, { name: "DurableLambdaArn" })
    this.exportValue(fabric.queue.queueUrl, { name: "DurableQueueUrl" })
    this.exportValue(fabric.bus.eventBusName, { name: "DurableBusName" })
    this.exportValue(fabric.stateTable.tableArn, {
      name: "DurableStateTableArn",
    })
    this.exportValue(fabric.workflowTable.tableArn, {
      name: "DurableWorkflowTableArn",
    })
    this.exportValue(fabric.locksTable.tableArn, {
      name: "DurableLocksTableArn",
    })
  }
}
