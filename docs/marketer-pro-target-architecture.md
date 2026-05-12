# Marketer-Pro — target architecture & roadmap (north star)

**Purpose:** Single strategic reference for **service boundaries**, **compliance**, and **phased capabilities**. Day-to-day execution is tracked in [`engineering/daily/`](engineering/daily/) (granular steps), not as substitute for this file.

**Broader product phases (1–14):** [`full-build-plan.md`](./full-build-plan.md) — brand intelligence through security and collaboration.

## Baseline (this product)

| Area | Direction |
|------|------------|
| Web | Vite + React (`apps/web`) |
| Mobile | Expo (`apps/marketer-pro-mobile`) |
| API | Node HTTP + SQLite Marketer Pro (`apps/api`); Postgres + Redis in later phases |
| Social | Official APIs only — Meta Graph, TikTok partner APIs, X API v2, LinkedIn where enabled |
| Queue | In-process / SQLite-backed today; **Redis + BullMQ** for scale (**P3**) |
| Auth | JWT + Apple / Google OAuth paths as implemented; phone OTP deferred until Twilio/Verify wired |

## Phased roadmap (indicative)

| Phase | Focus |
|-------|--------|
| **P1** | Harden product: E2E green, staging, Stripe live, secrets hygiene |
| **P2** | Identity: Apple/Google polish, **account deletion** API + UI |
| **P3** | **Postgres + Redis**; BullMQ publish/retry — implementation checklist in [`marketer-pro-p7-scale-assets.md`](./marketer-pro-p7-scale-assets.md) (**§ Wire Bull**) |
| **P4** | Multi-network publisher (TikTok, X workers, unified job model) |
| **P5** | AI expansion (routing, media pipelines) |
| **P6** | Premium UX (planner, brand RAG, moderation) |
| **P7** | Scale & SRE — load tests, observability depth, production runbooks (**after** BullMQ is live from P3); same doc [`marketer-pro-p7-scale-assets.md`](./marketer-pro-p7-scale-assets.md) (**§§ 2–4**) |

## Compliance & stores (2026 checklist)

- Account deletion in-app; revoke OAuth; purge/anonymize per policy.
- AI transparency and consent stored; badge AI-assisted drafts.
- Privacy labels aligned with actual data types collected.
- Minimum OS/SDK versions at submission time per Apple/Google requirements.

## Scaling rule

Extract **publisher + moderation + analytics batch workers** first when outbound volume exceeds safe single-process limits.

---

_Detail level intentionally concise; pair with [`internal/runtime-architecture.md`](../internal/runtime-architecture.md) for “what runs when online.”_

**Go-to-market readiness:** commercial, legal, and infra gate items live in [`go-live-readiness.md`](../go-live-readiness.md).
