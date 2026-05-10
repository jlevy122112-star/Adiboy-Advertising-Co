# Repository scope inventory (Marketer-Pro)

**Rule:** Anything not required to ship **Marketer-Pro** does not belong here. Tags: **Marketer-Pro** | **shared-tooling** | **obsolete**.

| Path | Tag | Notes |
|------|-----|--------|
| `apps/api` | Marketer-Pro | HTTP API + SQLite Marketer Pro backend (restore full tree from source control if sparse). |
| `apps/web` | Marketer-Pro | Vite + React web client. |
| `apps/marketer-pro-mobile` | Marketer-Pro | Expo / React Native. |
| `apps/marketer-pro-e2e` | Marketer-Pro | Playwright E2E for Marketer flows. |
| `packages/marketer-pro-contract` | Marketer-Pro | Zod schemas / contracts for Marketer product surfaces. |
| `packages/marketer-pro-queue` | Marketer-Pro | BullMQ + ioredis — `marketer-publish` queue, worker CLI, typed payloads. |
| `packages/contracts` | Marketer-Pro | Shared platform contracts (RBAC, tenant, billing webhook, bootstrap ingress). Distinct from marketer-pro-contract; keep until consumers consolidated. |
| `packages/ui` | Marketer-Pro | Shared UI package for apps. |
| `packages/config` | shared-tooling | `tsconfig.base.json` and workspace TS baseline. |
| `scripts/e2e-marketer-webserver.mjs` | Marketer-Pro | Spins API + Vite for Marketer E2E. |
| `scripts/marketer-publish-queue-worker.example.mjs` | Marketer-Pro | Example BullMQ worker for future P3 queue. |
| `scripts/pre-commit-verify.mjs` | shared-tooling | Pre-commit checks. |
| `scripts/verify-workspace.mjs` | shared-tooling | Workspace bootstrap validation (expects full monorepo layout). |
| `scripts/tests-checks-orchestrator.mjs` | shared-tooling | Test orchestration. |
| `scripts/daily-progress-snapshot.mjs` | shared-tooling | Progress snapshots (ops). |
| `scripts/sync-backlog-to-issues.mjs` | shared-tooling | Backlog → issues automation (optional). |
| `.husky/` | shared-tooling | Git hooks. |
| `.github/` | shared-tooling | CI / templates (if present). |
| `docs/` | Marketer-Pro | Product + engineering documentation (this tree). |
| `data/` | Marketer-Pro | Local SQLite path for dev (do not commit DB blobs). |
| `e2e/` | Marketer-Pro | E2E assets (respect `.gitignore` for secrets). |
| `workflows/` | **obsolete** | Legacy wholesaler/CRM doc dump; **removed** — not Marketer-Pro. |
| `workflows-cleaned/` | **obsolete** | Duplicate/scratch doc set; **removed** — not Marketer-Pro. |
| `reports/` | shared-tooling | Generated reports; prefer gitignored outputs where applicable. |
| `test-results/` | shared-tooling | Test artifacts (gitignored). |

**Follow-up:** Root [`package.json`](../../package.json) with npm `workspaces` and Vitest are in place; still restore **`tsconfig.workspaces.json`**, **`apps/*` `package.json`**, and full sources from the authoritative remote so `verify-workspace.mjs`, API tests, and Playwright E2E run end-to-end.
