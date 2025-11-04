import { $, Glob } from "bun"

await $`rm -rf dist`

const files = new Glob("./src/**/*.{ts,tsx}").scan() as AsyncIterable<string>
const collected: string[] = []
for await (const f of files) {
  // Skip heavy CDK constructs file - only build main entry points
  if (!f.includes("constrcuts")) {
    collected.push(f)
  }
}

// ---- 1️⃣ Build ESM ----
await Bun.build({
  entrypoints: ["src/index.ts"],
  root: "src",
  outdir: "dist/esm",
  format: "esm",
  target: "node",
  splitting: false,
  external: ["@aws-sdk/*", "aws-cdk-lib", "constructs"],
})

await Bun.build({
  entrypoints: ["src/cli/cli.ts"],
  root: ".",
  outdir: "dist/esm",
  format: "esm",
  target: "bun",
  splitting: false,
  external: ["@aws-sdk/*", "aws-cdk-lib", "constructs"],
})

// ---- 2️⃣ Build CommonJS ----
await Bun.build({
  entrypoints: ["src/index.ts"],
  root: "src",
  outdir: "dist/cjs",
  format: "cjs",
  target: "node",
  splitting: false,
  external: ["@aws-sdk/*", "aws-cdk-lib", "constructs"],
})

// ---- 3️⃣ Emit type declarations ----
await $`tsc -p tsconfig.build.json --outDir dist/types --declarationMap`
