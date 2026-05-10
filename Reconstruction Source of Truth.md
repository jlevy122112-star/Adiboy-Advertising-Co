Reconstruction Source of Truth
This document is the canonical status record for rebuilding the Home-Link SaaS
in the `Home-Link-Realty-Group/Wholesaler-Pro` repository. If a claim is not
reflected in this repository, treat it as unverified until validated here.
Repository Validation Snapshot
Snapshot date: 2026-05-06
Branch: `b01-bootstrap-upgrades`
Working tree: active reconstruction; workspace quality tooling (Vitest, TS
ESLint, Husky / lint-staged) merged with upstream B03/B04 intake
Source of truth scope: this repository only
Validated Artifacts (Present in This Repo)
Governance and Operating System
`README.md`
`CONTRIBUTING.md`
`AGENTS.md`
`docs/engineering-constitution.md`
`docs/profitability-framework.md`
`docs/checkpoints-and-procedures.md`
`docs/architecture-diagrams.md`
`docs/master-multi-agent-prompt.md`
`docs/bug-register.md`
Workflow Intake and Transformation
`workflows/` contains 766 files:
362 `.docx`
362 `.md`
42 `.py`
`workflows-cleaned/` contains 404 files:
362 `.md`
20 `.jsx`
8 `.txt`
8 `.js`
6 `.json`
Conversion/cleanup utilities:
`convert-workflows.cjs`
`clean-workflows.cjs`
`clean-workflows-py.cjs`
NPM scripts:
`npm run workflows:convert`
`npm run workflows:clean`
`npm run workflows:clean:py`
Progress Operations
Daily progress automation exists:
`.github/workflows/daily-progress-snapshot.yml`
`scripts/daily-progress-snapshot.mjs`
`npm run progress:snapshot`
Quality and test tooling (workspace)
`npm run bootstrap:check`: workspace layout, TypeScript build, ESLint
(including TypeScript sources), Vitest suite, Prettier
Husky pre-commit: lint-staged (eslint/prettier on staged files), typecheck when
relevant, Vitest scoped to touched `apps/*` / `packages/*` (full suite when
shared config changes). PR CI remains the merge gate.
Re-Validation of Prior Agent Claims
Confirmed Claims
The project is currently a planning/specification repository, not an
application codebase.
The document-processing pipeline (DOCX -> Markdown cleanup) exists.
Daily GitHub progress snapshot automation exists.
Unverified/Not Present in This Repo
Active application implementation (frontend/backend) is not present.
Referenced app files from prior chats (for example `ResourcesPage.jsx` under a
`src/` app tree) are not present in this repository.
Infrastructure implementation files (for example Terraform modules and active
app deployment config) are not present.
Build Status by Domain
Complete
Governance constitution and process docs
Workflow conversion and cleaning toolchain
Daily progress snapshot automation
Partial
Functional spec extraction from source artifacts (large corpus exists, but not
yet normalized into one implementation backlog)
Repository scaffold now includes bootstrap modules and shared workspace
tooling from `B01`
Multi-tenant foundation contracts and planning scaffolds completed under `B02`
`B03` auth/access foundation: CP4 implementation ready-for-signoff with
runtime guards, audit baseline, API and contracts tests; see backlog and
`docs/work-items/B03-auth-access-foundation.md`
Not Started
Product feature code (auth, billing, telephony, lead workflows)
Production data model migrations
Deployment-ready infrastructure modules
Backlog Execution Status
`B01` Monorepo bootstrap: CP4 baseline complete and validated with
`npm run bootstrap:check`
`B02` Multi-tenant domain/data contract: CP4 complete and validated with
`npm run bootstrap:check` fully green
`B03` Auth and access foundation: CP4 implementation complete and
ready-for-signoff with foundation runtime
guards, audit baseline, sink adapter contract, and authorization tests
including structured transport, middleware tenant-boundary guard, and
session-envelope adapter with request metadata correlation; now extended with
upstream identity-provider adapter contract and conformance checklist
evidence; CP4 sign-off package prepared and validated via `npm run b03:check`
`B04` Billing and subscription skeleton: CP1-CP3 intake package hardened and
marked `intake_ready_for_signoff` at
`docs/work-items/B04-billing-subscription-skeleton.md`; reviewer decision
pending before CP4
`B05+`: pending B04 readiness and dependency sequence
Current Blockers
No auth/session runtime middleware yet for request edge enforcement.
B03 privileged-action audit sink is currently in-memory only (no external
transport binding yet).
Audit metadata correlation currently depends on caller-provided request
metadata (no edge middleware collector integrated yet).
GitHub CLI auth is not configured locally for direct issue/PR queries.
Assumptions
All future reconstruction decisions and implementation will happen in this
repository only.
Prior off-repo or prior-chat claims must be re-checked against repository
files before being accepted.
Decision Log
2026-05-04: Adopted single-workspace reconstruction policy.
2026-05-04: Adopted strict re-validation policy for prior agent outputs.
2026-05-04: Deleted 3 empty DOCX placeholders so source and cleaned counts now
match (`362` to `362`).
2026-05-04: Confirmed B01 bootstrap baseline and advanced B02 into bounded CP4
foundation artifacts (contracts/scaffolds, no migrations).
2026-05-04: Resolved formatting drift and restored full green
`npm run bootstrap:check`.
2026-05-04: Closed B02 as complete and opened B03 CP1-CP3 intake artifacts
without starting implementation.
2026-05-04: Advanced B03 CP4 with audit baseline and deny-path tests; validated
with `npm run b03:check`.
2026-05-04: Added B03 audit sink adapter contract and high-risk positive-path
authorization tests; `npm run b03:check` remains green.
2026-05-04: Added API structured audit transport boundary and middleware-entry
tenant-boundary guard with negative tests; `npm run b03:check` remains green.
2026-05-04: Added session-envelope adapter and unauthenticated middleware-entry
deny-path tests; `npm run b03:check` remains green.
2026-05-04: Added request metadata correlation fields to security audit logs
and deny-path tests for missing tenant and invalid role claims; `npm run b03:check` remains green.
2026-05-04: Added upstream identity-provider adapter contract for mapping
token/session inputs to external claims shape, expanded adapter mapping tests,
and created B03 privileged-action audit conformance checklist artifact;
`npm run b03:check` remains green.
2026-05-04: Re-reviewed outgoing B03 commit before push and prepared CP4
sign-off package updates (handoff evidence, rollback trigger, reviewer status);
`npm run b03:check` remains green.
2026-05-05: Established `docs/bug-register.md` as the strict reconstruction bug
reference with required fields, lifecycle states, and B03 starter entries.
2026-05-05: Normalized checks baseline (`checks:quick` and `checks:ci`)
to green after script formatting alignment.
2026-05-05: Updated B03 sign-off artifacts to ready-for-signoff state with
explicit go/no-go prerequisites and role-based reviewer placeholders.
2026-05-05: Drafted B04 CP1-CP3 intake package for billing/subscription
skeleton; sign-off remains pending.
2026-05-05: Hardened B04 CP1-CP3 package with explicit profitability
stop-loss criteria, tenant-isolation and webhook/idempotency boundary
requirements, and reviewer decision checklist; status updated to
`intake_ready_for_signoff`.
2026-05-06: Landed Vitest, TypeScript ESLint, Husky, and lint-staged;
`bootstrap:check` includes `npm test`; pre-commit runs lint-staged, typecheck
when applicable, and scoped Vitest for touched packages; docs reconciled after
rebase onto latest `b01-bootstrap-upgrades`.