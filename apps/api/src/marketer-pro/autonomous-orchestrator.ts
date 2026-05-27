/**
 * Autonomous Run Orchestrator — MVP implementation.
 *
 * Drives an AutonomousRun through the full state machine:
 *   requested → validating → planning → generating →
 *   scheduling → ready_to_publish → publishing → completed
 *
 * Runs in the background (fire-and-forget from the API handler).
 * State is persisted to `autonomous_runs` after every transition.
 * The client polls GET /api/autonomous/runs/:runId for status.
 *
 * AI calls:
 *   - planning stage   → Anthropic/OpenAI: generate campaign plan (topics)
 *   - generating stage → generatePosts() + generateVideoScripts() per planned post
 *
 * Publishing in MVP: saves schedule_entries; no live social push yet.
 */

import { randomUUID } from "node:crypto";

import {
  createRun,
  applyEvent,
  type AutonomousRun,
  type AutonomousJobRequest,
  type WorkspaceAutonomyPolicy,
  DEFAULT_RETRY_BUDGET,
} from "@home-link/marketer-pro-contract";

import {
  insertAutonomousRun,
  updateAutonomousRun,
} from "../db/autonomous-run.js";
import { insertScheduleEntry } from "../db/schedule-entry.js";
import type { MvpBrandConfig } from "../db/brand-profile.js";
import { generatePosts } from "./mvp-generate-posts.js";
import { generateVideoScripts } from "./mvp-generate-assets.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const PLAN_TIMEOUT_MS = 45_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlannedPost {
  topic: string;
  platforms: string[];
  scheduledAt: string; // ISO
  contentGoal: string;
  cta: string;
}

// ─── Event helpers ────────────────────────────────────────────────────────────

function eventId(): string {
  return `evt_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function now(): string {
  return new Date().toISOString();
}

function advance(
  run: AutonomousRun,
  toState: AutonomousRun["state"],
  reason?: string,
): AutonomousRun {
  const result = applyEvent(run, {
    eventId: eventId(),
    runId: run.runId,
    occurredAt: now(),
    actorUserId: null,
    type: "state_change",
    fromState: run.state,
    toState,
    failureKind: null,
    reason,
  });
  return result.ok ? result.run : run;
}

function fail(
  run: AutonomousRun,
  failureKind: AutonomousRun["failureKind"],
  reason: string,
): AutonomousRun {
  const result = applyEvent(run, {
    eventId: eventId(),
    runId: run.runId,
    occurredAt: now(),
    actorUserId: null,
    type: "state_change",
    fromState: run.state,
    toState: "failed",
    failureKind: failureKind ?? "internal_error",
    reason,
  });
  return result.ok ? result.run : { ...run, state: "failed", failureKind: failureKind ?? "internal_error" };
}

// ─── AI: campaign planner ─────────────────────────────────────────────────────

async function buildCampaignPlan(
  brand: MvpBrandConfig | null,
  request: AutonomousJobRequest,
): Promise<PlannedPost[]> {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  const oaiKey = (process.env.MARKETER_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "").trim();

  const brandLines = [
    brand?.brandName    && `Brand: ${brand.brandName}`,
    brand?.industry     && `Industry: ${brand.industry}`,
    brand?.brandWords   && `Voice: ${brand.brandWords}`,
    brand?.problem      && `Problem: ${brand.problem}`,
    brand?.solution     && `Solution: ${brand.solution}`,
    brand?.outcome      && `Outcome: ${brand.outcome}`,
  ].filter(Boolean).join("\n");

  const platforms = request.platforms.join(", ");
  const postCount = request.scope === "full_campaign"
    ? (request.targetPostCount ?? 5)
    : 1;

  // Spread posts across date range (default: next 7 days)
  const earliest = request.earliestPublishAt
    ? new Date(request.earliestPublishAt)
    : new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h from now
  const latest = request.latestPublishAt
    ? new Date(request.latestPublishAt)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const windowMs = latest.getTime() - earliest.getTime();
  const gapMs = postCount > 1 ? windowMs / (postCount - 1) : 0;

  const prompt = `You are a senior marketing strategist. Create a ${postCount}-post campaign plan.

${request.seedPrompt ? `Campaign brief from client: ${request.seedPrompt}` : "No brief given — generate based on brand context."}

Platforms: ${platforms}
${brandLines ? `\nBrand context:\n${brandLines}` : ""}

Return ONLY valid JSON array (no markdown, no explanation):
[
  {
    "topic": "Specific compelling post topic — not generic",
    "contentGoal": "awareness|engagement|conversion|retention",
    "cta": "Clear call to action"
  }
]

Rules:
- ${postCount} items total
- Each topic must be distinct and directly tied to the brand's problem/solution/outcome
- Topics should build on each other for a campaign arc
- contentGoal should vary across posts
- cta should be concrete and actionable`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLAN_TIMEOUT_MS);

  try {
    let responseText: string | null = null;

    if (apiKey) {
      const res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { content?: { text?: string }[] };
        responseText = j.content?.[0]?.text?.trim() ?? null;
      }
    } else if (oaiKey) {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${oaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a senior marketing strategist. Return only JSON arrays." },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1024,
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        responseText = j.choices?.[0]?.message?.content?.trim() ?? null;
      }
    }

    if (responseText) {
      // Strip markdown fences if present
      const clean = responseText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
      // Handle both array response and wrapped object (gpt-4o-mini with json_object mode)
      let parsed: unknown;
      try {
        parsed = JSON.parse(clean);
      } catch {
        parsed = null;
      }
      // Handle { posts: [...] } or { plan: [...] } wrappers from json_object mode
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        parsed = obj.posts ?? obj.plan ?? obj.items ?? obj.campaign ?? Object.values(obj)[0];
      }
      if (Array.isArray(parsed) && parsed.length > 0) {
        return (parsed as { topic?: string; contentGoal?: string; cta?: string }[])
          .slice(0, postCount)
          .map((p, i): PlannedPost => ({
            topic: typeof p.topic === "string" ? p.topic : `${brand?.brandName ?? "Brand"} post ${i + 1}`,
            platforms: request.platforms.slice(),
            scheduledAt: new Date(earliest.getTime() + i * gapMs).toISOString(),
            contentGoal: typeof p.contentGoal === "string" ? p.contentGoal : "awareness",
            cta: typeof p.cta === "string" ? p.cta : "Learn more",
          }));
      }
    }
  } catch { /* fall through to stub */ } finally {
    clearTimeout(timer);
  }

  // Stub fallback — deterministic so the run doesn't fail just because AI is unavailable
  const topics = [
    `Why ${brand?.solution ?? "our solution"} is changing ${brand?.industry ?? "the industry"}`,
    `The #1 mistake ${brand?.industry ?? "businesses"} make with ${brand?.problem ?? "this problem"}`,
    `How we help ${brand?.outcome ?? "customers get results"}`,
    `Behind the scenes at ${brand?.brandName ?? "our brand"}`,
    `${brand?.brandName ?? "We"} — your questions answered`,
  ];
  return topics.slice(0, postCount).map((topic, i): PlannedPost => ({
    topic,
    platforms: request.platforms.slice(),
    scheduledAt: new Date(earliest.getTime() + i * gapMs).toISOString(),
    contentGoal: ["awareness", "engagement", "conversion", "retention", "awareness"][i % 5] ?? "awareness",
    cta: "Learn more",
  }));
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

async function orchestrateRun(
  run: AutonomousRun,
  tenantId: string,
  brand: MvpBrandConfig | null,
): Promise<void> {
  const save = async (r: AutonomousRun) => {
    await updateAutonomousRun(r);
    return r;
  };

  // ── requested → validating ─────────────────────────────────────────────────
  run = await save(advance(run, "validating", "preconditions_check"));

  // Basic validation: ensure we have something to generate
  if (!run.request.platforms.length) {
    run = await save(fail(run, "validation_failed", "no platforms selected"));
    return;
  }

  // ── validating → planning ──────────────────────────────────────────────────
  run = await save(advance(run, "planning", "ai_campaign_planning"));

  let plan: PlannedPost[];
  try {
    plan = await buildCampaignPlan(brand, run.request);
  } catch (e) {
    run = await save(fail(run, "planning_failed", String(e)));
    return;
  }

  // ── planning → generating ──────────────────────────────────────────────────
  run = await save(advance(run, "generating", "ai_content_generation"));

  // Generate posts + video scripts for each planned post
  const generatedPosts: Array<{
    plannedPost: PlannedPost;
    posts: Awaited<ReturnType<typeof generatePosts>>;
    videoScripts: Awaited<ReturnType<typeof generateVideoScripts>>;
  }> = [];

  for (const planned of plan) {
    try {
      const input = {
        platforms: planned.platforms.filter(p => ["ig", "li", "x", "fb", "tt"].includes(p)),
        topic: planned.topic,
        contentGoal: planned.contentGoal,
        cta: planned.cta,
        hashtagStrategy: "Broad reach (10–15 hashtags)",
        urgency: "Normal",
        brandName:       brand?.brandName,
        brandVoice:      brand?.brandWords,
        brandColor:      brand?.brandColor,
        businessType:    brand?.businessType,
        industry:        brand?.industry,
        problem:         brand?.problem,
        solution:        brand?.solution,
        outcome:         brand?.outcome,
        website:         brand?.website,
        phone:           brand?.phone,
        contactEmail:    brand?.email,
        instagramHandle: brand?.instagram,
        address:         brand?.address,
      };

      // Normalize platform codes: meta → fb, tiktok → tt, linkedin → li, etc.
      const platformMap: Record<string, string> = {
        instagram: "ig", meta: "fb", facebook: "fb",
        linkedin: "li", twitter: "x", tiktok: "tt",
      };
      input.platforms = input.platforms.map(p => platformMap[p] ?? p);

      const [posts, videoScripts] = await Promise.all([
        generatePosts(input),
        generateVideoScripts(input),
      ]);
      generatedPosts.push({ plannedPost: planned, posts, videoScripts });
    } catch {
      // Non-fatal: log error event but continue with other posts
      applyEvent(run, {
        eventId: eventId(),
        runId: run.runId,
        occurredAt: now(),
        actorUserId: null,
        type: "error",
        errorCode: "generation_error",
        message: `Failed to generate post for topic: ${planned.topic.slice(0, 100)}`,
        recoverable: true,
        failureKind: null,
      });
    }
  }

  if (generatedPosts.length === 0) {
    run = await save(fail(run, "generation_failed", "all post generations failed"));
    return;
  }

  // ── generating → scheduling ────────────────────────────────────────────────
  run = await save(advance(run, "scheduling", "assigning_publish_times"));

  // ── scheduling → ready_to_publish ─────────────────────────────────────────
  run = await save(advance(run, "ready_to_publish", "schedule_entries_queued"));

  // Persist schedule entries to DB
  for (const { plannedPost, posts } of generatedPosts) {
    for (const post of posts) {
      const summary = `[${post.platform.toUpperCase()}] ${plannedPost.topic.slice(0, 100)} — ${post.content.slice(0, 200)}`;
      await insertScheduleEntry({
        tenantId,
        scheduleEntryId: randomUUID(),
        campaignId: null,
        network: post.platform,
        status: "scheduled",
        contentSummary: summary,
        scheduledAt: plannedPost.scheduledAt,
      });
    }
  }

  // ── ready_to_publish → publishing ─────────────────────────────────────────
  run = await save(advance(run, "publishing", "publishing_to_platforms"));

  // MVP: no live social push yet — entries are scheduled, which is the deliverable
  // Future: iterate schedule entries, call social APIs per network

  // ── publishing → completed ─────────────────────────────────────────────────
  run = await save(advance(run, "completed", "all_posts_scheduled"));

  console.log(JSON.stringify({
    level: "info",
    event: "autonomous_run_completed",
    runId: run.runId,
    tenantId,
    posts: generatedPosts.reduce((n, g) => n + g.posts.length, 0),
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Create a run record and launch the orchestrator in the background. */
export async function startAutonomousRun(args: {
  tenantId: string;
  request: AutonomousJobRequest;
  policy: WorkspaceAutonomyPolicy;
  brand: MvpBrandConfig | null;
}): Promise<AutonomousRun | null> {
  const run = createRun({
    runId: `run_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    workspaceId: args.tenantId,
    request: args.request,
    policy: args.policy,
    retryBudget: DEFAULT_RETRY_BUDGET,
  });

  const saved = await insertAutonomousRun(run);
  if (!saved) return null;

  // Fire-and-forget — orchestrator runs in background
  orchestrateRun(saved, args.tenantId, args.brand).catch((err) => {
    console.error(JSON.stringify({
      level: "error",
      event: "autonomous_orchestrator_crash",
      runId: saved.runId,
      error: String(err),
    }));
  });

  return saved;
}

/** Apply a user action (cancel / pause / resume) to an existing run. */
export async function applyUserAction(
  run: AutonomousRun,
  action: "cancel" | "pause" | "resume",
  actorUserId: string,
): Promise<AutonomousRun> {
  const type =
    action === "cancel" ? "cancel_requested" :
    action === "pause"  ? "pause_requested"  :
    "resume_requested";

  const result = applyEvent(run, {
    eventId: eventId(),
    runId: run.runId,
    occurredAt: now(),
    actorUserId,
    type,
  } as Parameters<typeof applyEvent>[1]);

  const next = result.ok ? result.run : run;
  await updateAutonomousRun(next);
  return next;
}
