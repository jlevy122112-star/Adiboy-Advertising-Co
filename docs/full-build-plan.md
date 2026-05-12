# Marketer Pro — full build plan (phases 1–14)

**Author:** Jacob N. Levy  
**Captured:** 2026-05-11  

This document is the **repo-wide phased roadmap** for the product. It complements the north-star architecture in [`marketer-pro-target-architecture.md`](./marketer-pro-target-architecture.md) and the contract-first details in the root [`README.md`](../README.md).

---

## Phase 1: Brand intelligence core

**Goal:** Make the app understand a brand before generating anything.

**Build**

- Brand voice profile  
- Audience / persona profile  
- Product / service facts  
- Forbidden claims / compliance rules  
- Tone, style, vocabulary, visual identity  
- Brand memory backed by vector retrieval  

**Output**

- `BrandProfile`  
- `AudienceProfile`  
- `BrandKnowledgeSource`  
- `BrandVoiceGuidelines`  
- Vector-backed retrieval for generation context  

---

## Phase 2: Brand-aware text generation

**Goal:** Generate high-quality written content from brief inputs.

**Build**

- Campaign brief input  
- AI content brief generation  
- Draft generation  
- Variants by goal: awareness, conversion, education, launch, nurture  
- Decision records for generated choices  
- Human approval / override flow  

**Features covered**

- Contextual asset creation (text portion)  
- Personalization engine foundation  
- Workflow agents foundation  

**Output**

- Blog / social / email / ad copy drafts  
- Brand-voice scoring  
- Search-intent scoring  
- Audit trail of AI choices  

---

## Phase 3: Platform-specific adaptation

**Goal:** Turn one content idea into network-ready variants.

**Build adapters for**

- LinkedIn  
- Instagram  
- X  
- TikTok  
- Facebook / Meta  
- YouTube Shorts (later)  

**Each adapter should handle**

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

**Output**

- One campaign becomes platform-specific publish assets  

---

## Phase 4: Unified content calendar

**Goal:** Manage campaigns and scheduled posts across networks.

**Build**

- Calendar data model  
- Campaign model  
- Schedule entry model  
- Multi-network grouped entries  
- Status lifecycle: draft → pending review → approved → scheduled → publishing → published → failed → cancelled  
- Team review state  

**Output**

- Unified content calendar across all platforms  

---

## Phase 5: Real publisher integrations

**Goal:** Replace stubs with real network publishing.

**Networks**

- Meta / Instagram  
- LinkedIn  
- X  
- TikTok  
- YouTube Shorts  

**Build**

- OAuth connection storage  
- Token refresh  
- Provider-specific publish adapters  
- Retry-safe idempotency  
- Error normalization  
- Rate-limit handling  
- External post ID capture  

**Existing foundation**

- Provider adapter skeletons  
- `externalId`  
- Queue worker  
- HTTP publish runner  
- Postgres schedule lookup  

**Output**

- Real cross-platform publishing  

---

## Phase 6: Image and meme generation

**Goal:** Produce visual assets that match brand identity.

**Build**

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

**Output**

- Branded image assets attached to scheduled posts  

---

## Phase 7: Short-form video pipeline

**Goal:** Generate and manage short-form video. (Harder — after images.)

**Build**

- Script generation  
- Scene outline  
- Caption generation  
- Voiceover option  
- B-roll / image selection  
- Video render job queue  
- Preview generation  
- Platform-specific exports  

**Needs**

- Durable job queue  
- Asset storage  
- Moderation checks  
- Cost controls  

**Output**

- TikTok / Reels / Shorts-ready video packages  

---

## Phase 8: SERP-based AI content briefs

**Goal:** Generate content briefs from live search results.

**Build**

- SERP provider integration  
- Top-result extraction  
- Competitor summary  
- Keyword intent classification  
- Gap analysis  
- Suggested angle / headline / outline  
- SEO scoring  

**Features covered**

- AI content briefs  
- Search intent alignment  
- Real-time performance scoring foundation  

**Output**

- Search-informed content briefs  

---

## Phase 9: Analytics ingestion

**Goal:** Learn from published content.

**Build:** normalized analytics ingestion per platform for:

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

**Goal:** Understand audience reaction and adapt strategy.

**Build**

- Comment / reply ingestion  
- Sentiment scoring  
- Topic clustering  
- Negative-signal detection  
- Brand safety flags  
- Suggested response strategy  
- Feed learnings back into brand memory  

**Features covered**

- Sentiment analysis  
- Future strategy adjustment  
- Security / compliance anomaly detection foundation  

**Output**

- Sentiment-aware campaign feedback loop  

---

## Phase 11: Predictive scheduling

**Goal:** Recommend or automatically choose best posting windows.

**Start simple**

- Historical engagement windows  
- Platform-specific best-time rules  
- Audience timezone weighting  
- Content-type weighting  

**Then advanced**

- Per-workspace predictive model  
- Trend-aware scheduling  
- Real-time adjustment  
- Autonomous rescheduling with audit log  

**Features covered**

- Predictive scheduling  
- Predictive insights  
- Automated optimization  

**Output**

- “Recommended publish time” first  
- “Auto-schedule campaign” later  

---

## Phase 12: Autonomous workflow agents

**Goal:** Agents manage the full lifecycle with guardrails.

**Agent responsibilities**

- Campaign planner  
- Brief generator  
- Asset creator  
- Platform adapter  
- Compliance reviewer  
- Scheduler  
- Publisher  
- Analytics reviewer  
- Optimization recommender  

**Existing foundation**

- Autonomous run events  
- Decision audit log  
- Decision aggregator  

**Critical rule**

Agents must **not** silently mutate important campaign state. Every meaningful decision should create an **audit event** and support **human override**.

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
