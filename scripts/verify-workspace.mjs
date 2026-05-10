import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

/** Required for any bootstrap / CI gate in this repo (packages + tooling). */
const requiredPaths = [
  "packages",
  "apps/api/package.json",
  "apps/api/tsconfig.json",
  "packages/config/tsconfig.base.json",
  "packages/contracts/package.json",
  "packages/contracts/tsconfig.json",
  "packages/marketer-pro-contract/package.json",
  "packages/marketer-pro-contract/tsconfig.json",
  "packages/marketer-pro-queue/package.json",
  "packages/marketer-pro-queue/tsconfig.json",
  "packages/ui/package.json",
  "packages/ui/tsconfig.json",
  "tsconfig.workspaces.json",
  "eslint.config.mjs",
  "vitest.config.ts",
  "lint-staged.config.mjs",
  "scripts/pre-commit-verify.mjs",
  ".husky/pre-commit",
];

/** Additional apps restored from upstream over time — warn only. */
const recommendedAppPaths = [
  ["apps/web/package.json", "Marketer web (Vite)"],
  ["apps/marketer-pro-e2e/package.json", "Playwright E2E"],
  ["apps/marketer-pro-mobile/package.json", "Expo mobile"],
];

const missing = requiredPaths.filter((relativePath) => {
  const absolutePath = path.join(rootDir, relativePath);
  return !fs.existsSync(absolutePath);
});

if (missing.length > 0) {
  console.error("Workspace bootstrap check failed. Missing required paths:");
  for (const entry of missing) {
    console.error(`- ${entry}`);
  }
  process.exit(1);
}

const optionalMissing = [];
for (const [rel, label] of recommendedAppPaths) {
  const absolutePath = path.join(rootDir, rel);
  if (!fs.existsSync(absolutePath)) {
    optionalMissing.push(`${rel} (${label})`);
  }
}

for (const line of optionalMissing) {
  // stdout only — avoids stderr/stdout reordering in some shells.
  console.log(`[verify-workspace] Optional (not installed yet): ${line}`);
}

console.log("Workspace bootstrap check passed.");
