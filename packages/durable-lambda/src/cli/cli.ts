#!/usr/bin/env bun

import { $ } from "bun"
import "colors"
import { default as ora } from "ora"

const args = Bun.argv.slice(2)
const command = args[0]
const projectName = args[1]

if (!command || !projectName) {
  console.log("Durable Lambda CLI".blue.bold)
  console.log()
  console.log("Usage: durable-lambda <command> <project-name>".gray)
  console.log()
  console.log("Commands:".gray)
  console.log("  create    Create a new durable-lambda project".gray)
  console.log()
  console.log("Example:".gray)
  console.log("  durable-lambda create my-app".cyan)
  process.exit(0)
}

if (command === "create") {
  await createProject(projectName)
} else {
  console.error(`Unknown command: ${command}`.red)
  process.exit(1)
}

async function createProject(name: string) {
  const projectPath = `${process.cwd()}/${name}`

  try {
    const stat = await Bun.file(projectPath).stat()
    if (stat) {
      console.error(`Error: Directory "${name}" already exists`.red)
      process.exit(1)
    }
  } catch {
    // File doesn't exist, which is what we want
  }

  console.log(`Creating new durable-lambda project: ${name}`.blue.bold)
  console.log()

  let spinner = ora("Setting up project structure...").start()
  await $`mkdir -p ${projectPath}`
  spinner.succeed()

  spinner = ora("Cloning template repository...").start()
  try {
    await $`git clone --depth 1 --filter=blob:none --sparse https://github.com/0xdsqr/durable-lambda.git ${projectPath}/.tmp`
    await $`cd ${projectPath}/.tmp && git sparse-checkout set examples/basic`
  } catch {
    try {
      await $`git clone https://github.com/0xdsqr/durable-lambda.git --depth 1 ${projectPath}/.tmp`
    } catch (error) {
      spinner.fail()
      console.error("Failed to clone repository".red)
      process.exit(1)
    }
  }
  spinner.succeed()

  spinner = ora("Preparing project files...").start()
  await $`cp -r ${projectPath}/.tmp/examples/basic/* ${projectPath}/`
  await $`rm -rf ${projectPath}/.tmp`
  spinner.succeed()

  spinner = ora("Installing dependencies...").start()
  try {
    await $`cd ${projectPath} && bun install`
    spinner.succeed()
  } catch {
    spinner.warn()
    console.warn("Dependency installation failed, but project created".yellow)
  }

  console.log()
  console.log("Project created successfully!".green.bold)
  console.log()
  console.log("Next steps:".gray.bold)
  console.log(`  cd ${name}`.cyan)
  console.log(`  bun run build`.cyan)
  console.log(`  bun run cdk deploy`.cyan)
}
