# Test log (append-only)

Maintain one entry per verification run that accompanies meaningful code changes. Use ISO date and **local** timezone.

**Routine:** Batch updates **at end of day** with the rest of the logs (see [`engineering/README.md`](engineering/README.md)); append sooner only when you need immediate audit trail (CI failure, release cut).

---

## 2026-05-09 — baseline (packages only)

| Field | Value |
|--------|--------|
| **When** | 2026-05-09 (local) |
| **Git SHA** | _none — repository had no commits at run time_ |
| **Environment** | Windows; Node from PATH; repo `Wholesaler-Pro-b01-bootstrap-upgrades` |
| **Runner** | engineering / agent |

### Commands & results

| Command | Result |
|---------|--------|
| `node node_modules/typescript/lib/tsc.js -p packages/contracts/tsconfig.json --pretty false` | PASS (exit 0) |
| `node node_modules/typescript/lib/tsc.js -p packages/marketer-pro-contract/tsconfig.json --pretty false` | PASS (exit 0) |
| `node node_modules/typescript/lib/tsc.js -p packages/ui/tsconfig.json --pretty false` | PASS (exit 0) |
| `vitest run apps/api/src` | NOT RUN — apps/api not buildable without restored workspace |
| Playwright Marketer E2E | NOT RUN — same |

### Notes

- Full-matrix “green” requires restoring workspace root manifests and app packages per `scripts/verify-workspace.mjs`.

---

## 2026-05-09 — packages typecheck + vitest (after root `package.json` repair)

| Field | Value |
|--------|--------|
| **When** | 2026-05-09 (local) |
| **Git SHA** | `597b317f714f3c5421df932b5b4107c3b308afd9` |
| **Environment** | Windows; Node v22.22.0; `npm install` at repo root with `workspaces: ["packages/*"]` |
| **Runner** | engineering / agent |

### Commands & results

| Command | Result |
|---------|--------|
| `npm run typecheck` | PASS — all three `tsc` project references exit 0 |
| `npm run test:packages` (`vitest run`, 11 files) | PASS — **35 tests**, 0 failed |

### Artifacts

- [`package.json`](../package.json) (root), [`vitest.config.ts`](../vitest.config.ts), `package-lock.json` from `npm install`.

---

## 2026-05-09 — `@home-link/marketer-pro-queue` (BullMQ + ioredis)

| Field | Value |
|--------|--------|
| **When** | 2026-05-09 (local) |
| **Environment** | Windows; Node v22.x; Redis optional for worker smoke |

### Commands & results

| Command | Result |
|---------|--------|
| `npm run typecheck` | PASS — includes `packages/marketer-pro-queue` |
| `npm run build -w @home-link/marketer-pro-queue` | PASS |
| `npm run test:packages` | PASS — **40 tests** (13 files), incl. queue schema + job-option tests |

### Notes

- Worker CLI: `npm run queue:worker` (builds then runs `dist/worker-cli.js`). Processor is still a **stub** until wired to `apps/api` publish runner.
- Ops reference: [`engineering/redis-bullmq.md`](engineering/redis-bullmq.md).
