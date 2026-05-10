/**
 * Back-compat shim — canonical worker lives in `@home-link/marketer-pro-queue`.
 *
 *   npm run queue:worker
 *
 * Builds the queue package and runs `packages/marketer-pro-queue/dist/worker-cli.js`.
 * See docs/engineering/redis-bullmq.md
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const result = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "queue:worker"],
  {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
    env: process.env,
  },
);

process.exit(result.status ?? 1);
