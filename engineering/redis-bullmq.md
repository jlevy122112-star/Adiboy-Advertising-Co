# Redis, ioredis, and BullMQ (Marketer-Pro publish path)

This stack replaces **in-process** publish attempts when you need horizontal scale, retries with backoff, and observable job failures.

## Packages

- **`ioredis`** — Redis client. Connections used by BullMQ **must** set `maxRetriesPerRequest: null` (handled by [`createRedisConnection`](../../packages/marketer-pro-queue/src/redis.ts) in `@home-link/marketer-pro-queue`).
- **`bullmq`** — `Queue` + `Worker` for the **`marketer-publish`** queue.
- **`@home-link/marketer-pro-queue`** — Typed payloads (`PublishJobPayload`), defaults for retries/backoff/cleanup, worker wrapper, CLI entry.

## Environment

| Variable | Purpose | Default |
|----------|---------|---------|
| `REDIS_URL` | Broker URL | `redis://127.0.0.1:6379` |
| `MARKETER_PUBLISH_JOB_ATTEMPTS` | Job attempts | `5` |
| `MARKETER_PUBLISH_BACKOFF_MS` | Exponential backoff base delay (ms) | `2000` |
| `MARKETER_PUBLISH_WORKER_CONCURRENCY` | Worker parallelism | `5` |

## Commands

```bash
# Install deps (workspace root)
npm install

# Typecheck + unit tests (includes queue package tests)
npm run typecheck
npm run test:packages

# Build queue package and start worker (stub processor until wired to API)
npm run queue:worker
```

## Producer (API) integration

When `apps/api` is restored, enqueue from the scheduler / publish endpoint:

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
  idempotencyKey: `publish:${scheduleEntryId}:${slotStart}`, // optional dedupe
});
```

Use **`idempotencyKey`** for at-most-once semantics per logical publish when Redis accepts `jobId`.

## Operations

- **Stalled jobs:** Worker emits `stalled`; investigate slow processors or Redis latency.
- **Failures:** Exponential backoff then moves to failed set — tune `MARKETER_PUBLISH_*` and publisher timeouts.
- **Scaling:** Run **multiple worker processes** with same `REDIS_URL` (same queue name); adjust concurrency per process.
- **Production Redis:** TLS URLs (`rediss://`), ACL passwords, and separate Redis for BullMQ vs cache if needed.

## Migration from “last minute” wiring

- Do **not** instantiate raw `Worker`/`Queue` in app root without shared defaults — use **`@home-link/marketer-pro-queue`** so retries and Redis options stay consistent.
- Replace stub processor in `worker-cli.ts` with a call into your **publish runner** (shared module or internal HTTP) once `apps/api` is linked.
