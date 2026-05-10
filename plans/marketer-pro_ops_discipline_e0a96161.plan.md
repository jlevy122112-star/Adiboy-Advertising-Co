---
name: Marketer-Pro Ops Discipline
overview: Establish Marketer-Pro as the sole product scope in this monorepo, restore and maintain a green functional baseline through ruthless cleanup and thorough testing, and institutionalize documentation (daily granular work logs, user/help guides, internal runtime architecture) to Fortune-500 operational standards—without treating “current repo state” as a separate planning artifact.
todos:
  - id: scope-inventory
    content: Inventory apps/packages/scripts; tag Marketer-Pro vs obsolete vs shared tooling
    status: completed
  - id: purge-non-product
    content: Remove or relocate everything not required for Marketer-Pro shipping path
    status: completed
  - id: docs-skeleton
    content: "Add docs folders: engineering/daily/, test-log, user/, help/, internal/runtime-architecture.md + templates"
    status: completed
  - id: testing-doctrine
    content: Single doc listing canonical typecheck/unit/e2e commands and CI parity expectations
    status: completed
  - id: green-baseline
    content: Run full test matrix, append test log, fix until green (post-approval execution)
    status: completed
isProject: false
---

# Marketer-Pro: execution discipline, documentation, and quality bar

## Non-negotiable principles

- **Product scope:** Anything that is **not** part of shipping **Marketer-Pro** does not belong in this repository. Inventory → **keep only what is required** to build, run, test, and operate Marketer-Pro; **delete or relocate** the rest (archives, duplicate trees, unrelated packages/apps, dead scripts). If a file is needed for Marketer-Pro, it stays; otherwise it is removed **today** (no speculative hoarding).
- **Recovery is execution, not a plan pillar:** Getting the repo “functional” is **continuous implementation work** (fix layout, restore missing app roots, wire scripts, green tests)—document outcomes in the **daily log**, not as a special “phase” in the architecture roadmap.
- **Communication rhythm (3 days):** Prefer **documentation and commits** over chat. Status = **daily log entry + test log update**. No meta “what should we do” threads until catch-up goals are met.
- **Quality bar:** Treat deliverables as **enterprise-grade**: correctness, traceability (tests + logs), security hygiene (secrets, auth flows), and operational clarity (what runs where).

---

## 1. Repository scope and purge (Marketer-Pro-only)

**Decision rule:** A path stays only if it supports **Marketer-Pro** runtime, CI, E2E, or shared libraries **explicitly consumed** by Marketer-Pro apps/packages.

**Concrete actions (rolling, not one big bang unless safe):**

1. **Inventory** top-level `apps/`, `packages/`, `scripts/`, `docs/`, `workflows/`—tag each unit: `Marketer-Pro`, `shared-contract`, `tooling-only`, `obsolete`.
2. **Remove or extract** `obsolete` items (delete from repo, or move to a separate archive repo **outside** this workspace if legal/history requires retention—default is **delete**).
3. **Normalize naming and boundaries** so “Marketer-Pro” is unambiguous in paths and package names (align `@scope/*` and app folder names with the product; avoid duplicate nested folder names).
4. **Git hygiene:** Ensure `.gitignore` excludes generated artifacts (`node_modules`, build outputs, Playwright artifacts, local DB files where appropriate) **before** wide commits—never commit secrets.

*No dependency on “how broken things look today”—the rule set is fixed.*

---

## 2. Documentation system (actually maintained, not aspirational)

### 2.1 Daily engineering log (granular, not “phases”)

Create and maintain **[`docs/engineering/daily/`](docs/engineering/daily/)** (or equivalent under `docs/`) with **one file per calendar day** (e.g. `YYYY-MM-DD.md`).

**Each entry must include:**

- **Session goal** (1–3 sentences).
- **Steps completed** as a **numbered checklist** of **small bites** (e.g. “fixed API route X”, “added migration Y”, “updated env doc Z”)—**not** vague “Phase P2”.
- **Artifacts:** PR/commit hashes, commands run (high level), **test commands + results** (pass/fail, counts).
- **Blockers / risks** (explicit, short).
- **Next bites** (next session’s smallest actionable units).

This replaces long-form “phase” narration for day-to-day accountability.

### 2.2 Test log (always paired with green)

Maintain **[`docs/test-log.md`](docs/test-log.md)** (or `docs/engineering/test-log.md`) append-only by date:

- Date/time (timezone), **git SHA**, environment (OS/Node), commands (`tsc`, `vitest`, Playwright suites), **pass/fail**, artifact paths (reports), and **who ran** (human or CI).

**Rule:** A day is not “closed” without updating **daily log + test log** when code changed.

### 2.3 User-facing documentation

Start **[`docs/user/`](docs/user/)** with intent-based guides (not developer dumps):

- Getting started (account, connect channels at high level).
- Core workflows (create campaign → generate → schedule → publish).
- Troubleshooting (common errors, OAuth reconnect, rate limits at user-visible level).

### 2.4 Help / in-product support spine

Maintain **[`docs/help/`](docs/help/)** as **short topics** suitable for surfacing in-app later (FAQ-sized), cross-linked from user docs.

### 2.5 Internal “runtime architecture” document

Author **[`docs/internal/runtime-architecture.md`](docs/internal/runtime-architecture.md)** (name flexible) describing **each major internal component** when the system is **online**:

- What it is (service/worker/job/UI module).
- What it does in steady state.
- **Why** it exists (failure modes / coupling).
- Dependencies (DB, queue, third-party APIs), data flows at a **box-and-arrow** level (can reference mermaid in docs).

This is the “good documentation” counterpart to hallway conversation.

---

## 3. Testing and reliability (green thoroughly)

- **Unit/API:** `vitest` (or project standard) for `apps/api` and critical packages; **no regressions** when touching auth, OAuth, publish, billing hooks.
- **Typecheck:** `tsc -b` / workspace TypeScript build must stay **clean** after substantive edits.
- **E2E:** Playwright (Marketer flows) per existing scripts; treat **flaky tests as defects**, not noise.
- **Definition of done:** code change + tests updated + **test log entry** + **daily log bites**.

---

## 4. Roadmap document relationship (architecture vs execution)

Keep **[`docs/marketer-pro-target-architecture.md`](docs/marketer-pro-target-architecture.md)** (or your canonical name) as the **strategic** north star (services boundaries, compliance, phased capabilities).

**Separate** that from **daily execution**: roadmap phases are **not** the daily checklist—**daily log bites** are.

When roadmap rows become stale, **edit the doc** in the same PR that ships the behavior (doc-as-code).

---

## 5. What success looks like (catch-up + surpass prior build)

- Repo reads as **Marketer-Pro product workspace**, not a junk drawer.
- **Daily log + test log** prove progress without relying on memory or chat.
- **User + Help + internal runtime** docs exist and grow with each meaningful feature.
- Test suites are **green** and **repeatable**; failures are **rare, actionable, and logged**.

---

## Implementation todos (for execution after plan approval)

These are **execution placeholders**—trigger only when you explicitly leave plan mode and ask to implement.

- `scope-inventory`: Tag apps/packages/scripts as Marketer-Pro vs remove.
- `purge-non-product`: Delete/relocate non–Marketer-Pro content per rules above.
- `docs-skeleton`: Create `docs/engineering/daily/`, `docs/test-log.md`, `docs/user/`, `docs/help/`, `docs/internal/runtime-architecture.md` with templates.
- `testing-doctrine`: Document standard commands in README or `docs/engineering/README.md` (single source of truth).
- `green-baseline`: Run full matrix, record in test log, fix until green (execution phase).
