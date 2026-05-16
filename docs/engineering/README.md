# Engineering documentation

| Doc | Purpose |
|-----|---------|
| [SCOPE-INVENTORY.md](./SCOPE-INVENTORY.md) | What belongs in this repo for Marketer-Pro vs tooling vs removed clutter. |
| [testing-doctrine.md](./testing-doctrine.md) | Canonical commands for typecheck, unit tests, E2E; parity with CI. |
| [version-control.md](./version-control.md) | Hooks (pre-commit / pre-push), CI, and habits so work stays on **Git + remote**. |
| [daily/](./daily/) | Per-day engineering logs — granular steps, not vague “phases.” |
| [../test-log.md](../test-log.md) | Append-only record of test runs and outcomes. |
| [../go-live-readiness.md](../go-live-readiness.md) | Launch checklist: product, billing, legal, infrastructure — with Marketer-Pro mapping. |
| [redis-bullmq.md](./redis-bullmq.md) | Redis / ioredis / BullMQ publish queue — env, commands, producer integration. |
| [brand-memory-ingest-handler.md](./brand-memory-ingest-handler.md) | Brand memory (`006_*` migration): ingest pseudocode, kNN SQL, contract embedding rules, HTTP server entry (`start:brand-memory`). |

**End of day (last thing):** Update **all** logs you touched or that are due for the calendar day—**[`daily/YYYY-MM-DD.md`](./daily/)** (session narrative + bites), **[`test-log.md`](../test-log.md)** (commands + pass/fail + SHA when you ran tests), and any other checklist you moved forward (e.g. readiness rows). Do this **once at wrap-up** instead of scattering updates throughout the day, unless a run must be recorded immediately for CI/incidents.

**During the day:** Still OK to append **test-log** right after a meaningful test run when traceability can’t wait until EOD.

**Agent / assistant sessions:** If you ship a **meaningful slice** (new routes, migrations, contract surfaces), update in the **same session**: relevant rows in **[`../full-build-plan.md`](../full-build-plan.md)** (repo checkpoints), any touched **engineering** doc, **[`daily/YYYY-MM-DD.md`](./daily/)** (what changed + why), and **[`test-log.md`](../test-log.md)** (commands + pass/fail). That is the project’s substitute for a single auto-generated “everything doc”—it stays current only when every slice does this closeout.
