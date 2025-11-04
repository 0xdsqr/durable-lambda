#!/usr/bin/env node
import * as cdk from "aws-cdk-lib"
import { BasicStack } from "../lib/basic-stack.js"

const app = new cdk.App()
new BasicStack(app, "BasicStack")
