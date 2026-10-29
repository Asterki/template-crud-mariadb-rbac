#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const steps = [
  { name: "install shared", cwd: "shared", command: "npm", args: ["install"] },
  { name: "build shared", cwd: "shared", command: "npm", args: ["run", "build"] },
  { name: "install server", cwd: "server", command: "npm", args: ["install"] },
  { name: "install client", cwd: "client", command: "npm", args: ["install"] },
  {
    name: "prisma generate",
    cwd: "server",
    command: "npm",
    args: ["exec", "--", "prisma", "generate"],
  },
];

for (const step of steps) {
  const cwd = join(root, step.cwd);
  if (!existsSync(cwd)) {
    console.error(`[bootstrap] ${step.name} failed: missing directory ${cwd}`);
    process.exit(1);
  }
  console.log(`[bootstrap] ${step.name} (${step.cwd})`);
  const result = spawnSync(step.command, step.args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    console.error(`[bootstrap] ${step.name} failed: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[bootstrap] ${step.name} failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}
console.log("[bootstrap] done");
