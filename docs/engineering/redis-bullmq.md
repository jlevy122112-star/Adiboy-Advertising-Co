# Redis, ioredis, and BullMQ (Marketer-Pro publish path)

This stack replaces **in-process** publish attempts when you need horizontal scale, retries with backoff, and observable job failures.

## Packages

- **`ioredis`** — Redis client. Connections used by BullMQ **must** set `maxRetriesPerRequest: null` (handled by [`createRedisConnection`](../../packages/marketer-pro-queue/src/redis.ts) in `@home-link/marketer-pro-queue`).
- **`bullmq`** — `Queue` + `Worker` for the **`marketer-publish`** queue.
- **`@home-link/marketer-pro-queue`** — Typed payloads (`PublishJobPayload`), defaults for retries/backoff/cleanup, worker wrapper, CLI entry, and the `PublishRunner` seam (`createStubPublishRunner` until `apps/api` exposes a real publish module).

## Environment

| Variable | Purpose | Default |
|----------|---------|---------|
| `REDIS_URL` | Broker URL | `redis://127.0.0.1:6379` |
| `MARKETER_PUBLISH_JOB_ATTEMPTS` | Job attempts | `5` |
| `MARKETER_PUBLISH_BACKOFF_MS` | Exponential backoff base delay (ms) | `2000` |
| `MARKETER_PUBLISH_WORKER_CONCURRENCY` | Worker parallelism | `5` |
| `MARKETER_PUBLISH_HTTP_URL` | When set, worker POSTs each job to this URL (see below) | _(unset → stub runner)_ |
| `MARKETER_PUBLISH_HTTP_TOKEN` | Optional `Authorization: Bearer` for the HTTP runner | _(unset)_ |
| `MARKETER_PUBLISH_HTTP_TIMEOUT_MS` | HTTP request timeout for the publish runner | `60000` |

## Implementation checklist (P3)

Step-by-step wiring (Redis, worker, producer, stub replacement) lives in [`docs/marketer-pro-p7-scale-assets.md`](../marketer-pro-p7-scale-assets.md) (**§ Wire Bull**).

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
```

## Producer (API) integration

A scaffold shim lives at [`apps/api/src/marketer-pro/schedule-publish.ts`](../../apps/api/src/marketer-pro/schedule-publish.ts) — it activates as soon as `apps/api` is restored to the workspace. The rest of the API only ever talks to `createPublishScheduler()` so swapping the broker (or short-circuiting in tests) stays a one-file edit.

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

Use **`idempotencyKey`** for at-most-once semantics per logical publish when Redis accepts `jobId`.

## Worker — runner seam

`worker-cli.ts` loads `resolvePublishRunnerFromEnv()`:

- If **`MARKETER_PUBLISH_HTTP_URL`** is set → **`createHttpPublishRunner`** POSTs `{ payload, context }` and expects a JSON **`PublishJobResult`** response.
- Otherwise → **`createStubPublishRunner`** (local dev without an API process).

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

- Do **not** instantiate raw `Worker`/`Queue` in app root without shared defaults — use **`@home-link/marketer-pro-queue`** so retries and Redis options stay consistent.
- Replace stub processor in `worker-cli.ts` with a call into your **publish runner** (shared module or internal HTTP) once `apps/api` is linked.
