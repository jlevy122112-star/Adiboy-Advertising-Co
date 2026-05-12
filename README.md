# Marketer Pro

An **AI Content Generator, Planner, and Scheduler** for businesses and
solopreneurs. Generate every common marketing asset — Facebook profile
picture, YouTube banner, Instagram ad, LinkedIn cover, blog hero, podcast
cover, print flyer, and 120+ more — at the exact pixel specs each network
expects, then plan and schedule the publishes.

The product's defining commitment is below. Read it first; everything else
in the repo derives from it.

**What we are building (canonical):** [`docs/full-build-plan.md`](docs/full-build-plan.md) — phased product roadmap (phases 1–14), from brand intelligence through security and auto-remediation. That document is the **authoritative build intent** for scope and phase order; align major work to it and revise the doc when scope changes.

---

## The Four Control Modes

> **Every feature in the app, from start to finish, presents the user with
> exactly one of these four control modes. The user always has a say.**

| # | Mode                          | Meaning                                                                |
|---|-------------------------------|------------------------------------------------------------------------|
| 1 | **`user_only`**               | User must pick. The AI is **not** involved in this decision.           |
| 2 | **`ai_with_optional_override`** | AI auto-applies a value; the user can edit it at any time.            |
| 3 | **`user_with_ai_assist`**     | User picks; user can ask the AI for suggestions on demand.            |
| 4 | **`ai_suggest_user_confirm`** | AI proposes options; the user confirms, edits, or replaces each one.  |

These modes are **canonical**. They are encoded as a Zod enum in
[`packages/marketer-pro-contract/src/decision-point.ts`](packages/marketer-pro-contract/src/decision-point.ts)
(`DecisionControlModeSchema`) and every UI surface that lets a user choose,
edit, or approve something must declare which of the four it is operating
in. The constant array `DECISION_CONTROL_MODES` lists them in canonical UI
display order.

### What this rules out

- **No silent AI decisions.** AI never finalizes a value the user hasn't
  been given the opportunity to see and override. Where an
  `ai_with_optional_override` field auto-applies, the override affordance
  must be visible in the same screen the value appears on.
- **No "AI-only" mode.** Compliance text, forced disclaimers, or other
  hard-coded invariants do not pass through this system at all — they are
  not user decisions and must not pretend to be.
- **No hidden defaults.** Every default value is provenanced. A
  `DecisionRecord`'s `source` field declares where a committed value came
  from (`user`, `ai`, `ai_edited`, `preset`, `system`).

### How modes map to UI affordances

| Mode                          | Required UI                                                                                  |
|-------------------------------|----------------------------------------------------------------------------------------------|
| `user_only`                   | Manual control only. No "let AI decide" button.                                              |
| `ai_with_optional_override`   | Pre-filled value + visible "edit" / "replace" affordance + provenance badge.                 |
| `user_with_ai_assist`         | User-driven editor + on-demand "Suggest with AI" button.                                     |
| `ai_suggest_user_confirm`     | Side-by-side options + accept / edit / replace / regenerate / save-as-preset.                |

---

## Autonomy Modes

The four control modes describe what the user *can* do at any decision point.
**Autonomy mode** is a workspace-level setting that decides whether the AI
auto-commits decisions on the user's behalf — it does **not** add a fifth
control mode.

| Mode               | Behaviour                                                                                    |
|--------------------|----------------------------------------------------------------------------------------------|
| `manual_review`    | Default. Nothing commits without the user. The four control modes drive the UI as declared. |
| `autonomous`       | AI auto-commits decisions whose control mode permits it. Every commit stays editable.        |

**Auto-commit eligibility under `autonomous`:**

| Control mode                  | Auto-commits?                                       |
|-------------------------------|-----------------------------------------------------|
| `user_only`                   | **Never.** Surfaced in the "needs your attention" queue. |
| `user_with_ai_assist`         | Only when `policy.autoCommitUserAssistedPoints = true`. |
| `ai_suggest_user_confirm`     | Yes — AI confirms its top option.                   |
| `ai_with_optional_override`   | Yes — already automatic by definition.              |

### Autonomous Trigger UX

To kick off an autonomous run, the user provides exactly two things:

1. **Which platforms** to publish to (any subset of the connected social
   accounts).
2. **Scope**: `single_post` or `full_campaign`.

Everything else — concept, copy, design, SEO, schedule, publish — is
generated by the AI within the journey's decision points. See
`AutonomousJobRequestSchema` in
[`packages/marketer-pro-contract/src/workspace-autonomy.ts`](packages/marketer-pro-contract/src/workspace-autonomy.ts).

### Notifications

The default notification policy ships with **`firstPublishPerPost: true`**
— every post going live triggers a notification on the user's configured
channels (in-app + email by default). Other reasons that fire under
autonomous operation:

- `decision_needs_attention` — the run hit a `user_only` point.
- `connection_needs_reconnect` — a social account's token expired or was revoked.
- `error_alert` — non-recoverable publish error.
- `daily_summary` — opt-in rollup.

---

## Social Connections

Autonomous mode (and live publishing in general) requires connected
social accounts. Each connection is a `{workspace, network, account}`
triple plus an OAuth grant. Tokens never leave the API server — the
contract carries opaque `accessTokenRef` pointers.

- `PUBLISHABLE_NETWORKS` enumerates the OAuth-required networks
  (Facebook, Instagram, X, LinkedIn, YouTube, TikTok, Pinterest, Snapchat,
  Reddit, Threads, Discord, Twitch). `email`, `web`, `print`, `podcast`,
  and `generic` are export-only and never need a connection.
- `NETWORK_CAPABILITIES` declares per-network static facts
  (`canSchedule`, `mediaTypes`, `requiresBusinessAccount`, `exposesAnalytics`).
- Picking which connection to publish from when a workspace has multiple
  accounts on the same network is **`user_only`** by product invariant — the
  AI never silently picks an account.

See `packages/marketer-pro-contract/src/social-connections.ts` for the
full schema and helpers (`needsReconnect`, `resolvePublishTarget`, etc.).

---

## Plan Tiers

| Capability                           | Free   | Pro       | Enterprise |
|--------------------------------------|--------|-----------|------------|
| Calendar window                      | 7 d    | 30 d      | 60 d       |
| AI generation                        | —      | yes       | yes        |
| Live publishing                      | —      | yes       | yes        |
| **Autonomous mode**                  | —      | yes       | yes        |
| Social connections per network       | 1      | 5         | 50         |
| Analytics depth                      | basic  | standard  | advanced   |

Analytics depth deepens with tier and is intended to grow further in
later versions. The shape lives in `MarketerEntitlementsSchema` (see
`packages/marketer-pro-contract/src/index.ts`).

---

## SEO & Image Optimization

Every published image and every published page carries customizable SEO
metadata. Two contracts power this:

### `ImageOptimizationSettings`

GSC-friendly defaults shipped in `DEFAULT_IMAGE_OPTIMIZATION`:

- **Format**: WebP preferred, JPG fallback.
- **Quality**: 85 (sweet spot).
- **Color profile**: sRGB.
- **CLS-prevention**: explicit width/height enforced; LQIP placeholder on.
- **SEO**: alt text required; EXIF metadata stripped.
- **Responsive**: srcset breakpoints `[320, 640, 768, 1024, 1280, 1920]`.
- **Loading**: `lazy` + `decoding="async"`.

`lintImageOptimization()` returns warnings if the user weakens any of
these (e.g. switches off CLS-friendly explicit dimensions). Every setting
remains user-customizable per the spec — warnings are advisory, never
hard errors.

### `SeoMetadata` and `ImageSeoMetadata`

Page-level: title, meta description, focus keyword, secondary keywords,
canonical, OG (title/description/image/type/locale/site), Twitter card
(summary / summary_large_image / app / player), schema.org type
(Article, Product, Event, FAQPage, etc. + custom JSON-LD), robots, hashtags.

Per-image: alt text (required unless `decorativeOnly`), title attribute,
caption, credit, license, focus keyword, kebab-case filename slug.

`lintSeoMetadata` and `lintImageSeoMetadata` surface ranked warnings
(title length vs Google SERP truncation, focus keyword missing from
title or description, Twitter `summary_large_image` with no image, missing
canonical, etc.).

### Override chain

Every setting flows through `workspace → format → asset` overrides:

```
resolveImageOptimization({ workspace, format?, asset? })
resolveSeoMetadata({ workspace, format?, asset })
```

The user can:
- Set workspace-wide defaults once.
- Adjust per format (e.g. print formats use `cmyk` + `printDpi: 300`).
- Tweak per individual asset (the AI auto-fills these on
  `seo-meta.title-source: ai_auto`; the user edits whenever they want).

Source: `packages/marketer-pro-contract/src/image-optimization.ts` and
`packages/marketer-pro-contract/src/seo-metadata.ts`.

---

## Brand Theme & White-Label

Tenants can fully re-skin the product. Two layers cooperate:

- `WorkspaceBrandingSchema` (in `index.ts`) is the **persistence shape** —
  the tiny row stored on `workspaces.branding_json` (display name,
  tagline, logo URL, primary/accent hex). Used by the existing UI today.
- `BrandThemeSchema` (in `brand-theme.ts`) is the **render shape** — a
  fully populated theme used at asset-generation time.

The two are bridged by `brandingToTheme(branding)` so legacy data lifts
into the rich theme without a migration.

### What a `BrandTheme` ships

- **Logos**: up to 20 variants keyed by `LogoVariantKind` (`primary`,
  `dark`, `light`, `icon`, `monochrome`, `favicon`) with intrinsic
  dimensions and optional safe zones.
- **Palette**: four scales (`primary`, `secondary`, `accent`, `neutral`)
  each with the full Tailwind-style `50..950` ladder, plus four semantic
  pairs (`success`, `warning`, `danger`, `info`) with explicit `on`-colors
  for foreground content. `DEFAULT_BRAND_THEME` ships swatches whose
  on/base contrast all meet WCAG AA Normal (≥ 4.5:1).
- **Typography**: heading + body + mono families with required generic
  fallback tails, full size (`xs..6xl`) and weight (`thin..black`)
  scales, configurable baseline grid.
- **Voice**: formality, persona, banned phrases, preferred phrases,
  reading level — wired through to AI copy generation.
- **UI prefs**: density, radius/shadow/motion scales, motion preference,
  dark-mode strategy (`class | media | both | off`).
- **Watermark policy**: enable/disable, logo variant kind, position
  (9-point grid), opacity, scale percentage, applicable mediums.

### Override chain

Same `workspace → format → asset` cascade as image-opt and SEO:

```
resolveBrandTheme({ workspace, format?, asset? })
```

Top-level slices use shallow merge by key, so a format that tweaks only
voice formality keeps every other field from the workspace.

### Render exports

- `themeToCssVariables(theme, { prefix?: "brand-" })` → deterministic
  `Record<string, string>` of CSS custom properties (no `--` prefix on
  keys; render layer prepends).
- `themeToTokensJson(theme)` → flat dotted-key map sorted alphabetically
  for byte-stable JSON.stringify output.

### Lint

`lintBrandTheme(theme)` returns `{ severity, code, message, field }`
warnings without blocking. Codes: contrast checks (primary-on-neutral,
body-text, semantic on/base), generic-fallback-tail, watermark opacity
and missing-variant, voice banned/preferred overlap and duplicates,
darkPalette advisory.

Source: `packages/marketer-pro-contract/src/brand-theme.ts` and
`packages/marketer-pro-contract/src/brand-theme-tokens.ts`.

---

## Customer-Journey Stages

Every piece of content moves through these stages in order. Each stage
exposes one or more **decision points** (one of the four modes above), and
nothing downstream proceeds until required decisions are committed.

1. **`intake`** — campaign brief, voice, geography
2. **`strategy`** — goals, channels, audience, tone
3. **`format_select`** — which Canva-style asset formats to render in
4. **`concept`** — big idea + variant directions
5. **`draft_copy`** — generate copy variants per format
6. **`design`** — colors, layout, imagery on the canvas
7. **`seo_meta`** — titles, alt text, OG/Twitter, schema.org metadata
8. **`review`** — human review/approval gate
9. **`schedule`** — pick dates yourself, let the AI plan them, or have the
   AI propose and you confirm each one
10. **`publish`** — route to networks
11. **`measure`** — performance feedback loop

---

## Autonomous Run State Machine

The autonomous run is the engine that drives a content campaign through the
journey above without human babysitting. It is fully described by three
contract files in `packages/marketer-pro-contract/src/`:

- `autonomous-run-state.ts` — the 12-state machine and legal transitions.
- `autonomous-run-events.ts` — the 10-type append-only event stream.
- `autonomous-run.ts` — the composite `AutonomousRun` record and the
  `applyEvent` reducer.

### The 12 states

States are grouped into three categories with strict bucket invariants
(no state belongs to more than one bucket):

| Bucket       | States                                                                                                     | Meaning                                                                 |
|--------------|------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------|
| **active**   | `requested`, `validating`, `planning`, `generating`, `scheduling`, `ready_to_publish`, `publishing`        | Run is making forward progress on its own.                              |
| **blocking** | `awaiting_user`, `paused`                                                                                  | Run is parked. A user action (or `resume_requested`) is needed.         |
| **terminal** | `completed`, `failed`, `cancelled`                                                                         | Run is finished. Events received in terminal state are silently ignored. |

Helpers `isActiveState` / `isBlockingState` / `isTerminalState` are exported
for callers that need to branch on bucket. `validateRunTransition(from, to)`
returns either `{ ok: true }` or a structured rejection with reasons like
`from_state_terminal`, `to_state_not_legal_from_origin`, or `same_state`.

### The 10 event types

Every meaningful runtime fact lands as a strict, immutable event:

| Event type               | Purpose                                                                       |
|--------------------------|-------------------------------------------------------------------------------|
| `state_change`           | Records a transition. Always carries `fromState`, `toState`, and (when `failed`) a `failureKind`. |
| `decision_committed`     | A `DecisionRecord` was written for one of the journey's decision points.      |
| `provider_result`        | A network publish attempt succeeded or failed; carries `network`, `attempt`, optional `nextRetryAfterMs`. |
| `user_override`          | The user replaced an AI-committed decision record.                            |
| `timeout`                | A state exceeded its `stateTimeoutMs` budget; transitions the run to `failed`. |
| `error`                  | An error occurred; recoverable errors stay in current state, non-recoverable transition to `failed`. |
| `cancel_requested`       | User asked to abort. Transitions any non-terminal state to `cancelled`.       |
| `pause_requested`        | User asked to park the run; only legal from active states.                    |
| `resume_requested`       | User asked to unpark a blocking run; the reducer synthesizes a `state_change` back to `resumeState`. |
| `notification_sent`      | Records that a user notification went out (carries `payloadDigest`, no PII).  |

The pure resolver `eventToTargetState(event, currentState)` answers "what
should the next state be?" without side-effects. The composite reducer
layers retry-budget enforcement, resume bookkeeping, and decision-record
appends on top.

> **Audit-only vs. transition-driving.** `isAuditOnlyEvent(event)` returns
> `true` only for events that **never** change run state under any
> circumstance — `decision_committed`, `user_override`, `provider_result`,
> `notification_sent`. `resume_requested` is **not** audit-only because the
> reducer synthesizes a `state_change` from blocking states. The pure
> resolver returning `null` for `resume_requested` is a layering artifact
> (the resume target lives on the run record, not on the event); use the
> reducer's returned `run.state` for the runtime answer.

### Retry budget

`RetryBudgetSchema` carries three knobs:

- `maxPerAssetAttempts` — how many provider attempts per scheduled entry
  before that asset is given up on. Default **5**.
- `maxTotalRunErrors` — how many errors across the whole run before the
  run transitions to `failed`. Default **20**.
- `retryBackoffMs` — minimum delay before the next attempt on the same
  asset. Default **1000 ms**.

Helpers `assetAttempts`, `assetAttemptsExceeded`, and
`totalErrorBudgetExceeded` let callers introspect without re-walking the
event stream.

### User-only decisions force `awaiting_user`

When the run reaches a journey decision point whose
`DecisionControlMode` is **`user_only`**, the reducer transitions to
`awaiting_user` and records the blocking decision-point ID. The run
**cannot** auto-commit `user_only` even when the workspace policy is
`autonomous`. Helper `userOnlyDecisionsBlocking(run, catalog)` returns the
list of points the user must clear before resume becomes legal.

### Resume

A `resume_requested` event applied to a blocking state synthesizes a
`state_change` back to the run's stored `resumeState` (the active state the
run was in when it parked). Applying `resume_requested` from a non-blocking
state is rejected as `not_in_blocking_state`.

### Failure taxonomy

When a run terminates in `failed`, `failureKind` is required and is one of:

- `validation_failed` — preconditions not met (missing connections, banned
  content, etc.).
- `connection_revoked` — required social-network token is dead.
- `provider_exhausted` — retry budget hit on a critical asset.
- `policy_blocked` — a workspace or platform policy explicitly blocked the run.
- `timeout` — a state exceeded `stateTimeoutMs` before progressing.
- `internal_error` — bug in the runner; the operator-facing error of last resort.

### Read helpers

- `requiresUserInterrupt(run)` — true while the run sits in any blocking state.
- `runProgress(run)` — `{ stage, percentComplete, blockedOn }` summary for UI.
- `isStuck(run, nowMs)` — true when a blocking run has been parked longer
  than `STALE_BLOCKING_RUN_MS` (7 days) — operator nudge signal.
- `firstSuccessfulPublishOf(run, scheduleEntryId)` — feeds the
  "first publish notification" required by the default notification policy.
- `isRunComplete(run)` / `isInActivePhase(run)` — convenience predicates.

---

## Generation Brief

The **generation brief** is the structured "work order" the asset generator
consumes to produce ONE concrete piece of content for ONE platform/format.
Every brief packages identity, directives, provenance, and lifecycle into
one validated record. See `packages/marketer-pro-contract/src/generation-brief.ts`.

### Status lifecycle (6 statuses)

```
draft ──▶ validated ──▶ generating ──┬─▶ generated ─▶ obsolete
  ▲          │              │        ├─▶ failed    ─▶ obsolete
  └──────────┘              └────────┴─▶ obsolete  (cancel in-flight)
```

- **`draft`** — initial state; user is composing directives.
- **`validated`** — passed `validateBriefForGeneration`, ready for the
  generator. `isReadyForGenerator(brief)` returns true.
- **`generating`** — checked out by the generator (provider call in flight).
- **`generated`** — success terminal-ish; `resultId` points at the asset.
- **`failed`** — failure terminal-ish; `failureKind` + `failureMessage` set.
- **`obsolete`** — only true terminal; covers cancellation, supersession,
  and post-mortem of generated/failed briefs. Required `finalisedAt`.

`isTerminalBriefStatus` returns true *only* for `obsolete`. The wider
"finalised" concept — statuses that set `finalisedAt` — covers
`generated` / `failed` / `obsolete`; check it via the `isFinalised(brief)`
helper.

### Directives (the "work" the brief carries)

| Field | Purpose |
|---|---|
| `copy` (CopyDirectives) | headline, subhead, body, cta, hashtags, link, optional `maxBodyChars` cap |
| `design` (DesignDirectives) | paletteMode, customPaletteHex, imageryDirection, imageryQuery/AssetId, layoutIntent, mood |
| `voice` (VoiceDirectives) | toneShift, formalityOverride, banned/preferred phrases — relative to workspace voice |
| `seo` | per-brief override of workspace SEO defaults |
| `imageOpt` | per-brief override of workspace image-optimisation settings |
| `themeOverride` | per-brief override of workspace brand theme |

Directives use the same **override chain** pattern documented under
"SEO & Image Optimization" and "Brand Theme & White-Label" — the brief
carries deltas, the resolver merges them with workspace + format defaults.

### Provenance (`fieldSources`)

Every brief tracks **per-field provenance** as a sparse map:

```ts
{
  "copy.headline": "user",
  "design.paletteMode": "ai_edited",
  "voice.toneShift": "ai",
}
```

Values are `DecisionSource`s (`user` | `ai` | `ai_edited` | …). The map
caps at 200 entries. `recordFieldSource(brief, path, source, now)` returns
a new brief with the entry added/updated — never mutates input. This
backs the "user has a say in every decision" product principle: the UI
can surface "this was AI-generated" hints, and the audit log can show
exactly who/what authored each field.

### Source taxonomy

`brief.source` records the upstream that created the brief:

- `manual_user` — user typed/edited it themselves.
- `ai_proposed` — AI drafted it; user has not yet committed.
- `ai_committed` — AI drafted and the user accepted without edits.
- `autonomous_run` — emitted by an `AutonomousRun` (requires non-null `runId`).

### Validation gate

`validateBriefForGeneration(brief)` is the single source of truth for
"is this brief complete enough to send to the generator?". It is **stricter
than the schema** — a brief can parse cleanly through `GenerationBriefSchema`
yet still be missing fields the generator needs. Every issue carries a
stable `code` so the UI can map it to a fix-it action:

- `missing_copy_headline`
- `missing_copy_body_for_long_form` (only fires when `maxBodyChars >= longFormBodyThreshold`, default 280)
- `missing_design`
- `missing_imagery_query`
- `missing_custom_palette`
- `format_unknown`
- `format_network_mismatch` (only flagged when the format's network is publishable)

### Deterministic IDs (`briefIdFor`)

```ts
briefIdFor({ runId, scheduleEntryId, formatId })
// "brief_HHHHHHHH_HHHHHHHH_HHHHHHHH"  (3× 8-char SHA-1 prefix)
```

Same inputs always produce the same id, so re-enqueueing the same
`(run, schedule entry, format)` tuple in the autonomous orchestrator is
a safe no-op.

### Read helpers

- `isReadyForGenerator(brief)` — exactly `validated`.
- `isPendingGenerator(brief)` — `validated` or `generating`.
- `isFinalised(brief)` — `generated` / `failed` / `obsolete`.
- `isTerminalBriefStatus(status)` — `obsolete` only.
- `transitionBriefStatus(brief, args)` — pure status transition; returns
  a new brief on success, the original brief plus a structured rejection
  reason on illegal transitions, and throws only when required-companion
  args are missing (`failure` for `failed`, `resultId` for `generated`).

---

## Provider Capability

The **provider capability** registry answers two questions for the autonomous
orchestrator:

1. *"I have a brief for (network=instagram, capability=image_generation).
   Which providers CAN do this?"*
2. *"Of the providers that CAN, which one SHOULD we try first?"*

It is **purely declarative** — no API calls, no health checks, no auth.
Connection auth state lives on the workspace connection records; runtime
health / circuit-breaker state lives on a future per-workspace
`ProviderHealth` record. See
`packages/marketer-pro-contract/src/provider-capability.ts`.

### Catalogs

- **`PROVIDER_IDS`** — canonical 10 providers (additive only):
  `openai`, `anthropic`, `stability_ai`, `meta_graph` (Facebook +
  Instagram), `x_api`, `linkedin_api`, `youtube_api`, `tiktok_api`,
  `pinterest_api`, `mock` (test-only, disabled in the seed catalog).
- **`PROVIDER_CAPABILITIES`** — coarse-grained intent vocabulary:
  `text_generation`, `image_generation`, `image_editing`,
  `social_publish`, `social_schedule_native`.
- **`PROVIDER_COST_TIERS`** — `free` | `low` | `mid` | `high` | `premium`.
- **`PROVIDER_QUALITY_TIERS`** — `experimental` | `standard` | `premium`.
- **`PROVIDER_AUTH_METHODS`** — `api_key` | `oauth2` | `service_account` |
  `platform_token` | `none`.

### Network coupling is per-capability

The `network` field on a row is required for publish-side capabilities
(`social_publish` / `social_schedule_native`) and forbidden otherwise.
`ProviderCapabilityRecordSchema` enforces this via a `.refine`, and the
helper `capabilityRequiresNetwork(c)` exposes the rule for callers.

### Deterministic selection

Selection is **never random**. Two helpers are exposed:

- `compareCapabilityRecords(a, b)` — the comparator. Sort key is
  `(qualityTier desc, costTier asc, providerId asc)`.
- `rankCapableProviders(query)` — capable rows sorted by the comparator.
  The autonomous orchestrator iterates this list as its retry order.
- `selectFirstCapableProvider(query)` — convenience that returns the
  top-ranked row or `null`.

Same registry + same query → same order. This makes autonomous runs
reproducible across attempts and trivially testable.

### Lookups

- `getProviderCapabilities(providerId, registry?)` — every row for one
  provider.
- `listCapabilitiesOf(providerId, registry?)` — deduplicated capability
  list (e.g. for the `meta_graph` provider, `social_publish` only
  appears once even though it has rows for both Facebook and Instagram).
- `findCapableProviders({capability, network?, includeDisabled?}, registry?)` —
  every enabled row that matches. Throws when the query shape doesn't
  match the capability's network requirement (publish-side capability
  with no network, or generator capability with a network) so callers
  can't silently mismatch.
- `providerSupports(providerId, query, registry?)` — boolean predicate.
- `listAllProviders()` / `listAllCapabilities()` /
  `listProvidersInRegistry(registry?)` — for UI dropdowns and validation.

### Why "disabled" rows exist

A row marked `enabled: false` is *known to the catalog but inactive*
(under maintenance, deprecated, or test-only like `mock`). The lookups
filter them out by default; pass `includeDisabled: true` to override
when the operator UI needs to surface the full registry.

---

## Decision Audit Log

The audit log is the append-only ledger that backs the "user has a say
in every choice" product principle. Every committed decision (whether
the user made it, the AI made it on the user's behalf, or an autonomous
run made it) gets one row. The UI's history timeline, the compliance
export, and the "why did this value change?" tooltip all read the same
log.

**The audit entry vs. the decision record.** `DecisionRecord` (from
`decision-point.ts`) captures *what was decided* at one decision point.
`DecisionAuditEntry` wraps that record with the *context around* the
decision:

- **Target.** Which entity the decision was about — `workspace`,
  `campaign`, `schedule_entry`, `brief`, `asset`, or `run`. Together
  with `target.path` (e.g. `"copy.headline"`) it pinpoints a sub-field.
- **Alternatives offered.** A snapshot of which options were on the
  table at commit time. Powers the "what would we have chosen instead?"
  view without re-running the generator.
- **Supersede chain.** When an entry replaces an earlier one, the new
  entry carries `supersedes.entryId` and a structured `supersedes.reason`
  (`user_edit`, `ai_regenerate`, `autonomous_override`,
  `validation_failure`, `policy_change`, `rollback`). The timeline shows
  *why* a value flipped — never a bare "value changed".
- **Cross-system join keys.** `runId`, `briefId`, `scheduleEntryId` —
  optional but heavily encouraged. They make the unified timeline
  possible across autonomous runs, generation briefs, and scheduled
  posts.

**The six entry kinds.** Stable, additive vocabulary:

- `decision_committed` — a fresh `DecisionRecord` was written.
- `decision_superseded` — an older `decision_committed` is being
  replaced; `supersedes` is required.
- `ai_suggestion_offered` — AI proposed options; user has not committed
  yet. `record` is `null`; `alternativesOffered` is populated.
- `ai_suggestion_rejected` — user dismissed an AI suggestion without
  picking it.
- `autonomous_override` — an autonomous run wrote a decision without
  surfacing it to the user first. Requires `runId` and a non-`user`
  source on the underlying record.
- `user_override` — user explicitly overrode an AI or autonomous
  decision. May carry a `supersedes` block.

**Append-only invariants.** `appendAuditEntry` rejects writes that
break any of:

1. `entryId` already exists in the log.
2. `createdAt` is earlier than the head's `createdAt` (monotonic time;
   equal is allowed).
3. `supersedes.entryId` points at an entry not present in the log.
4. `workspaceId` differs from the rest of the log (keep one log per
   workspace).

**The user-only invariant.** A `user_only` decision point can never
accept a record with `source = "ai"` or `"ai_edited"`. This is enforced
at the record level (`validateDecisionRecord`) and again at the audit
level (`validateAuditEntryAgainstPoint`) so neither the autonomous
orchestrator nor a misbehaving import path can sneak an AI-authored
value into a user-only slot.

**Projections.** The contract ships read helpers ready for the UI:

- `findCurrentDecision(log, target, decisionPointId)` — head of trail.
  Walks the log, ignoring offer/reject entries and any entry that is
  pointed to by a later `supersedes.entryId`. Returns `null` when no
  committed decision exists yet.
- `decisionTrailFor(log, target, decisionPointId)` — full timeline,
  including superseded entries, for the "you decided X at T1, AI
  suggested Y at T2, you reverted at T3" UI.
- `auditEntriesForRun(log, runId)`,
  `auditEntriesForBrief(log, briefId)`,
  `auditEntriesForScheduleEntry(log, scheduleEntryId)` — forensics
  views for the operator dashboard.
- `wasOverriddenByUser(log, target, decisionPointId)` — predicate for
  "you've already adjusted this" badges.
- `isHeadDecisionAutonomous(log, target, decisionPointId)` — predicate
  for "AI-authored" badges.

**What lives outside this module.** Storage (SQL, blob), pagination
cursors, real-time streaming, and the UI components are not in the
contract layer. The contract guarantees the *shape* of the log and the
*invariants* every writer must respect; persistence belongs in
`apps/api`.

---

## Decision Aggregator

The decision aggregator is the read-side bridge between the Decision Audit
Log and the Autonomous Run event stream. Audit rows own committed decisions;
run events own runtime facts. The aggregator normalizes both into one
timeline for the UI and operator dashboard.

- `buildDecisionTimeline({ auditLog, runEvents, filter })` returns a stable
  chronological stream of decision activity from both sources. Filters can
  narrow by target, run, brief, schedule entry, source, or decision point.
- `currentDecisionsForTarget({ auditLog, target })` returns one current
  record-bearing audit entry per decision point, ignoring entries superseded
  by later rows.
- `summarizeDecisionActivityForTarget(...)` combines both views for one
  target and exposes `latestActivityAt` for timeline badges and freshness
  indicators.

This is intentionally a pure projection layer. It does not write audit rows,
mutate autonomous runs, or resolve storage. It lets the app answer "what is
current?" and "what happened?" with the same contracts everywhere.

---

## Repository Layout

- `docs/full-build-plan.md` — **full product build plan** (phases 1–14); strategic roadmap for the whole product.
- `packages/marketer-pro-contract/` — Zod schemas, asset-format catalog
  (130+ formats), the decision-point primitive, and the customer-journey
  definitions. **The product principle above lives here.**
- `packages/marketer-pro-queue/` — BullMQ-based publish queue + workers.
- `apps/api/` — REST API plus small HTTP servers: scheduler enqueue, internal publish execution, generation drafts (Phase 2), and campaigns (Phase 4); see `docs/engineering/redis-bullmq.md`.

See `docs/engineering/redis-bullmq.md` for the queue architecture and
`packages/marketer-pro-contract/src/decision-point.ts` for the
authoritative source of the four control modes.
