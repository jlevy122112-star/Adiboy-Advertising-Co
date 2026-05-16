# Marketer Pro — full build plan (phases 1–14)

## Author: Jacob N. Levy  

## Captured: 2026-05-11  

This document is the **repo-wide phased roadmap** for the product. It complements the north-star architecture in [`marketer-pro-target-architecture.md`](./marketer-pro-target-architecture.md) and the contract-first details in the root [`README.md`](../README.md).

**Authoritative build intent.** Treat this file as the **canonical statement of what Marketer Pro is meant to become**: scope, order of major capabilities, and the checkpoints that count as “done” for each phase. Other docs explain *how* (architecture, contracts, ops); **this doc is what we agreed to build**, phase by phase. When implementation choices conflict with the plan, update the plan explicitly rather than drifting.

---

## Phase 1: Brand intelligence core

## Goal: Make the app understand a brand before generating anything

## Build ##

- Brand voice profile  
- Audience / persona profile  
- Product / service facts  
- Forbidden claims / compliance rules  
- Tone, style, vocabulary, visual identity  
- Brand memory backed by vector retrieval  

## Output ##

- `BrandProfile` — same as `BrandIntelligenceProfile` in `@home-link/marketer-pro-contract` (`brand-intelligence.ts` / `BrandProfileSchema`).
- `AudienceProfile`
- `BrandKnowledgeSource`
- `BrandVoiceGuidelines` — same as `BrandVoice` on the profile (`BrandVoiceGuidelinesSchema`).
- `BrandComplianceRules` + `BrandProductFact` — forbidden claims / disclaimers / regulated tags and structured product facts (same module).
- Vector-backed retrieval for generation context

## Repo checkpoint (Phase 1 — keep current)**

- Contract: [`packages/marketer-pro-contract/src/brand-intelligence.ts`](../packages/marketer-pro-contract/src/brand-intelligence.ts) (`BrandProfile` / `BrandIntelligenceProfile`, audiences, knowledge sources, compliance, product facts, generation context + prompt formatting); [`brand-retrieval.ts`](../packages/marketer-pro-contract/src/brand-retrieval.ts) — lexical snippets from trusted sources + embedding cosine ranking for caller-supplied vectors; [`brand-profile-draft.ts`](../packages/marketer-pro-contract/src/brand-profile-draft.ts) — browser draft key helpers; [`brand-profile-http.ts`](../packages/marketer-pro-contract/src/brand-profile-http.ts) — upsert/list/get query + body schemas.
- Web: [`apps/web/src/BrandProfileDraftPanel.tsx`](../apps/web/src/BrandProfileDraftPanel.tsx) — JSON draft, localStorage, lexical retrieval preview, optional API sync when `VITE_BRAND_PROFILE_API_ORIGIN` is set.
- Postgres: [`apps/api/db/migrations/005_brand_profiles.sql`](../apps/api/db/migrations/005_brand_profiles.sql) — `brand_profiles` (tenant + profile id, JSON body); persistence [`apps/api/src/db/brand-profile.ts`](../apps/api/src/db/brand-profile.ts); HTTP [`apps/api/src/brand-profile-server.ts`](../apps/api/src/brand-profile-server.ts) (`npm run start:brand-profile -w @home-link/marketer-api`) and routes in [`apps/api/src/marketer-pro/brand-profile-route.ts`](../apps/api/src/marketer-pro/brand-profile-route.ts). Optional **`MARKETER_BRAND_PROFILE_HTTP_CORS`** for browser `fetch` (same pattern as campaign server).
- Brand memory (pgvector + ingest + query): migration [`apps/api/db/migrations/006_brand_memory_pgvector.sql`](../apps/api/db/migrations/006_brand_memory_pgvector.sql); SQL [`apps/api/db/queries/brand_memory_knn.sql`](../apps/api/db/queries/brand_memory_knn.sql); persistence [`apps/api/src/db/brand-memory.ts`](../apps/api/src/db/brand-memory.ts); chunking [`apps/api/src/marketer-pro/chunk-text.ts`](../apps/api/src/marketer-pro/chunk-text.ts); HTTP [`apps/api/src/brand-memory-server.ts`](../apps/api/src/brand-memory-server.ts) (`npm run start:brand-memory -w @home-link/marketer-api`) and routes in [`apps/api/src/marketer-pro/brand-memory-route.ts`](../apps/api/src/marketer-pro/brand-memory-route.ts). Contract: [`packages/marketer-pro-contract/src/brand-memory-http.ts`](../packages/marketer-pro-contract/src/brand-memory-http.ts). Ingest pseudocode: [`docs/engineering/brand-memory-ingest-handler.md`](./engineering/brand-memory-ingest-handler.md). Optional **`MARKETER_BRAND_MEMORY_HTTP_CORS`** / **`MARKETER_BRAND_MEMORY_HTTP_TOKEN`** (Bearer) same pattern as brand profile server.

---

## Phase 2: Brand-aware text generation

## Goal:** Generate high-quality written content from brief inputs

## Build**

- Campaign brief input  
- AI content brief generation  
- Draft generation  
- Variants by goal: Awareness, Traffic, Engagement, Leads, App promotion, Sales — same six Outcome objectives as Meta Ads Manager (stored as snake_case on `GenerationBrief.contentGoal`; see contract).  
- Decision records for generated choices  
- Human approval / override flow  

# Features covered**

- Contextual asset creation (text portion)  
- Personalization engine foundation  
- Workflow agents foundation  

# Output**

- Blog / social / email / ad copy drafts  
- Brand-voice scoring  
- Search-intent scoring  
- Audit trail of AI choices  

## Repo checkpoint (keep current)**

- Generation brief and copy directive schemas live in [`packages/marketer-pro-contract/src/generation-brief.ts`](../packages/marketer-pro-contract/src/generation-brief.ts) (shared with publish `copy` on jobs).
- **Brief → draft + human approval or reject (Postgres + audit):** migration [`apps/api/db/migrations/004_generation_drafts.sql`](../apps/api/db/migrations/004_generation_drafts.sql); service [`apps/api/src/marketer-pro/draft-from-brief.ts`](../apps/api/src/marketer-pro/draft-from-brief.ts); draft text seam [`apps/api/src/marketer-pro/generate-draft-body.ts`](../apps/api/src/marketer-pro/generate-draft-body.ts) (`generateDraftBodyFromBrief` — OpenAI Chat Completions when `MARKETER_OPENAI_API_KEY` or `OPENAI_API_KEY` is set, else deterministic stub; HTTP in [`openai-draft-chat.ts`](../apps/api/src/marketer-pro/openai-draft-chat.ts)); HTTP entry [`apps/api/src/generation-draft-server.ts`](../apps/api/src/generation-draft-server.ts) (`npm run start:generation-draft -w @home-link/marketer-api`) — create / approve / **reject** POST paths; **GET** one draft and **GET** list-by-brief (summaries) via `GENERATION_DRAFT_PATH_GET` and `GENERATION_DRAFT_PATH_LIST_BY_BRIEF`. Approve/reject use conditional `UPDATE` on `pending_approval` plus `brief.workspaceId === tenantId` alignment with create.

- **Optional `contentGoal` on briefs** — codes `awareness` | `traffic` | `engagement` | `leads` | `app_promotion` | `sales` (Meta Outcome-aligned); display names in `CONTENT_GOAL_LABELS` / `labelContentGoal`, plus `stubContentGoalGuidance` in the contract. When the OpenAI path is off, [`generate-draft-body.ts`](../apps/api/src/marketer-pro/generate-draft-body.ts) still emits those goal-specific angle bullets in the stub.

## Next slices (Phase 2)**

- Multi-field draft transactions if the product needs them; richer generator inputs (brand profile + memory retrieval wired into the prompt).
- Brand-voice scoring and search-intent scoring on top of the approval seam above (`contentGoal` + stub angles are in place; numeric scoring still to ship).

---

## Phase 3: Platform-specific adaptation

# Goal:** Turn one content idea into network-ready variants

# Build adapters for**

- LinkedIn  
- Instagram  
- X  
- TikTok  
- Facebook / Meta  
- YouTube Shorts (later)  

# Each adapter should handle**

- Character limits  
- Hashtag strategy  
- Tone shifts  
- CTA style  
- Media requirements  
- Link behavior  
- Alt text / accessibility  

**Existing foundation**

- `classifyPublishNetwork`  
- Publish network taxonomy  
- Provider stubs  
- Publish job payloads  

## Output**

- One campaign becomes platform-specific publish assets  

---

## Phase 4: Unified content calendar

# Goal:** Manage campaigns and scheduled posts across networks

# Build**

- Calendar data model  
- Campaign model  
- Schedule entry model  
- Multi-network grouped entries  
- Status lifecycle: draft → pending review → approved → scheduled → publishing → published → failed → cancelled  
- Team review state  

# Output**

- Unified content calendar across all platforms  

# Repo checkpoint (Phase 4 slice)**

- Postgres: `apps/api/db/migrations/003_campaigns_and_schedule_campaign_id.sql` (`campaigns` + optional `schedule_entries.campaign_id` FK).  
- Contract: `packages/marketer-pro-contract/src/campaign.ts` (`CampaignRecord`, `CreateCampaignBodySchema`, `campaignRecordFromSqlRow`).  
- API persistence: `apps/api/src/db/campaign.ts` (`insertCampaign`, `listCampaignsByTenant`, `resolveCampaign`).  
- HTTP: `npm run start:campaign -w @home-link/marketer-api` — `apps/api/src/campaign-server.ts`, routes in `apps/api/src/marketer-pro/campaign-route.ts` (POST create, GET list, GET one, **GET schedule-entries** — list `schedule_entries` for `tenantId` + `campaignId`, **POST schedule-attach** → `updateScheduleEntryCampaignId` in `apps/api/src/db/schedule-entry.ts`). See `docs/engineering/redis-bullmq.md` for env vars. Optional **`MARKETER_CAMPAIGN_HTTP_CORS`** (`*` or comma-separated origins) enables browser `fetch` from `apps/web` when `VITE_CAMPAIGN_API_ORIGIN` points at this server (`CampaignSyncPanel`).

---

## Phase 5: Real publisher integrations

# Goal:** Replace stubs with real network publishing

## Networks**

- Meta / Instagram  
- LinkedIn  
- X  
- TikTok  
- YouTube Shorts  

# Build**

- OAuth connection storage  
- Token refresh  
- Provider-specific publish adapters  
- Retry-safe idempotency  
- Error normalization  
- Rate-limit handling  
- External post ID capture  

# Existing foundation**

- Provider adapter skeletons  
- `externalId`  
- Queue worker  
- HTTP publish runner  
- Postgres schedule lookup  

## Output**

- Real cross-platform publishing  

---

## Phase 6: Image and meme generation

# Goal:** Produce visual assets that match brand identity

# Build**

- Image prompt generation from content brief  
- Brand visual style injection  
- Meme template generation  
- Asset moderation  
- Asset storage  
- Image variants per platform  
- Approval workflow  

**Dependencies**

- Brand profile  
- Vector brand memory  
- Content calendar  
- Review workflow  

## Output**

- Branded image assets attached to scheduled posts  

---

## Phase 7: Short-form video pipeline

## Goal:** Generate and manage short-form video. (Harder — after images.)

## Build**

- Script generation  
- Scene outline  
- Caption generation  
- Voiceover option  
- B-roll / image selection  
- Video render job queue  
- Preview generation  
- Platform-specific exports  

## Needs**

- Durable job queue  
- Asset storage  
- Moderation checks  
- Cost controls  

## Output**

- TikTok / Reels / Shorts-ready video packages  

---

## Phase 8: SERP-based AI content briefs

# Goal:** Generate content briefs from live search results

# Build**

- SERP provider integration  
- Top-result extraction  
- Competitor summary  
- Keyword intent classification  
- Gap analysis  
- Suggested angle / headline / outline  
- SEO scoring  

# Features covered**

- AI content briefs  
- Search intent alignment  
- Real-time performance scoring foundation  

**Output**

- Search-informed content briefs  

---

## Phase 9: Analytics ingestion

# Goal:** Learn from published content

## Build:** normalized analytics ingestion per platform for

- Impressions  
- Reach  
- Engagements  
- Clicks  
- Saves  
- Shares  
- Comments  
- Follower growth  
- Video watch time  
- External post status  

---

## Phase 10: Sentiment and social listening

# Goal:** Understand audience reaction and adapt strategy

## Build**

- Comment / reply ingestion  
- Sentiment scoring  
- Topic clustering  
- Negative-signal detection  
- Brand safety flags  
- Suggested response strategy  
- Feed learnings back into brand memory  

## #Features covered**

- Sentiment analysis  
- Future strategy adjustment  
- Security / compliance anomaly detection foundation  

# Output**

- ## Sentiment-aware campaign feedback loop  

---

## Phase 11: Predictive scheduling

## Goal:** Recommend or automatically choose best posting windows

## Start simple**

- Historical engagement windows  
- Platform-specific best-time rules  
- Audience timezone weighting  
- Content-type weighting  

# Then advanced**

- Per-workspace predictive model  
- Trend-aware scheduling  
- Real-time adjustment  
- Autonomous rescheduling with audit log  

## Features covered**

- Predictive scheduling  
- Predictive insights  
- Automated optimization  

## Output**

- “Recommended publish time” first  
- “Auto-schedule campaign” later  

---

## Phase 12: Autonomous workflow agents

# Goal: Agents manage the full lifecycle with guardrails

## Agent responsibilities ##

- Campaign planner  
- Brief generator  
- Asset creator  
- Platform adapter  
- Compliance reviewer  
- Scheduler  
- Publisher  
- Analytics reviewer  
- Optimization recommender  

## Existing foundation**

- Autonomous run events  
- Decision audit log  
- Decision aggregator  

## Critical rule**

Agents must **not** silently mutate important campaign state. Every meaningful decision should create an #[#5](https://github.com/jlevy122112-star/Marketer-Pro/issues/5) audit event**and support ## human override**.

**Output**

- Draft-to-publish workflow automation  

---

## Phase 13: Team collaboration

**Goal:** Support real teams and agencies.

**Build**

- Shared calendars  
- Roles and permissions  
- Review assignments  
- Approval workflows  
- Comments  
- Change history  
- Client / workspace separation  
- Notification system  

**Output**

- Agency / team-ready workflow  

---

## Phase 14: Security, compliance, and auto-remediation

**Goal:** Keep AI output and data usage safe.

**Build**

- Claim detection  
- PII detection  
- Brand safety scan  
- Copyright / plagiarism checks  
- Regulated content rules  
- OAuth revocation  
- Account deletion  
- Anomaly detection  
- Auto-remediation suggestions  

**Output**

- Safe AI publishing with traceability  

---

## How this relates to other docs

| Document | Role |
|----------|------|
| [`README.md`](../README.md) | Product principles, contracts, repo layout |
| [`marketer-pro-target-architecture.md`](./marketer-pro-target-architecture.md) | Service boundaries, compliance, phased north star (P1–P7 style) |
| **This file** | End-to-end product build phases **1–14** (broader than infra-only phases) |

Update this file when phase scope or order changes materially.
