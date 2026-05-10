import { execSync } from "node:child_process";

/**
 * Runs typecheck (when code-relevant paths are staged) and Vitest for only
 * workspaces touched by the staged diff. Full test suite when shared config
 * changes would affect all packages.
 */
function getStagedFiles() {
  return execSync("git diff --cached --name-only --diff-filter=ACM", {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  })
    .split("\n")
    .filter(Boolean);
}

const TYPECHECK_TRIGGERS = [
  /^apps\//,
  /^packages\//,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^tsconfig\./,
  /^vitest\.config\.ts$/,
  /^eslint\.config\.mjs$/,
];

const FULL_TEST_TRIGGERS = [
  /^vitest\.config\.ts$/,
  /^eslint\.config\.mjs$/,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^tsconfig\.workspaces\.json$/,
  /^packages\/config\//,
];

const WORKSPACES = [
  { prefix: "apps/api/", vitestPath: "apps/api" },
  { prefix: "packages/contracts/", vitestPath: "packages/contracts" },
  { prefix: "packages/marketer-pro-contract/", vitestPath: "packages/marketer-pro-contract" },
  { prefix: "packages/marketer-pro-queue/", vitestPath: "packages/marketer-pro-queue" },
  { prefix: "packages/ui/", vitestPath: "packages/ui" },
];

function touchesPath(files, matchers) {
  return files.some((f) => matchers.some((m) => m.test(f)));
}

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function main() {
  const staged = getStagedFiles();
  if (staged.length === 0) {
    return;
  }

  if (touchesPath(staged, TYPECHECK_TRIGGERS)) {
    run("npm run typecheck");
  }

  if (touchesPath(staged, FULL_TEST_TRIGGERS)) {
    run("npx vitest run");
    return;
  }

  const roots = new Set();
  for (const file of staged) {
    for (const w of WORKSPACES) {
      if (file.startsWith(w.prefix)) {
        roots.add(w.vitestPath);
      }
    }
  }

  if (roots.size > 0) {
    run(`npx vitest run ${[...roots].join(" ")}`);
  }
}

main();
