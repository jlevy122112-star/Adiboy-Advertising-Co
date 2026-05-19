# Marketer Pro v1.0 — Complete SaaS Inventory
### Generated: 2026-05-18 | Owner: Jacob Levy

This document is the authoritative record of every component in your SaaS application.
It covers what exists, how it works, and what is broken or missing.

---

## TABLE OF CONTENTS
1. [All 18 Servers](#1-all-18-servers)
2. [All 19 Route Handlers](#2-all-19-route-handlers)
3. [All 33 Database Migrations](#3-all-33-database-migrations)
4. [Contract Package — 60+ Schema Files](#4-contract-package)
5. [Queue Package](#5-queue-package)
6. [Frontend — 26 Components](#6-frontend)
7. [Auth System — Full Detail](#7-auth-system)
8. [Every Environment Variable](#8-environment-variables)
9. [What Is Broken or Stub/Missing](#9-broken-and-missing)
10. [All NPM Scripts](#10-npm-scripts)

---

## 1. ALL 18 SERVERS

### auth-server.ts
- **Port:** 8790 (AUTH_PORT)
- **Auth:** JWT (requireAuth on /auth/me and /auth/logout)
- **Routes:** POST /auth/signup, POST /auth/login, POST /auth/refresh, POST /auth/logout, GET /auth/me, POST /auth/password-reset-request, POST /auth/password-reset
- **Tables:** users, refresh_tokens
- **Status:** COMPLETE — this is the only server fully secured with JWT

### scheduler-publish-server.ts
- **Port:** 8791 (SCHEDULER_PUBLISH_PORT)
- **Auth:** Static bearer token (MARKETER_SCHEDULER_HTTP_TOKEN) — internal only, not browser-facing
- **Routes:** POST /api/marketer-pro/schedule-publish (enqueues BullMQ publish job)
- **Tables:** schedule_entries (read)
- **Status:** COMPLETE — internal server, static token is acceptable

### generation-draft-server.ts
- **Port:** 8792 (GENERATION_DRAFT_PORT)
- **Auth:** Static bearer token (MARKETER_GENERATION_HTTP_TOKEN) — INSECURE, needs JWT
- **Routes:** POST /api/marketer-pro/generation/draft-from-brief, POST /api/marketer-pro/generation/draft-approve, POST /api/marketer-pro/generation/draft-reject, GET /api/marketer-pro/generation/draft, GET /api/marketer-pro/generation/drafts-by-brief
- **Tables:** generation_drafts
- **Status:** NEEDS JWT AUTH (Slice 1.1)

### campaign-server.ts
- **Port:** 8793 (CAMPAIGN_HTTP_PORT)
- **Auth:** Static bearer token (MARKETER_CAMPAIGN_HTTP_TOKEN) — INSECURE, needs JWT
- **Routes:** POST /api/marketer-pro/campaigns/create, GET /api/marketer-pro/campaigns/get, GET /api/marketer-pro/campaigns/list, POST /api/marketer-pro/campaigns/schedule-attach, GET /api/marketer-pro/campaigns/schedule-entries, POST /api/marketer-pro/campaigns/schedule-entries/create, GET /api/marketer-pro/schedule-entries, POST /api/marketer-pro/schedule-entries/delete, POST /api/marketer-pro/schedule-entries/update, POST /api/marketer-pro/media/upload
- **Tables:** campaigns, schedule_entries
- **Status:** NEEDS JWT AUTH (Slice 1.1) + reads tenantId from query/body (Slice 1.2)

### brand-profile-server.ts
- **Port:** 8794 (BRAND_PROFILE_HTTP_PORT)
- **Auth:** Static bearer token (MARKETER_BRAND_PROFILE_HTTP_TOKEN) — INSECURE, needs JWT
- **Routes:** POST /api/marketer-pro/brand-profiles/upsert, GET /api/marketer-pro/brand-profiles/get, GET /api/marketer-pro/brand-profiles/list, PUT /api/marketer-pro/branding, GET /api/marketer-pro/branding, POST /workspace/:tenantId/logo-upload
- **Tables:** brand_profiles, workspaces
- **Status:** NEEDS JWT AUTH (Slice 1.1) + reads tenantId from query/body (Slice 1.2)

### internal-publish-server.ts
- **Port:** 8795 (INTERNAL_PUBLISH_PORT)
- **Auth:** Static bearer token (MARKETER_PUBLISH_HTTP_TOKEN) — internal only, acceptable
- **Routes:** POST /api/marketer-pro/publish-internal (executes actual social network publish)
- **Tables:** schedule_entries
- **Status:** COMPLETE — internal worker-to-worker, static token acceptable

### image-gen-server.ts
- **Port:** 8796 (IMAGE_GEN_PORT)
- **Auth:** PARTIALLY UPDATED — JWT added in this session (was static token only before)
- **Routes:** POST /api/marketer-pro/image/generate, GET /api/marketer-pro/image/status, GET /api/marketer-pro/image/list, POST /api/marketer-pro/image/approve, POST /api/marketer-pro/image/reject
- **Tables:** generated_assets
- **Status:** JWT ADDED THIS SESSION — needs commit

### video-gen-server.ts
- **Port:** 8797 (VIDEO_GEN_PORT)
- **Auth:** Static bearer token (MARKETER_VIDEO_GEN_HTTP_TOKEN) — INSECURE, needs JWT
- **Routes:** POST /api/marketer-pro/video/generate, GET /api/marketer-pro/video/status, GET /api/marketer-pro/video/list, GET /api/marketer-pro/video/script
- **Tables:** video_scripts, video_render_jobs, generated_assets
- **Status:** NEEDS JWT AUTH (Slice 1.1)

### social-oauth-server.ts
- **Port:** 8798 (SOCIAL_OAUTH_PORT)
- **Auth:** JWT (requireAuth) — ALREADY SECURED
- **Routes:** GET /oauth/:network/start, GET /oauth/:network/callback, DELETE /oauth/:network/disconnect, GET /oauth/connections
- **Tables:** social_credentials
- **Status:** COMPLETE

### serp-brief-server.ts
- **Port:** configurable (SERP_BRIEF_PORT)
- **Auth:** NONE — completely open
- **Routes:** POST /api/marketer-pro/serp/analyze, GET /api/marketer-pro/serp/brief
- **Tables:** serp_briefs
- **Status:** NEEDS JWT AUTH

### predictive-schedule-server.ts
- **Port:** configurable (PREDICTIVE_PORT)
- **Auth:** NONE — completely open
- **Routes:** GET /api/marketer-pro/predictive/best-times, GET /api/marketer-pro/predictive/heatmap
- **Tables:** schedule_recommendations, analytics_snapshots
- **Status:** NEEDS JWT AUTH

### analytics-server.ts
- **Port:** 8802 (ANALYTICS_PORT)
- **Auth:** JWT ADDED THIS SESSION — previously no auth at all
- **Routes:** POST /api/marketer-pro/analytics/ingest, GET /api/marketer-pro/analytics/summary, GET /api/marketer-pro/analytics/snapshots, GET /api/marketer-pro/analytics/list
- **Tables:** analytics_snapshots
- **Status:** JWT ADDED THIS SESSION — needs commit

### sentiment-server.ts
- **Port:** 8803 (SENTIMENT_PORT)
- **Auth:** JWT ADDED THIS SESSION — previously no auth at all
- **Routes:** POST /api/marketer-pro/sentiment/ingest, GET /api/marketer-pro/sentiment/summary, GET /api/marketer-pro/sentiment/comments, GET /api/marketer-pro/sentiment/list
- **Tables:** social_comments
- **Status:** JWT ADDED THIS SESSION — needs commit

### brand-memory-server.ts
- **Port:** configurable (BRAND_MEMORY_HTTP_PORT)
- **Auth:** Static bearer token (MARKETER_BRAND_MEMORY_HTTP_TOKEN) — internal ingestion server
- **Routes:** POST /api/marketer-pro/brand-memory/upsert, POST /api/marketer-pro/brand-memory/query
- **Tables:** brand_memory_chunks
- **Status:** ACCEPTABLE for internal use — not browser-facing

### viral-loop-server.ts
- **Port:** configurable (VIRAL_PORT)
- **Auth:** JWT (requireAuth) — ALREADY SECURED
- **Routes:** POST /api/marketer-pro/viral/share, GET /api/marketer-pro/viral/dashboard, GET /api/marketer-pro/viral/public/:shareId
- **Tables:** viral_shares, viral_signups
- **Status:** COMPLETE

### autonomous-agent-server.ts
- **Port:** 8805 (AUTONOMOUS_PORT)
- **Auth:** JWT ADDED THIS SESSION — previously no auth at all
- **Routes:** POST /api/marketer-pro/autonomous/run, GET /api/marketer-pro/autonomous/runs, GET /api/marketer-pro/autonomous/run/:id, POST /api/marketer-pro/autonomous/run/:id/pause, POST /api/marketer-pro/autonomous/run/:id/resume, POST /api/marketer-pro/autonomous/run/:id/cancel
- **Tables:** autonomous_runs
- **Status:** JWT ADDED THIS SESSION — needs commit

### team-server.ts
- **Port:** 8806 (TEAM_PORT)
- **Auth:** JWT ADDED THIS SESSION — previously no auth at all
- **Routes:** GET /api/marketer-pro/team/members, POST /api/marketer-pro/team/invite, POST /api/marketer-pro/team/role, POST /api/marketer-pro/team/activate, DELETE /api/marketer-pro/team/member, GET /api/marketer-pro/team/reviews, POST /api/marketer-pro/team/review, GET /api/marketer-pro/team/approvals, POST /api/marketer-pro/team/approve, GET /api/marketer-pro/team/comments, POST /api/marketer-pro/team/comment, GET /api/marketer-pro/team/notifications
- **Tables:** workspace_members, review_assignments, approvals, comments, notifications
- **Status:** JWT ADDED THIS SESSION — needs commit

### safety-server.ts
- **Port:** configurable (SAFETY_PORT)
- **Auth:** NONE — completely open
- **Routes:** POST /api/marketer-pro/safety/scan, GET /api/marketer-pro/safety/scans, GET /api/marketer-pro/safety/anomalies
- **Tables:** content_safety_scans, anomaly_events
- **Status:** NEEDS JWT AUTH

---

## 2. ALL 19 ROUTE HANDLERS

| File | What It Does |
|------|-------------|
| auth-route.ts | Signup, login, refresh, logout, /me, password reset (request only logs — no email sent) |
| campaign-route.ts | CRUD campaigns, CRUD schedule_entries, media upload to S3 |
| brand-profile-route.ts | Upsert/get/list brand profiles (JSON docs per tenant) |
| branding-route.ts | Get/put workspace branding (display name, logo URL, colors) |
| logo-upload-route.ts | Accepts image upload, stores to S3, returns URL |
| generation-draft-route.ts | Create draft from brief (OpenAI or stub), approve/reject with audit trail |
| image-gen-route.ts | DALL-E 3 image generation, S3 upload, status polling, approve/reject |
| video-gen-route.ts | OpenAI script generation → FFmpeg render → S3 upload, BullMQ queue |
| analytics-route.ts | Ingest platform analytics (Meta/X/LinkedIn/YouTube providers or stub), summarize |
| sentiment-route.ts | Ingest social comments, GPT sentiment scoring (or stub), list/summarize |
| social-oauth-route.ts | PKCE OAuth flows for Meta, X, LinkedIn, YouTube; token storage encrypted in DB |
| serp-route.ts | SerpAPI keyword research + OpenAI analysis → SERP brief; falls back to stub |
| predictive-route.ts | Best-time-to-post heatmap based on historical engagement + research rules |
| autonomous-route.ts | Start/pause/resume/cancel autonomous campaign runs, list runs + events |
| team-route.ts | Workspace members, invites, role management, review assignments, approvals, comments, notifications |
| viral-loop-route.ts | Share tracking, signup attribution, template clone tracking, viral dashboard |
| safety-route.ts | Content safety scanning (OpenAI moderation), anomaly detection, auto-remediation |
| brand-memory-route.ts | Ingest brand docs/text → pgvector embeddings; KNN + lexical query |
| schedule-publish-route.ts | Enqueue BullMQ publish job for a schedule_entry |

---

## 3. ALL 33 DATABASE MIGRATIONS

| File | Table / Feature Created |
|------|------------------------|
| 001_schedule_entries.sql | `schedule_entries` — tenant_id, id, network, content, status, scheduled_at, created_at |
| 002_schedule_entries_composite_pk.sql | Upgrades PK to composite (tenant_id, id) — idempotent |
| 003_campaigns_and_schedule_campaign_id.sql | `campaigns` table; adds campaign_id FK to schedule_entries |
| 004_generation_drafts.sql | `generation_drafts` — tenant-scoped draft rows + audit_log JSON |
| 005_brand_profiles.sql | `brand_profiles` — tenant-scoped JSON doc per profile_id |
| 006_brand_memory_pgvector.sql | `brand_memory_chunks` — text chunks + pgvector embeddings (requires pgvector extension) |
| 007_schedule_entries_scheduled_at.sql | Adds scheduled_at column to schedule_entries |
| 008_social_credentials.sql | `social_credentials` — encrypted OAuth tokens per tenant+network+account |
| 009_schedule_entry_video_options.sql | Adds video_options JSONB column to schedule_entries |
| 010_workspaces.sql | `workspaces` — tenant workspace rows with branding_json |
| 011_schedule_entry_metadata.sql | Adds metadata JSONB column to schedule_entries |
| 012_external_id_and_refresh_token.sql | Adds external_id (publish result) and refresh_token columns to schedule_entries |
| 012_generated_assets.sql | DUPLICATE NUMBER — same as 013, causes migration ordering issue |
| 013_generated_assets.sql | `generated_assets` — DALL-E / video render results per tenant |
| 014_video_scripts.sql | `video_scripts` — GPT-generated video scripts per tenant |
| 015_video_render_thumbnail.sql | Adds thumbnail_url to video_render_jobs |
| 016_users.sql | `users` — email, password_hash (argon2id), role, tenant_id, email_verified |
| 017_refresh_tokens.sql | `refresh_tokens` — hashed refresh tokens, expiry, revocation |
| 018_encrypt_social_tokens.sql | Adds pgcrypto AES-256 encryption to social_credentials.access_token |
| 019_viral_loop.sql | `viral_shares`, `viral_signups`, `viral_template_clones` |
| 020_generation_presets.sql | `generation_presets` — saved prompt/style presets per tenant |
| 021_serp_briefs.sql | `serp_briefs` — keyword research + competitor analysis results |
| 022_analytics.sql | `analytics_snapshots` — per-post engagement metrics per platform |
| 023_social_comments.sql | `social_comments` — ingested comments with GPT sentiment scores |
| 024_schedule_recommendations.sql | `schedule_recommendations` — AI-generated best-time suggestions |
| 025_autonomous_runs.sql | `autonomous_runs`, `autonomous_run_events` — campaign run state machine |
| 026_workspace_members.sql | `workspace_members` — user roles within a workspace |
| 027_review_assignments.sql | `review_assignments` — who reviews which content |
| 028_approvals.sql | `approvals` — approval records per content item |
| 029_comments.sql | `comments` — team comments on content items |
| 030_notifications.sql | `notifications` — in-app notification queue per user |
| 031_content_safety_scans.sql | `content_safety_scans` — OpenAI moderation results per asset |
| 032_anomaly_events.sql | `anomaly_events` — detected performance/safety anomalies |
| 033_account_deletion.sql | `account_deletion_requests` — GDPR-compliant deletion queue |

**KNOWN ISSUE:** Migration 012 is numbered twice (`012_external_id_and_refresh_token.sql` and `012_generated_assets.sql`). The migrate script applies files in lexical order — `012_generated_assets.sql` will sort BEFORE `012_external_id_and_refresh_token.sql` alphabetically, which is wrong. This needs to be renamed to `012a` or the duplicate renumbered.

---

## 4. CONTRACT PACKAGE
**Location:** `packages/marketer-pro-contract/src/`
**Purpose:** Shared Zod schemas, types, and pure helper functions used by both API and frontend. Zero runtime dependencies except `zod`.

| File | What It Defines |
|------|----------------|
| index.ts | Re-exports everything; workspace branding schema, entitlements, JWT payload |
| auth.ts | SignupBodySchema, LoginBodySchema, RefreshBodySchema, PasswordResetBodySchema, AuthErrorCode |
| decision-point.ts | DecisionControlModeSchema (4 modes), DecisionRecord, commitDecision, validateDecisionRecord |
| customer-journey.ts | 11 journey stages (intake → measure), decision point catalog |
| decision-audit-log.ts | DecisionAuditEntry, 6 entry kinds, appendAuditEntry, findCurrentDecision, decisionTrailFor |
| decision-aggregator.ts | buildDecisionTimeline, currentDecisionsForTarget, summarizeDecisionActivityForTarget |
| autonomous-run-state.ts | 12-state machine, validateRunTransition, isActiveState/isBlockingState/isTerminalState |
| autonomous-run-events.ts | 10 event types, eventToTargetState, isAuditOnlyEvent |
| autonomous-run.ts | AutonomousRun composite record, applyEvent reducer, retry budget helpers |
| generation-brief.ts | GenerationBriefSchema, validateBriefForGeneration, transitionBriefStatus, briefIdFor |
| provider-capability.ts | 10 providers, capability registry, rankCapableProviders, selectFirstCapableProvider |
| brand-intelligence.ts | BrandIntelligenceProfile — voice, compliance, persona, banned phrases |
| brand-profile-http.ts | HTTP request/response schemas for brand-profile-server |
| brand-profile-draft.ts | Draft lifecycle for brand profiles |
| brand-memory-http.ts | HTTP schemas for brand memory ingest/query |
| brand-memory-embedding.ts | Embedding request/response schemas |
| brand-retrieval.ts | BrandRetrievalSnippet, buildBrandGenerationContext, formatBrandGenerationContextForPrompt |
| brand-theme.ts | Full BrandTheme (palette, typography, voice, watermark), resolveBrandTheme |
| brand-theme-tokens.ts | themeToCssVariables, themeToTokensJson |
| brand-theme-resolve.ts | Override chain resolution (workspace → format → asset) |
| image-optimization.ts | ImageOptimizationSettings, DEFAULT_IMAGE_OPTIMIZATION, lintImageOptimization |
| seo-metadata.ts | SeoMetadata, ImageSeoMetadata, lintSeoMetadata, lintImageSeoMetadata |
| content-asset-formats.ts | 130+ asset format definitions (exact pixel specs per network/format) |
| content-formats.ts | Format categories, network mappings |
| content-calendar.ts | CalendarEvent, calendar view helpers |
| content-safety.ts | ScanFinding, SafetyPolicy, content safety schema |
| social-connections.ts | PUBLISHABLE_NETWORKS, NETWORK_CAPABILITIES, needsReconnect, resolvePublishTarget |
| workspace-autonomy.ts | AutonomousJobRequestSchema, autonomy mode (manual_review / autonomous) |
| plan-entitlements.ts | MarketerEntitlementsSchema — Free/Pro/Enterprise capabilities |
| campaign.ts | Campaign, CampaignStatus, campaign CRUD schemas |
| analytics.ts | AnalyticsSnapshot, engagement metrics schemas |
| sentiment.ts | SentimentAnalysis, SocialComment schemas |
| predictive-schedule.ts | BestTimeRecommendation, ScheduleHeatmap |
| serp-brief.ts | SerpBrief, keyword analysis, competitor analysis schemas |
| video-script.ts | VideoScript, VideoRenderJob schemas |
| team-collaboration.ts | WorkspaceMember, ReviewAssignment, Approval, Comment, Notification schemas |
| platform-adaptation.ts | adaptCopyToPlatform — adapt copy for each social network's constraints |
| generation-brief.ts | GenerationBrief with directives (copy/design/voice/seo/imageOpt/theme) |
| business-categories.ts | Business category taxonomy |

---

## 5. QUEUE PACKAGE
**Location:** `packages/marketer-pro-queue/src/`
**Purpose:** BullMQ-based job queues for async publish and video render work.

| File | What It Does |
|------|-------------|
| redis.ts | createRedisConnection() — IORedis connection from REDIS_URL |
| publish-queue.ts | createPublishQueue() — BullMQ queue named "marketer-publish" |
| publish-job.ts | PublishJobPayloadSchema, PublishJobResultSchema — typed job contract |
| publish-worker.ts | BullMQ Worker — picks up publish jobs, calls internal-publish-server HTTP endpoint |
| publish-runner.ts | executePublishJob() — the actual publish execution logic |
| publish-network.ts | classifyPublishNetwork() — maps network string to canonical slug |
| video-render-queue.ts | createVideoRenderQueue() — BullMQ queue named "video-render" |
| video-render-job.ts | VideoRenderJobPayload schema |
| worker-cli.ts | CLI entrypoint for running publish worker as a process |
| index.ts | Re-exports everything for external consumers |

**Queue config:** 5 retries, exponential backoff starting at 2000ms, removeOnComplete: 100, removeOnFail: 200.

---

## 6. FRONTEND
**Location:** `apps/web/src/`
**Framework:** React + Vite + TypeScript. No UI component library (all custom CSS).

| File | What It Renders |
|------|----------------|
| main.tsx | React root, mounts App |
| App.tsx | Main shell — sidebar navigation, settings panel, routes to all panels, auth state management |
| auth/LoginPage.tsx | Email + password login form, calls /auth/login |
| auth/SignupPage.tsx | Signup form with tenantId field, calls /auth/signup |
| auth/AuthGuard.tsx | Wraps protected routes — redirects to login if no JWT |
| onboarding/OnboardingWizard.tsx | Multi-step brand setup wizard (business type, voice, colors, social accounts) |
| calendar/MarketerCalendar.tsx | Monthly/weekly calendar view of scheduled posts, pin posts, day panel |
| PostEditModal.tsx | Create/edit a scheduled post — network, content, media, scheduled time |
| CampaignSyncPanel.tsx | Campaign list, create campaign, attach schedule entries to campaigns |
| BrandProfileDraftPanel.tsx | Brand intelligence profile editor — voice, tone, banned phrases, compliance |
| BrandThemePanel.tsx | Brand theme editor — colors, typography, logo upload, watermark settings |
| SocialConnectionsPanel.tsx | OAuth connect/disconnect for Meta, X, LinkedIn, YouTube |
| generation/GenerationHistoryPanel.tsx | List past AI-generated drafts, approve/reject |
| generation/PresetSelector.tsx | Save/load generation presets |
| analytics/AnalyticsDashboard.tsx | Per-post engagement metrics, platform breakdown, skeleton loaders |
| sentiment/SentimentPanel.tsx | Social comment ingestion, sentiment scores, brand safety flags |
| VideoGenPanel.tsx | Video script generation → render → S3 upload with step progress |
| serp/SerpBriefPanel.tsx | Keyword research, SERP analysis, competitor content brief |
| predictive/PredictiveSchedulePanel.tsx | Best-time heatmap, AI scheduling recommendations |
| autonomous/AutonomousAgentPanel.tsx | Start/pause/resume/cancel autonomous campaign runs, state display |
| team/TeamPanel.tsx | Team members, invite, role management, reviews, approvals, comments |
| viral/ViralDashboard.tsx | Viral share stats, signup attribution, template clone tracking |
| viral/ShareCampaignModal.tsx | Generate shareable link for a campaign |
| viral/PublicShareViewer.tsx | Public-facing share page (no auth required) |
| viral/BrandingSignatureToggle.tsx | Toggle "Powered by Marketer Pro" branding on shared content |
| safety/SafetyDashboard.tsx | Content safety scan results, anomaly events, auto-remediation status |

---

## 7. AUTH SYSTEM

### How JWT Is Created
- **File:** `apps/api/src/marketer-pro/auth/jwt.ts`
- **Algorithm:** HS256 (HMAC-SHA256)
- **Secret:** `MARKETER_JWT_SECRET` env var — throws if not set
- **Access token TTL:** 15 minutes
- **Refresh token TTL:** 7 days
- **Access token payload:** `{ sub: userId, tid: tenantId, email, role, iat, exp }`
- **Refresh token payload:** `{ sub: userId, tid: tenantId, type: "refresh", iat, exp }`

### How JWT Is Verified
- **File:** `apps/api/src/marketer-pro/auth/middleware.ts`
- **Function:** `requireAuth(req, res)` — extracts Bearer token from Authorization header, calls `verifyAccessToken`, returns `AuthContext { userId, tenantId, email, role }` or writes 401 and returns null
- **Used correctly on:** auth-server (/me, /logout), social-oauth-server, viral-loop-server
- **MISSING on:** campaign, brand-profile, generation-draft, image-gen, video-gen, analytics, sentiment, autonomous-agent, team, serp-brief, predictive, safety servers

### Password Hashing
- **Library:** `@node-rs/argon2` (argon2id variant)
- **File:** `apps/api/src/marketer-pro/auth/password.ts`

### Refresh Token Flow
1. Login/signup → `signRefreshToken()` creates JWT, stored hashed in `refresh_tokens` table
2. `/auth/refresh` → `verifyRefreshToken()` validates JWT type="refresh", `getRefreshToken()` checks DB, old token revoked, new pair issued
3. `/auth/logout` → `revokeRefreshToken()` or `revokeAllUserTokens()` for all-devices logout
- **Status:** COMPLETE and correct

### Password Reset Flow
- `/auth/password-reset-request` — accepts email, **LOGS ONLY, SENDS NO EMAIL** (TODO in code)
- `/auth/password-reset` — accepts token (a regular access JWT), updates password, revokes all tokens
- **BROKEN:** Reset tokens use `verifyAccessToken` — same as login tokens, they never expire differently and have no `type: "reset"` claim. Any valid access JWT can be used as a reset token. `verifyPasswordResetToken()` does not exist.
- **BROKEN:** No email is sent. Users cannot actually reset passwords in production.

### Rate Limiting
- **File:** `apps/api/src/marketer-pro/auth/rate-limit.ts`
- In-memory per-IP rate limit on signup, login, password-reset-request
- **Limitation:** Resets on server restart. Not distributed — doesn't work across multiple instances.

---

## 8. ENVIRONMENT VARIABLES

### Required for ALL servers
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `MARKETER_JWT_SECRET` | HS256 signing secret — min 32 chars, rotate before production |

### Auth Server (port 8790)
| Variable | Default | Purpose |
|----------|---------|---------|
| `AUTH_HOST` | 127.0.0.1 | Bind address |
| `AUTH_PORT` | 8790 | Listen port |
| `MARKETER_AUTH_HTTP_CORS` | — | Allowed origin(s) for browser |

### Campaign Server (port 8793)
| Variable | Default | Purpose |
|----------|---------|---------|
| `CAMPAIGN_HTTP_HOST` | 127.0.0.1 | Bind address |
| `CAMPAIGN_HTTP_PORT` | 8793 | Listen port |
| `MARKETER_CAMPAIGN_HTTP_CORS` | — | Allowed CORS origin(s) |
| `MARKETER_CAMPAIGN_HTTP_TOKEN` | — | Static bearer (being replaced by JWT) |

### Brand Profile Server (port 8794)
| Variable | Default | Purpose |
|----------|---------|---------|
| `BRAND_PROFILE_HTTP_HOST` | 127.0.0.1 | Bind address |
| `BRAND_PROFILE_HTTP_PORT` | 8794 | Listen port |
| `MARKETER_BRAND_PROFILE_HTTP_CORS` | — | Allowed CORS origin(s) |
| `MARKETER_BRAND_PROFILE_HTTP_TOKEN` | — | Static bearer (being replaced by JWT) |

### Internal Publish Server (port 8795)
| Variable | Default | Purpose |
|----------|---------|---------|
| `INTERNAL_PUBLISH_HOST` | 127.0.0.1 | Bind address |
| `INTERNAL_PUBLISH_PORT` | 8795 | Listen port |
| `MARKETER_PUBLISH_HTTP_TOKEN` | — | Static bearer (worker-to-worker, acceptable) |

### Image Gen Server (port 8796)
| Variable | Default | Purpose |
|----------|---------|---------|
| `IMAGE_GEN_HOST` | 127.0.0.1 | Bind address |
| `IMAGE_GEN_PORT` | 8796 | Listen port |
| `MARKETER_IMAGE_GEN_HTTP_CORS` | — | Allowed CORS origin(s) |
| `MARKETER_OPENAI_API_KEY` | — | OpenAI key for DALL-E 3 |
| `OPENAI_API_KEY` | — | Fallback OpenAI key |
| `AWS_ACCESS_KEY_ID` | — | S3 upload credentials |
| `AWS_SECRET_ACCESS_KEY` | — | S3 upload credentials |
| `AWS_S3_REGION` | — | S3 region |
| `AWS_S3_BUCKET` | — | S3 bucket name |

### Video Gen Server (port 8797)
| Variable | Default | Purpose |
|----------|---------|---------|
| `VIDEO_GEN_HOST` | 127.0.0.1 | Bind address |
| `VIDEO_GEN_PORT` | 8797 | Listen port |
| `MARKETER_VIDEO_GEN_HTTP_CORS` | — | Allowed CORS origin(s) |
| `MARKETER_OPENAI_API_KEY` | — | OpenAI key for script generation |
| `REDIS_URL` | redis://127.0.0.1:6379 | BullMQ video render queue |
| `AWS_ACCESS_KEY_ID` | — | S3 credentials |
| `AWS_SECRET_ACCESS_KEY` | — | S3 credentials |
| `AWS_S3_REGION` | — | S3 region |
| `AWS_S3_BUCKET` | — | S3 bucket |

### Social OAuth Server (port 8798)
| Variable | Default | Purpose |
|----------|---------|---------|
| `SOCIAL_OAUTH_HOST` | 127.0.0.1 | Bind address |
| `SOCIAL_OAUTH_PORT` | 8798 | Listen port |
| `META_APP_ID` | — | Facebook/Instagram OAuth app |
| `META_APP_SECRET` | — | Facebook/Instagram OAuth secret |
| `X_CLIENT_ID` | — | X (Twitter) OAuth client ID |
| `X_CLIENT_SECRET` | — | X OAuth client secret |
| `LINKEDIN_CLIENT_ID` | — | LinkedIn OAuth client ID |
| `LINKEDIN_CLIENT_SECRET` | — | LinkedIn OAuth client secret |
| `YOUTUBE_CLIENT_ID` | — | YouTube (Google) OAuth client ID |
| `YOUTUBE_CLIENT_SECRET` | — | YouTube OAuth client secret |
| `MARKETER_*_REDIRECT_URI` | — | OAuth callback URI per network (must match developer console) |
| `PGCRYPTO_KEY` | — | AES-256 key for encrypting stored OAuth tokens |

### Analytics Server (port 8802)
| Variable | Default | Purpose |
|----------|---------|---------|
| `ANALYTICS_HOST` | 127.0.0.1 | Bind address |
| `ANALYTICS_PORT` | 8802 | Listen port |
| `MARKETER_ANALYTICS_HTTP_CORS` | — | Allowed CORS origin(s) |
| `MARKETER_META_ACCESS_TOKEN` | — | Fallback static Meta token (dev only) |
| `MARKETER_X_ACCESS_TOKEN` | — | Fallback static X token (dev only) |
| `MARKETER_LINKEDIN_ACCESS_TOKEN` | — | Fallback static LinkedIn token (dev only) |
| `MARKETER_YOUTUBE_ACCESS_TOKEN` | — | Fallback static YouTube token (dev only) |

### Sentiment Server (port 8803)
| Variable | Default | Purpose |
|----------|---------|---------|
| `SENTIMENT_HOST` | 127.0.0.1 | Bind address |
| `SENTIMENT_PORT` | 8803 | Listen port |
| `MARKETER_SENTIMENT_HTTP_CORS` | — | Allowed CORS origin(s) |
| `MARKETER_OPENAI_API_KEY` | — | GPT sentiment analysis |

### Autonomous Agent Server (port 8805)
| Variable | Default | Purpose |
|----------|---------|---------|
| `AUTONOMOUS_HOST` | 127.0.0.1 | Bind address |
| `AUTONOMOUS_PORT` | 8805 | Listen port |
| `MARKETER_AUTONOMOUS_HTTP_CORS` | — | Allowed CORS origin(s) |
| `MARKETER_OPENAI_API_KEY` | — | Campaign planner + brief generator |

### Team Server (port 8806)
| Variable | Default | Purpose |
|----------|---------|---------|
| `TEAM_HOST` | 127.0.0.1 | Bind address |
| `TEAM_PORT` | 8806 | Listen port |
| `MARKETER_TEAM_HTTP_CORS` | — | Allowed CORS origin(s) |

### SERP Brief Server
| Variable | Purpose |
|----------|---------|
| `SERP_BRIEF_HOST` | Bind address |
| `SERP_BRIEF_PORT` | Listen port |
| `SERPAPI_KEY` | SerpAPI key — omit to use stub results |
| `MARKETER_OPENAI_API_KEY` | OpenAI for analysis — omit to use stub |
| `MARKETER_SERP_HTTP_CORS` | Allowed CORS origin(s) |

### Safety Server
| Variable | Purpose |
|----------|---------|
| `SAFETY_HOST` | Bind address |
| `SAFETY_PORT` | Listen port |
| `MARKETER_SAFETY_HTTP_CORS` | Allowed CORS origin(s) |
| `MARKETER_OPENAI_API_KEY` | OpenAI moderation API |

### Scheduler / Publish Queue
| Variable | Purpose |
|----------|---------|
| `SCHEDULER_PUBLISH_HOST` | Bind address |
| `SCHEDULER_PUBLISH_PORT` | Listen port |
| `MARKETER_SCHEDULER_HTTP_TOKEN` | Static bearer for internal scheduler calls |
| `MARKETER_PUBLISH_HTTP_TOKEN` | Static bearer for internal publish calls |
| `REDIS_URL` | BullMQ connection |

### Social Publish Providers (used by internal-publish-server)
| Variable | Purpose |
|----------|---------|
| `MARKETER_META_ACCESS_TOKEN` | Static Meta page token (dev fallback) |
| `MARKETER_META_PAGE_ID` | Static Meta page ID (dev fallback) |
| `MARKETER_X_ACCESS_TOKEN` | Static X token (dev fallback) |
| `MARKETER_INSTAGRAM_ACCESS_TOKEN` | Static Instagram token (dev fallback) |
| `MARKETER_INSTAGRAM_USER_ID` | Static Instagram user ID (dev fallback) |
| `MARKETER_INSTAGRAM_IMAGE_URL` | Static image URL for Instagram (dev fallback) |
| `MARKETER_LINKEDIN_ACCESS_TOKEN` | Static LinkedIn token (dev fallback) |
| `MARKETER_LINKEDIN_AUTHOR_URN` | LinkedIn author URN (dev fallback) |
| `MARKETER_YOUTUBE_ACCESS_TOKEN` | Static YouTube token (dev fallback) |
| `MARKETER_YOUTUBE_CHANNEL_ID` | YouTube channel ID (dev fallback) |
| `MARKETER_YOUTUBE_IMAGE_URLS` | JSON array of image URLs for YouTube (dev fallback) |

---

## 9. BROKEN AND MISSING

### CRITICAL — Blocks production launch

| # | What | Where | Impact |
|---|------|--------|--------|
| 1 | **9 servers have no JWT auth** | campaign, brand-profile, generation-draft, image-gen, video-gen, serp-brief, predictive, safety — plus analytics/sentiment/autonomous/team (just updated this session, not committed) | Any user can read/write any tenant's data |
| 2 | **tenantId trusted from client** | campaign-route.ts, brand-profile-route.ts, generation-draft-route.ts | Tenant A can pass Tenant B's tenantId and access their data |
| 3 | **Password reset sends no email** | auth-route.ts line 189-191 | Users who forget password cannot recover accounts |
| 4 | **Password reset token is broken** | auth-route.ts line 202-203 | Uses verifyAccessToken (15-min login token) for reset — no type check, wrong TTL |
| 5 | **`verifyPasswordResetToken()` does not exist** | Referenced in GTM plan | Function was planned but never written |
| 6 | **Migration 012 numbered twice** | apps/api/db/migrations/ | `012_generated_assets.sql` conflicts with `012_external_id_and_refresh_token.sql` — undefined lexical sort order |
| 7 | **No SMTP configured** | auth-route.ts | Password reset, invite emails, notifications all silently drop |
| 8 | **Rate limiting is in-memory only** | auth/rate-limit.ts | Resets on restart, doesn't scale across multiple server instances |

### HIGH — Degrades functionality

| # | What | Where | Impact |
|---|------|--------|--------|
| 9 | **All social publish providers fall back to stub** | providers/meta.ts, x.ts, linkedin.ts, instagram.ts, youtube.ts | No actual posts go live without real OAuth credentials in env |
| 10 | **TikTok provider is documented stub** | providers/tiktok.ts | TikTok publishing returns stub result — no TikTok Content API integrated |
| 11 | **Analytics providers use stub** | analytics/analytics-provider.ts | Without platform tokens, all analytics are synthetic fake data |
| 12 | **SERP falls back to stub** | serp/serp-provider.ts | Without SERPAPI_KEY, keyword research returns hardcoded fake results |
| 13 | **Sentiment GPT analysis falls back to stub** | sentiment/sentiment-provider.ts | Without OPENAI key, sentiment scores are hardcoded neutral values |
| 14 | **Campaign planner agent uses stub** | agents/campaign-planner.ts | Without OPENAI key, autonomous run planning returns hardcoded template |
| 15 | **Brief generator agent uses stub** | agents/brief-generator.ts | Without OPENAI key, generated briefs are hardcoded templates |
| 16 | **pgvector extension must be installed** | migration 006 | Supabase requires pgvector to be enabled in the Supabase dashboard — not auto-installed |

### MEDIUM — Polish / App Store blockers

| # | What | Impact |
|---|------|--------|
| 17 | No shared Toast component | Raw fetch errors show nothing or alert() |
| 18 | No useApi hook | Every panel does raw fetch with no consistent error handling |
| 19 | No ConfirmModal | window.confirm() used — rejected by Apple/Google |
| 20 | Empty states missing | Blank panels on fresh accounts |
| 21 | No password strength meter on signup | App store review may flag |
| 22 | No "session expired" message | Users get silently logged out with no explanation |
| 23 | No branded loading screen | Bare spinner on auth |
| 24 | serp-brief, predictive, safety servers have no auth | These 3 were not in the original 9-server list but are also exposed |

---

## 10. NPM SCRIPTS

### Root (monorepo)
| Script | What It Does |
|--------|-------------|
| `npm run typecheck` | TypeScript check across all workspaces |
| `npm run lint` | ESLint across packages/ and apps/ |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run verify` | Workspace structure verification (scripts/verify-workspace.mjs) |
| `npm run test:packages` | Vitest run — all package tests |
| `npm run test:check` | typecheck + test:packages |
| `npm run check` | verify + typecheck + lint + test:packages (full CI gate) |
| `npm run build:queue` | Build marketer-pro-queue package |
| `npm run queue:worker` | Build queue + start publish worker CLI |
| `npm run queue:enqueue-smoke` | Build queue + enqueue a test publish job |
| `npm run api:internal` | Build API + start internal-publish-server |
| `npm run api:scheduler` | Build API + start scheduler-publish-server |
| `npm run api:campaign` | Build API + start campaign-server |
| `npm run api:brand` | Build API + start brand-profile-server |
| `npm run db:migrate` | Run all SQL migrations against DATABASE_URL |

### apps/api workspace
Exposes individual `start:*` scripts for each server (start:auth, start:campaign, start:brand-profile, start:analytics, start:sentiment, start:team, start:autonomous, start:image-gen, start:video-gen, start:social-oauth, start:viral, start:serp, start:predictive, start:safety, start:brand-memory).

### apps/web workspace
| Script | What It Does |
|--------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |

### packages/marketer-pro-queue
| Script | What It Does |
|--------|-------------|
| `npm run build` | tsc compile to dist/ |
| `npm run dev` | tsc watch mode |

### packages/marketer-pro-contract
| Script | What It Does |
|--------|-------------|
| `npm run build` | tsc compile |
| `npm run typecheck` | Type check only |

---

## PRIORITY ACTION LIST

Based on your GTM plan, in exact priority order:

### DO FIRST (Security — nothing ships until done)
1. Commit the 4 servers already patched this session (analytics, sentiment, autonomous-agent, team)
2. Add JWT to: video-gen-server, campaign-server, brand-profile-server, generation-draft-server
3. Add JWT to: serp-brief-server, predictive-schedule-server, safety-server (not in original 9 but equally exposed)
4. Fix tenantId extraction in campaign-route, brand-profile-route, generation-draft-route to use JWT not client input
5. Fix password reset: create verifyPasswordResetToken(), add type:"reset" claim, 1-hour TTL

### DO SECOND (Database & Build)
6. Fix migration 012 duplicate numbering before running migrations
7. Enable pgvector extension in Supabase dashboard
8. Run npm run db:migrate
9. Run start-dev.ps1 -Rebuild, test login end-to-end

### DO THIRD (App Store Requirements)
10. Build Toast component + useApi hook, wire everywhere
11. Build ConfirmModal, replace window.confirm()
12. Add empty states to 5 panels
13. Wire SMTP (Resend recommended) — fixes password reset + enables invite emails
14. Mobile responsiveness + accessibility audit

---

*This document reflects codebase state as of 2026-05-18. Save this file. It is the full source of truth for your product.*
