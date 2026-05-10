# Go-live readiness — Marketer-Pro

This checklist converts common SaaS launch criteria into **traceable product work** for Marketer-Pro. It is **not** legal advice; engage counsel for Terms, Privacy, DPIA, and DPAs.

Update this file when evidence moves (PR links, deployed URLs, audit dates). Pair operational execution with [`engineering/daily/`](engineering/daily/) logs.

---

## Product readiness

| Criterion | Target | Marketer-Pro status / notes |
|-----------|--------|-------------------------------|
| Core workflow E2E | Tested on **desktop and mobile** | Track in Playwright + manual Expo smoke; gate releases on green suites when `apps/*` is fully wired. |
| Onboarding | **Under 2 minutes**, guided tour | Product/UI work; measure with session timing + funnel analytics once instrumentation exists. |
| Beta program | **20–50** target users; critical bugs fixed | Define cohort, feedback channel, and exit criteria before scaling traffic. |
| Error UX | **404 / 500** and graceful failure paths | Web + API consistent error shapes; dedicated routes/pages per app shell. |
| Performance | **Page load &lt; ~3s** (field definition: LCP/CWV); **API P95 &lt; ~200ms** for hot paths | Establish budgets in staging/prod; load-test after Postgres/Redis split if DB-bound. |
| Accessibility | Keyboard nav, screen reader basics, contrast | WCAG-oriented audit on web; Expo accessibility props on mobile critical flows. |

---

## Billing and payments

| Criterion | Notes | Marketer-Pro status / notes |
|-----------|-------|-------------------------------|
| Payment processor | Stripe vs **Paddle** vs **Lemon Squeezy** | Architecture references **Stripe** webhooks (`STRIPE_*` env). **Stripe**: flexible Billing + webhooks; you remain merchant of record for tax/compliance unless using Tax/Customer Portal patterns. **Paddle / Lemon Squeezy**: merchant-of-record options simplify VAT/GST in many regions—evaluate fee structure vs control. Choose one stack per environment; avoid dual active processors without a migration plan. |
| Subscription lifecycle | Trials, upgrade/downgrade, cancel | Implement via Stripe Billing (or chosen MoR) + webhook handlers idempotent with DB state machine. |
| Webhooks | Payment events verified | **Critical:** signature verification (`STRIPE_WEBHOOK_SECRET`), replay protection, dead-letter on failure. |
| Invoicing / receipts | Automated | Stripe-hosted invoices/receipts or provider equivalents; email templates branded. |
| Refund policy | e.g. **14-day** no-questions | Publish in Legal; enforce eligibility in support runbooks. |
| Pricing page | **2–3** clear tiers | Marketing site + in-app alignment with entitlements (`plan-entitlements` / contract layer). |

---

## Legal and compliance

| Criterion | Notes | Marketer-Pro status / notes |
|-----------|-------|-------------------------------|
| Terms of Service & Privacy | Published URLs | Use structured generators (e.g. Termly) **then** lawyer review (typical **$500–1k** range cited for light-touch review—budget per counsel). |
| GDPR-style rights | Cookie consent, **export**, **deletion**, DPIA if high-risk | Align with architecture: account deletion API, OAuth revoke, minimize retained logs; DPIA when AI/special categories scale. |
| SOC 2 posture | If enterprise sales | Controls documented; consider **Vanta** / **Drata** for continuous evidence (cost/vendor evaluation separate). |
| Acceptable Use Policy | Published | Especially important for UGC/social posting product surfaces. |
| DPA | Ready for enterprise | Template + signature workflow when selling B2B with EU orgs. |

---

## Technical infrastructure

| Criterion | Notes | Marketer-Pro status / notes |
|-----------|-------|-------------------------------|
| Production hosting | Reliable platform (e.g. **Vercel** vs **Railway** vs containers) | Pick per workload: static/edge vs long-lived Node API vs workers; document in [`internal/runtime-architecture.md`](internal/runtime-architecture.md). |
| Auto-scaling | Traffic spikes | Depends on deploy target; queue-backed workers scale horizontally after **P3** patterns. |
| CDN | e.g. **Cloudflare** | Front APIs and static assets; WAF/rate limits at edge where possible. |
| Database backups | Automated + **restored test** | Mandatory before declaring production-ready; include RPO/RTO targets. |
| CI/CD | Zero-downtime deploys | Pipeline mirrors [`testing-doctrine.md`](engineering/testing-doctrine.md); protect `main`. |
| Monitoring / alerting | **Datadog**, New Relic, **Sentry**, etc. | Define SLOs (availability, error rate, publish success); paging policy for on-call if applicable. |
| Stress test | **~10×** expected traffic | k6/Artillery against realistic scenarios **after** DB/queue architecture matches prod topology. |
| DDoS protection | Edge/WAF | Usually CDN + provider protections; document blast-radius scenarios. |
| Feature flags | Gradual rollout | Safer launches for OAuth scopes, AI features, and publisher paths. |

---

## How to use this doc

1. **Assign owners** per row (engineering, legal, product).
2. **Attach evidence**: PRs, dashboard screenshots, runbook links—not checkbox theater.
3. **Review monthly** until launch, then quarterly for enterprise tier.

---

_See also [`marketer-pro-target-architecture.md`](marketer-pro-target-architecture.md) for phased engineering north star._
