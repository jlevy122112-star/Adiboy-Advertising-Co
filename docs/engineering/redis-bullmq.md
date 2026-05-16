# Redis, ioredis, and BullMQ (Marketer-Pro publish path)

This stack replaces **in-process** publish attempts when you need horizontal scale, retries with backoff, and observable job failures.

## Packages

- `**ioredis`** — Redis client. Connections used by BullMQ **must** set `maxRetriesPerRequest: null` (handled by `[createRedisConnection](../../packages/marketer-pro-queue/src/redis.ts)` in `@home-link/marketer-pro-queue`).
- `**bullmq`** — `Queue` + `Worker` for the `**marketer-publish**` queue.
- `**@home-link/marketer-pro-queue**` — Typed payloads (`PublishJobPayload`), defaults for retries/backoff/cleanup, worker wrapper, CLI entry, and the `PublishRunner` seam (`createStubPublishRunner` until `apps/api` exposes a real publish module).

## Environment


| Variable                                                                       | Purpose                                                                                                                                       | Default                                                     |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `REDIS_URL`                                                                    | Broker URL                                                                                                                                    | `redis://127.0.0.1:6379`                                    |
| `MARKETER_PUBLISH_JOB_ATTEMPTS`                                                | Job attempts                                                                                                                                  | `5`                                                         |
| `MARKETER_PUBLISH_BACKOFF_MS`                                                  | Exponential backoff base delay (ms)                                                                                                           | `2000`                                                      |
| `MARKETER_PUBLISH_WORKER_CONCURRENCY`                                          | Worker parallelism                                                                                                                            | `5`                                                         |
| `MARKETER_PUBLISH_HTTP_URL`                                                    | When set, worker POSTs each job to this URL (see below)                                                                                       | *(unset → stub runner)*                                     |
| `MARKETER_PUBLISH_HTTP_TOKEN`                                                  | Optional `Authorization: Bearer` for the HTTP runner                                                                                          | *(unset)*                                                   |
| `MARKETER_PUBLISH_HTTP_TIMEOUT_MS`                                             | HTTP request timeout for the publish runner                                                                                                   | `60000`                                                     |
| `MARKETER_SCHEDULER_HTTP_TOKEN`                                                | Optional Bearer token required by the producer-side scheduler server                                                                          | *(unset → no auth)*                                         |
| `SCHEDULER_PUBLISH_HOST` / `SCHEDULER_PUBLISH_PORT` / `SCHEDULER_PUBLISH_PATH` | Bind/path overrides for the scheduler HTTP server                                                                                             | `127.0.0.1` / `8791` / `/api/marketer-pro/publish/schedule` |
| `DATABASE_URL`                                                                 | When set, internal publish loads `**schedule_entries*`* in Postgres before routing; missing rows → `**schedule_entry_not_found_in_postgres**` | *(unset → in-memory stub path only)*                        |
| `MARKETER_GENERATION_HTTP_TOKEN`                                               | Optional Bearer token for the **generation draft** HTTP server (Phase 2)                                                                      | *(unset → no auth)*                                         |
| `MARKETER_GENERATION_HTTP_CORS`                                                | Optional CORS for browser clients to that server (`*` or comma-separated `Origin` values), same rules as `MARKETER_CAMPAIGN_HTTP_CORS`         | *(unset → no CORS headers)*                                 |
| `MARKETER_OPENAI_API_KEY` / `OPENAI_API_KEY`                                   | When either is set, **generation draft** create calls OpenAI Chat Completions (`generateDraftBodyFromBrief`); otherwise the deterministic stub runs | *(unset → stub only)*                                       |
| `MARKETER_OPENAI_BASE_URL`                                                     | OpenAI-compatible API root (must include `/v1`, e.g. `https://api.openai.com/v1` or your gateway)                                            | `https://api.openai.com/v1`                                 |
| `MARKETER_GENERATION_MODEL`                                                    | Chat model id for draft generation                                                                                                           | `gpt-4o-mini`                                               |
| `GENERATION_DRAFT_HOST` / `GENERATION_DRAFT_PORT`                                | Bind for `**start:generation-draft**` (`**8792**` default)                                                                                    | `127.0.0.1` / `8792`                                        |
| `GENERATION_DRAFT_PATH_CREATE` / `GENERATION_DRAFT_PATH_APPROVE` / `GENERATION_DRAFT_PATH_REJECT` | POST paths for brief→draft, approval, rejection | `/api/marketer-pro/generation/draft-from-brief` / `/api/marketer-pro/generation/draft-approve` / `/api/marketer-pro/generation/draft-reject` |
| `GENERATION_DRAFT_PATH_GET` / `GENERATION_DRAFT_PATH_LIST_BY_BRIEF` | GET one draft (`?tenantId=&draftId=`); list draft summaries for a brief (`?tenantId=&briefId=`; optional `limit` 1–100, default 20) | `/api/marketer-pro/generation/draft` / `/api/marketer-pro/generation/drafts-by-brief` |
| `MARKETER_CAMPAIGN_HTTP_TOKEN`                                                 | Optional Bearer token for the **campaign** HTTP server (Phase 4)                                                                              | *(unset → no auth)*                                         |
| `MARKETER_CAMPAIGN_HTTP_CORS`                                                  | Browser cross-origin access: `*` (dev) or comma-separated allowed `Origin` values (e.g. `http://localhost:5173`) — enables `OPTIONS` preflight + `Access-Control-Allow-*` | *(unset → same-origin only)*                                |
| `CAMPAIGN_HTTP_HOST` / `CAMPAIGN_HTTP_PORT`                                    | Bind for `**start:campaign**` (`**8793**` default)                                                                                           | `127.0.0.1` / `8793`                                        |
| `CAMPAIGN_HTTP_PATH_CREATE` / `CAMPAIGN_HTTP_PATH_GET` / `CAMPAIGN_HTTP_PATH_LIST` / `CAMPAIGN_HTTP_PATH_SCHEDULE_LIST` / `CAMPAIGN_HTTP_PATH_SCHEDULE_ATTACH` | POST create (`CreateCampaignBodySchema`); GET one (`?tenantId=&campaignId=`); GET list campaigns (`?tenantId=`; optional `limit` 1–100, default 20); GET list schedule rows for a campaign (`?tenantId=&campaignId=`; optional `limit` 1–100, default 50; `ListScheduleEntriesForCampaignQuerySchema`); POST attach (`AttachScheduleEntryCampaignBodySchema` — set or clear `schedule_entries.campaign_id`) | `/api/marketer-pro/campaigns/create` / `/api/marketer-pro/campaigns/get` / `/api/marketer-pro/campaigns/list` / `/api/marketer-pro/campaigns/schedule-entries` / `/api/marketer-pro/campaigns/schedule-attach` |


## Generation draft HTTP (Phase 2)

Separate from BullMQ: **`npm run build -w @home-link/marketer-api`** then **`npm run start:generation-draft -w @home-link/marketer-api`**. Requires **`DATABASE_URL`** and migration **`004_generation_drafts.sql`** (`npm run db:migrate -w @home-link/marketer-api`). Implementation: [`generation-draft-server.ts`](../../apps/api/src/generation-draft-server.ts), routes in [`generation-draft-route.ts`](../../apps/api/src/marketer-pro/generation-draft-route.ts), persistence in [`generation-draft.ts`](../../apps/api/src/db/generation-draft.ts), draft body in [`generate-draft-body.ts`](../../apps/api/src/marketer-pro/generate-draft-body.ts) (`generateDraftBodyFromBrief` — OpenAI when `MARKETER_OPENAI_API_KEY` or `OPENAI_API_KEY` is set, else deterministic stub; [`openai-draft-chat.ts`](../../apps/api/src/marketer-pro/openai-draft-chat.ts)). **GET** handlers read only query strings (no JSON body).

## Campaign HTTP (Phase 4)

**`npm run build -w @home-link/marketer-api`** then **`npm run start:campaign -w @home-link/marketer-api`**. Requires **`DATABASE_URL`** and migration **`003_campaigns_and_schedule_campaign_id.sql`**. Implementation: [`campaign-server.ts`](../../apps/api/src/campaign-server.ts), routes in [`campaign-route.ts`](../../apps/api/src/marketer-pro/campaign-route.ts), persistence in [`campaign.ts`](../../apps/api/src/db/campaign.ts). **GET** routes use query strings only.

For **`apps/web`**, set **`VITE_CAMPAIGN_API_ORIGIN`** (e.g. `http://127.0.0.1:8793`) and enable **`MARKETER_CAMPAIGN_HTTP_CORS`** on the campaign process so [`CampaignSyncPanel.tsx`](../../apps/web/src/CampaignSyncPanel.tsx) can list/create rows from the browser. **POST** `**/campaigns/schedule-attach**` updates `schedule_entries.campaign_id` (see `AttachScheduleEntryCampaignBodySchema`). **GET** `**/campaigns/schedule-entries**` lists rows linked to a campaign (`ListScheduleEntriesForCampaignQuerySchema`).

## Postgres (roadmap **P3**)

- **Migrate:** from repo root, `npm run db:migrate` (requires `DATABASE_URL`). SQL lives in `[apps/api/db/migrations](../../apps/api/db/migrations)`.
- **Local DB (example):** `docker run -d --name marketer-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=marketer -p 5432:5432 postgres:16-alpine` then `DATABASE_URL=postgres://postgres:dev@127.0.0.1:5432/marketer`.
- **Seed a row** for smoke tests: `INSERT INTO schedule_entries (tenant_id, id, network, status) VALUES ('tenant-1', 'sched-1', 'meta', 'scheduled');` (`tenant_id` + `id` must match the publish job payload and form the composite primary key).
- **Post-publish:** when `DATABASE_URL` is set, `runPublishForScheduleEntry` updates matching rows to `**published*`* or `**failed**` (see `persistScheduleEntryPublishOutcome` in `[schedule-entry.ts](../../apps/api/src/db/schedule-entry.ts)`); skips when the row was never loaded (`schedule_entry_not_found_in_postgres`) or the read errored (`postgres_query_failed:*`).

## Multi-network routing (roadmap **P4**)

Jobs carry optional `**network`** (string). `**classifyPublishNetwork**` (`[publish-network.ts](../../packages/marketer-pro-queue/src/publish-network.ts)`) maps synonyms (`facebook` → `meta`, `twitter` → `x`) and unknown labels (smoke tests, experiments) → `**generic**`. If Postgres is enabled, `**payload.network**` overrides the row’s `**network**` column when present. The internal publish server dispatches per slug in `[publish-dispatch.ts](../../apps/api/src/marketer-pro/publish-dispatch.ts)` — stubs today; swap in Meta Graph / X API v2 / TikTok partner calls per handler. Worker logs include `**publishNetwork**` (classified) and `**networkRaw**`.

## Implementation checklist (P3)

Step-by-step wiring (Redis, worker, producer, stub replacement) lives in `[docs/marketer-pro-p7-scale-assets.md](../marketer-pro-p7-scale-assets.md)` (**§ Wire Bull**).

## Commands

```bash
# Install deps (workspace root)
npm install

# Typecheck + unit tests (includes queue package tests)
npm run typecheck
npm run test:packages

# Build queue package and start worker (stub processor until wired to API)
npm run queue:worker

# Enqueue one smoke job (needs Redis; run worker in another terminal to process it)
npm run queue:enqueue-smoke

# Build API + start scheduler HTTP (enqueue producer; needs Redis for BullMQ)
npm run api:scheduler

# Build API + start internal publish HTTP (worker POST target)
npm run api:internal

# Build API + start campaign HTTP (Phase 4; needs DATABASE_URL)
npm run api:campaign

# Apply Postgres migrations (needs DATABASE_URL)
npm run db:migrate
```

## Producer (API) integration

A scaffold shim lives at `[apps/api/src/marketer-pro/schedule-publish.ts](../../apps/api/src/marketer-pro/schedule-publish.ts)` — it activates as soon as `apps/api` is restored to the workspace. The rest of the API only ever talks to `createPublishScheduler()` so swapping the broker (or short-circuiting in tests) stays a one-file edit.

```typescript
import { createPublishScheduler } from "./marketer-pro/schedule-publish.js";

const scheduler = createPublishScheduler();

await scheduler.schedulePublish({
  scheduleEntryId,
  tenantId,
  idempotencyKey: `publish:${scheduleEntryId}:${slotStart.toISOString()}`,
});

// graceful shutdown
await scheduler.close();
```

### Internal publish HTTP server (`apps/api`)

For local / staging wiring without the full API surface, run the minimal listener:

```bash
npm run start:internal -w @home-link/marketer-api
```

Defaults: `**127.0.0.1:8790**`, path `**/internal/publish/execute**`. Override with `**INTERNAL_PUBLISH_HOST**`, `**INTERNAL_PUBLISH_PORT**`, `**INTERNAL_PUBLISH_PATH**`. Set `**MARKETER_PUBLISH_HTTP_TOKEN**` on both this process and the worker when you want Bearer auth.

Point the worker at:

`MARKETER_PUBLISH_HTTP_URL=http://127.0.0.1:8790/internal/publish/execute`

**Worker POST body** (JSON): `{ "payload": <PublishJobPayload>, "context": { "jobId"?: string, "attempt": number } }` — validated by `InternalPublishExecuteBodySchema` in `[apps/api/src/marketer-pro/publish-execute.ts](../../apps/api/src/marketer-pro/publish-execute.ts)`. `attempt` must be a positive integer (1-indexed retry count).

**Responses (internal publish execute):**

- **200** — JSON body matches `**PublishJobResult`** (`ok`, optional `detail`, optional `externalId`).
- **400** — Zod validation: `{ "error": "validation_error", "message": "...", "issues": [ { "path": "...", "message": "...", "code": "..." } ] }`. Malformed JSON: `{ "error": "invalid_json" }`.
- **401** — `{ "error": "unauthorized" }` when `MARKETER_PUBLISH_HTTP_TOKEN` is set and `Authorization: Bearer` is missing or wrong.
- **404 / 405 / 413 / 500** — same transport semantics as the scheduler server below.

### Producer-side scheduler HTTP server (`apps/api`)

External triggers (cron, manual ops, third-party webhooks) call this server to enqueue publish jobs. It hosts the route handler in `[apps/api/src/marketer-pro/schedule-publish-route.ts](../../apps/api/src/marketer-pro/schedule-publish-route.ts)` and owns its `PublishScheduler` lifecycle.

```bash
npm run start:scheduler -w @home-link/marketer-api
```

Defaults: `**127.0.0.1:8791**`, path `**/api/marketer-pro/publish/schedule**`. Override with `**SCHEDULER_PUBLISH_HOST**`, `**SCHEDULER_PUBLISH_PORT**`, `**SCHEDULER_PUBLISH_PATH**`. Set `**MARKETER_SCHEDULER_HTTP_TOKEN**` to require Bearer auth on the producer endpoint (independent of the worker's `MARKETER_PUBLISH_HTTP_TOKEN`).

Request body (Zod-validated):

```json
{
  "scheduleEntryId": "sched_123",
  "tenantId": "tenant_a",
  "idempotencyKey": "publish:sched_123:2026-05-10T12:00:00Z",
  "correlationId": "trace-abc",
  "network": "meta",
  "jobOptions": { "priority": 5, "delay": 0 }
}
```

`jobOptions` is a strict subset (`priority`, `delay`, `jobId`); anything else is rejected with **400** so external callers can't reach into broker internals (`removeOnComplete`, locks, rate limits, etc.).

Responses:

- **202** — `{ "jobId": "...", "queueName": "marketer-publish" }` (job accepted; processing is async)
- **400** — `{ "error": "validation_error", "message": "..." }` or `{ "error": "invalid_json" }`
- **401** — `{ "error": "unauthorized" }` (when `MARKETER_SCHEDULER_HTTP_TOKEN` is set)
- **404 / 405 / 413 / 500** — standard transport-level errors

---

For ad-hoc enqueues outside the API, the lower-level primitives are still exported:

```typescript
import {
  createRedisConnection,
  createPublishQueue,
  enqueuePublishJob,
} from "@home-link/marketer-pro-queue";

const connection = createRedisConnection();
const publishQueue = createPublishQueue(connection);

await enqueuePublishJob(publishQueue, {
  scheduleEntryId,
  tenantId,
  idempotencyKey: `publish:${scheduleEntryId}:${slotStart}`,
});
```

Use `**idempotencyKey**` for at-most-once semantics per logical publish when Redis accepts `jobId`.

## Worker — runner seam

`worker-cli.ts` loads `resolvePublishRunnerFromEnv()`:

- If `**MARKETER_PUBLISH_HTTP_URL**` is set → `**createHttpPublishRunner**` POSTs `{ payload, context }` and expects a JSON `**PublishJobResult**` response.
- Otherwise → `**createStubPublishRunner**` (local dev without an API process).

You can still compose a custom runner in your own worker entry by importing `createHttpPublishRunner` or `createStubPublishRunner` from `@home-link/marketer-pro-queue` without changing BullMQ wiring.

## Roundtrip integration test

`packages/marketer-pro-queue/src/publish-roundtrip.test.ts` enqueues a job and asserts the worker processes it end-to-end against a live Redis. It auto-skips when no Redis is reachable at `REDIS_URL`, so it's safe on dev machines without a local broker.

```bash
# Run only when you have Redis up
REDIS_URL=redis://127.0.0.1:6379 npx vitest run \
  packages/marketer-pro-queue/src/publish-roundtrip.test.ts
```

## Operations

- **Stalled jobs:** Worker emits `stalled`; investigate slow processors or Redis latency.
- **Failures:** Exponential backoff then moves to failed set — tune `MARKETER_PUBLISH_*` and publisher timeouts.
- **Scaling:** Run **multiple worker processes** with same `REDIS_URL` (same queue name); adjust concurrency per process.
- **Production Redis:** TLS URLs (`rediss://`), ACL passwords, and separate Redis for BullMQ vs cache if needed.

## Migration from “last minute” wiring

- Do **not** instantiate raw `Worker`/`Queue` in app root without shared defaults — use `**@home-link/marketer-pro-queue`** so retries and Redis options stay consistent.
- Replace stub processor in `worker-cli.ts` with a call into your **publish runner** (shared module or internal HTTP) once `apps/api` is linked.

