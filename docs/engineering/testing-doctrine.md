# Testing doctrine (canonical commands)

Single source of truth for **how** we prove changes before merge. CI should mirror these commands where practical.

## Prerequisites

- Dependencies installed at repo root (`node_modules` present).
- TypeScript compiler is invoked via **`node node_modules/typescript/lib/tsc.js`** when `tsc` is not on `PATH` (Windows-safe).

## Typecheck — packages (current baseline)

From repository root (uses project references in [`tsconfig.workspaces.json`](../../tsconfig.workspaces.json)):

```bash
npm run typecheck
```

**Expect:** exit code `0` (builds all referenced `packages/*` in dependency order).

## Workspace layout

```bash
npm run verify
```

**Expect:** required `packages/*` + tooling files present; **optional** `apps/*/package.json` lines print as “not installed yet” until those apps are restored from upstream.

## Lint (packages)

```bash
npm run lint
```

**Expect:** exit `0` (warnings allowed up to cap; tighten over time).

## Unit tests — shared packages (current baseline)

```bash
npm run test:packages
```

**Expect:** all tests in `packages/**/*.test.ts` pass (Vitest; see root [`vitest.config.ts`](../../vitest.config.ts)).

## Publish queue package

```bash
npm run build -w @home-link/marketer-pro-queue
```

**Expect:** `packages/marketer-pro-queue/dist/` emitted without errors. Worker runtime: [`redis-bullmq.md`](redis-bullmq.md).

## Unit / API tests — API (when restored)

From repo root (after `apps/api/package.json` and workspace wiring exist):

```bash
npx vitest run apps/api/src
```

**Expect:** all tests pass; fix or skip only with documented issue in daily log.

## End-to-end — Marketer Playwright

When `apps/marketer-pro-e2e` and web/API dev servers are wired:

```bash
npm run test:e2e:marketer:ci
```

(or the exact script name from root `package.json` once restored). Use `scripts/e2e-marketer-webserver.mjs` for local orchestration if documented in package scripts.

## Recording results

Append outcomes to [`docs/test-log.md`](../test-log.md) with date, SHA, commands, pass/fail.

## Definition of done

- Code change + tests updated + **daily log** bite-sized steps + **test log** entry when commands were executed.

Prefer capturing **daily log + test log together at end of day** (last workflow step), unless an immediate test-log entry is required (see [`README.md`](README.md)).

## Review sequence (code + config changes)

Run from repo root, in order:

1. `npm install` (if `package.json` / lockfile changed)
2. `npm run verify`
3. `npm run typecheck`
4. `npm run lint`
5. `npm run test:packages`
6. `node scripts/pre-commit-verify.mjs` (optional; matches smart pre-push checks)
7. If you changed the queue package: `npm run build:queue`
8. When `apps/*` is restored: `npx vitest run apps/api/src` and `npm run test:e2e:marketer:ci` (or upstream script name)
