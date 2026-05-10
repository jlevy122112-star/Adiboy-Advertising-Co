# Marketer-Pro — internal runtime architecture

This document describes **what each major part does when the system is online** and **why** it exists. Update in the same change set whenever behavior or boundaries shift.

## Clients

| Component | Role when online | Why |
|-----------|------------------|-----|
| **Web (`apps/web`)** | Vite + React UI for tenant workflows, OAuth channel hints, scheduling UX. | Primary operator surface; must stay aligned with API contracts. |
| **Mobile (`apps/marketer-pro-mobile`)** | Expo app for iOS/Android; shares API + auth model with web. | Store presence and push-capable workflows. |

## API (`apps/api`)

| Area | Role when online | Why |
|------|------------------|-----|
| **HTTP server** | Serves `/api/v1/*`, JWT auth, marketer routes, webhooks. | Single deployment unit until services split. |
| **SQLite (Phase 0–1)** | Persists tenants, schedules, social connections, OAuth state. | Fast local/dev; **P3** targets Postgres for multi-instance. |
| **Publish path** | Reads schedule entries, dispatches to Meta / TikTok / X / LinkedIn per configuration. | Core product output; must be idempotent where modeled. |
| **OAuth callbacks** | Completes Meta/X/TikTok/LinkedIn OAuth; stores tokens in `social_connections`. | Official APIs only — no scraping. |
| **Token refresh sweep** | Periodic refresh for providers that expose refresh tokens (when configured). | Prevents silent publish failures as access tokens expire. |

## Workers (publish queue)

| Component | Role when online | Why |
|-----------|------------------|-----|
| **`@home-link/marketer-pro-queue`** | BullMQ `Queue` + `Worker` on **`marketer-publish`**; ioredis connections with BullMQ-safe defaults; typed job payloads and retries/backoff. | Horizontal scale and durable retries vs in-process SQLite scheduler loop. |
| **`npm run queue:worker`** | Builds the package and runs `worker-cli.js` (replace stub processor with real publish runner). | Separate deployable process from HTTP API. |

See [`engineering/redis-bullmq.md`](../engineering/redis-bullmq.md).

## Data dependencies

| Store | Used for | Notes |
|-------|-----------|--------|
| **SQLite / future Postgres** | Tenants, campaigns, schedule, OAuth tokens | Encrypt secrets at rest in production. |
| **Redis** (future) | BullMQ queues | **P3** scale-out. |
| **Object storage** (future) | Media for posts | AI/video pipelines (**P5**). |

## External integrations

| Integration | Role | Compliance note |
|-------------|------|------------------|
| Meta Graph | Facebook/Instagram posting | App review for posting scopes. |
| TikTok APIs | Content posting | Partner quotas and OAuth. |
| X API v2 | Posting | Paid tiers / rate limits. |
| Stripe | Billing webhooks | Verify webhook signatures in production. |

---

_Diagrams and phased extraction order live in `docs/marketer-pro-target-architecture.md` (strategic). This file is the operational “what runs where” companion._
