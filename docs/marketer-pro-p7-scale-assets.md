# Scale, queue ops & SRE assets (`marketer-pro-p7-scale-assets`)

This doc holds **(A)** the concrete **BullMQ wiring checklist** (roadmap **P3**) and **(B)** **P7** work—proving scale and operating in production. Names stay historical (`p7` in the filename); roadmap phases are the source of truth ([`marketer-pro-target-architecture.md`](./marketer-pro-target-architecture.md)).

| Roadmap | What lives here |
|---------|------------------|
| **P3** | § **Wire Bull** — Redis + worker + producer integration |
| **P7** | §§ **Prove scale**, **Observability**, **Runbooks** — after the queue path is live |

---

## Wire Bull — implementation checklist (P3)

Complete in order. Use [`docs/engineering/redis-bullmq.md`](./engineering/redis-bullmq.md) for env vars and API snippets.

### 1. Infrastructure

1. **Redis running** at `REDIS_URL` (default `redis://127.0.0.1:6379`). Quick local option:
   `docker run -d --name marketer-redis -p 6379:6379 redis:7-alpine`
2. Confirm connectivity (optional): `redis-cli -u "$REDIS_URL" ping` → `PONG`.

### 2. Package build & worker process

3. From monorepo root: `npm install`
4. `npm run build -w @home-link/marketer-pro-queue` (or rely on `queue:worker`, which builds first)
5. **`npm run queue:worker`** — worker listens on queue **`marketer-publish`**. [`worker-cli.ts`](../packages/marketer-pro-queue/src/worker-cli.ts) uses **`resolvePublishRunnerFromEnv()`**: set **`MARKETER_PUBLISH_HTTP_URL`** for the HTTP runner, or omit it for the **stub** (local dev).

### 3. Producer (`apps/api` or scheduler)

6. Add workspace dependency: `@home-link/marketer-pro-queue` on the API package when `apps/api` is the publisher.
7. At startup (or lazy singleton): `createRedisConnection()` → `createPublishQueue(connection)`; reuse **one** queue instance per process.
8. On “publish due” / user action: `enqueuePublishJob(publishQueue, { scheduleEntryId, tenantId, idempotencyKey?, network?, correlationId? })` — see Zod schema in [`publish-job.ts`](../packages/marketer-pro-queue/src/publish-job.ts).
9. Pass **`idempotencyKey`** when the same logical publish must not enqueue twice (maps to BullMQ `jobId` when set).

### 4. Replace stub processor

10. **Worker → publish execution:** `worker-cli.ts` calls **`createHttpPublishRunner`** when `MARKETER_PUBLISH_HTTP_URL` is set (POST body `{ payload, context }`, response JSON **`PublishJobResult`**). Implement that route in **`apps/api`** (or point the URL at a sidecar that imports your publisher module). Alternative: swap `resolvePublishRunnerFromEnv()` for a **shared module** runner that invokes the same code as in-process publish — keep **`PublishJobResult`** (`ok`, `detail`, `externalId`).

### 5. Verify

11. `npm run typecheck` and `npm run test:packages`
12. Enqueue one job: **`npm run queue:enqueue-smoke`** (with **`npm run queue:worker`** in another terminal), then confirm worker logs `publish_job_received` then `job_completed` JSON lines.

---

## Prove scale — load & performance (P7)

Applies once P3 wiring is done.

| Asset | Purpose |
|--------|---------|
| [`scripts/k6/marketer-api-smoke.js`](../scripts/k6/marketer-api-smoke.js) | API smoke / baseline |
| Extend k6 or add scenarios | Publish enqueue rate, worker throughput, Redis saturation |
| Target metrics | p95 enqueue latency, job completion rate, worker CPU, Redis memory/latency |

Document baseline numbers and acceptable regressions when you change worker concurrency or publish logic.

---

## Observability (P7)

| Area | Minimum bar |
|------|-------------|
| Logs | Structured JSON from worker (`publish_job_received`, `job_completed`, `job_failed`) |
| Tracing | Propagate `correlationId` from API → queue payload → worker logs |
| Metrics | Queue depth, processing lag, failure rate; Redis health |
| Alerts | Sustained failure rate, stalled jobs, Redis unreachable |

---

## Runbooks (P7)

1. **Redis unavailable** — Verify `REDIS_URL`, network/TLS, ACL; workers exit or reconnect per client behavior; scale/read replicas per hosting guide.
2. **Publish backlog growing** — Add workers, raise concurrency cautiously, check slow processors and downstream API rate limits.
3. **Repeated job failures** — Inspect BullMQ failed jobs; fix processor bug or backoff; consider DLQ/replay policy.

---

## Quick reference — queue & Redis (BullMQ)

| Asset | Location / command |
|--------|---------------------|
| Connection defaults (`REDIS_URL`, Bull-safe client) | [`packages/marketer-pro-queue/src/redis.ts`](../packages/marketer-pro-queue/src/redis.ts) |
| Queue name & enqueue API | [`packages/marketer-pro-queue`](../packages/marketer-pro-queue/) — queue **`marketer-publish`** |
| Worker entry | [`packages/marketer-pro-queue/src/worker-cli.ts`](../packages/marketer-pro-queue/src/worker-cli.ts) |
| Env vars | [`docs/engineering/redis-bullmq.md`](./engineering/redis-bullmq.md) |

**Operations**

- Multiple worker processes + same `REDIS_URL` → horizontal scale; tune `MARKETER_PUBLISH_WORKER_CONCURRENCY` per process.
- Production: **`rediss://`**, secrets injection, separate Redis for BullMQ vs cache if needed.

---

## Links

- [`docs/engineering/redis-bullmq.md`](./engineering/redis-bullmq.md) — BullMQ wiring and `npm run queue:worker`
- [`go-live-readiness.md`](../go-live-readiness.md) — broader launch gates
