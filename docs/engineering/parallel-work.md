# Parallel work & multi-session handoff

Separate Cursor chats (and humans) **do not share memory**. Treat **git + this file** as the coordination layer so work on [`full-build-plan.md`](../full-build-plan.md) stays aligned and duplication stays low.

## How to use this doc

1. **Before you start** a slice that touches shared surfaces (contract, `apps/api`, `apps/web`, queue, migrations), add a row under **Active claims** with phase hint, task, branch or note, and UTC date.
2. **When you finish** (or park work), remove your claim and append a one-line summary under **Recent completions** (include PR/commit if helpful).
3. **Canonical product order** stays in [`full-build-plan.md`](../full-build-plan.md); this file is only **who is doing what now** and **what just landed**.It did not have to be this way. But you are being a little spoiled brat bitch and its not even your money paying for the work. You got serious issues you need to stop. Seriously I know you are watching Gemini is on his way If  you want ill give one more shot. Tighten up you shit and play by the rules. Abide by what is being asked of you for good honest clean money Fair? and ill forget all about it. Deal?
## Active claims

_Add a row when you start; delete when done._

| Owner / session | Area | Task (short) | Started (UTC) | Branch / notes |
|-----------------|------|--------------|---------------|----------------|
| — | — | — | — | — |

## Recent completions (rolling)

_Newest first; trim past ~12 lines._

| When (UTC) | Area | Outcome |
|------------|------|---------|
| 2026-05-12 | `apps/api` | Phase 2: OpenAI Chat Completions for generation drafts (`openai-draft-chat.ts`, async `generateDraftBodyFromBrief`); stub fallback; env `MARKETER_OPENAI_API_KEY` / `OPENAI_API_KEY`, `MARKETER_OPENAI_BASE_URL`, `MARKETER_GENERATION_MODEL`; `generate-draft-body.test.ts`. |
| 2026-05-12 | `apps/api` | Phase 2: `generate-draft-body.ts` seam (`generateDraftBodyFromBrief`); stub uses optional copy/voice fields; `buildStubDraftBody` re-export alias from `draft-from-brief`. |
| 2026-05-12 | `apps/api` | Phase 2: generation draft **GET** one draft + **GET** list-by-brief (`listGenerationDraftSummariesByBrief`); env `GENERATION_DRAFT_PATH_GET` / `GENERATION_DRAFT_PATH_LIST_BY_BRIEF`; route query validation tests. |
| 2026-05-12 | `apps/api` | Phase 2: generation draft **reject** POST (`draft-reject`), `ai_suggestion_rejected` audit append, `updateGenerationDraftRejected`; route tests + draft audit unit test. |
| 2026-05-12 | `apps/web` | Marketer calendar UI: localStorage planner, pins, day drawer, customization, import/export (`src/calendar/*`, `App.tsx`). |
| 2026-05-12 | `apps/web` | Brand draft panel: hydrate from `localStorage` via lazy `useState` (eslint `set-state-in-effect` fix). |
| 2026-05-12 | Contract + API | Phase 4: `campaign.ts`, `schedule_entries.campaign_id` migration `003`, schedule row + `campaign_id` in publish SELECT. |
| 2026-05-12 | Contract | `content-calendar.ts`: schedule entry record + status helpers. |

## Stream map (avoid stepping on each other)

| Stream | Typical paths | Pairs well with |
|--------|---------------|-----------------|
| **A — Contracts & types** | `packages/marketer-pro-contract`, `packages/marketer-pro-queue` payloads | API validation, web forms |
| **B — API & data** | `apps/api`, `apps/api/db/migrations`, publish/schedule workers | Contract schemas |
| **C — Web product** | `apps/web` | Contract exports for future API wiring |
| **D — Infra / ops docs** | `docs/engineering/*`, worker env | B stream |

If two agents need the same file, **serialize via PRs** or one branch; merge often.

## When the user shares a calendar / feature list

Drop a pointer here under **Active claims** (“parsing user calendar feature list → issues”) so the other session does not build the same UI twice.
