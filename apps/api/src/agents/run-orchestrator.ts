import { randomUUID } from "node:crypto";
import {
  createRun,
  applyEvent,
  runProgress,
  type AutonomousRun,
  type CreateRunArgs,
} from "@home-link/marketer-pro-contract";
import {
  insertAutonomousRun,
  updateAutonomousRun,
  appendRunEvent,
} from "../db/autonomous-run.js";
import { runCampaignPlanner } from "./campaign-planner.js";
import { runBriefGenerator } from "./brief-generator.js";
import { runComplianceReview } from "./compliance-reviewer.js";
import { runSchedulerAgent } from "./scheduler-agent.js";
import { runAnalyticsReviewer } from "./analytics-reviewer.js";
import type { AutonomousRunState } from "@home-link/marketer-pro-contract";

type RunLog = { event: string; at: string; detail?: unknown };

export interface OrchestrationResult {
  run: AutonomousRun;
  log: RunLog[];
  scheduledPosts: Array<{ network: string; scheduledAt: string; headline: string; slotScore: number }>;
  analyticsReview: Awaited<ReturnType<typeof runAnalyticsReviewer>>;
}

function logEntry(event: string, detail?: unknown): RunLog {
  return { event, at: new Date().toISOString(), detail };
}

async function transition(
  run: AutonomousRun,
  toState: AutonomousRunState,
  log: RunLog[],
): Promise<AutonomousRun> {
  const eventId = randomUUID();
  const result = applyEvent(run, {
    eventId,
    runId: run.runId,
    actorUserId: null,
    occurredAt: new Date().toISOString(),
    type: "state_change",
    fromState: run.state,
    toState,
    failureKind: null,
  });
  if (!result.ok) {
    log.push(logEntry("transition_rejected", result.reason));
    return run;
  }
  await updateAutonomousRun(result.run);
  await appendRunEvent(run.runId, run.workspaceId, {
    eventId,
    runId: run.runId,
    actorUserId: null,
    occurredAt: new Date().toISOString(),
    type: "state_change",
    fromState: run.state,
    toState,
    failureKind: null,
  });
  log.push(logEntry(`state_change`, { from: run.state, to: toState }));
  return result.run;
}

export async function orchestrateRun(args: CreateRunArgs): Promise<OrchestrationResult> {
  const log: RunLog[] = [];
  let run = createRun(args);
  await insertAutonomousRun(run);
  log.push(logEntry("run_created", { id: run.runId, networks: run.request.platforms }));

  // requested → validating
  run = await transition(run, "validating", log);
  if (run.state !== "validating") return { run, log, scheduledPosts: [], analyticsReview: await runAnalyticsReviewer(run) };

  // validating → planning
  run = await transition(run, "planning", log);

  // Campaign plan
  log.push(logEntry("agent_start", "campaign_planner"));
  const plan = await runCampaignPlanner(run);
  log.push(logEntry("agent_done", { agent: "campaign_planner", plan }));

  // planning → generating
  run = await transition(run, "generating", log);

  // Generate briefs per network
  const briefs = [];
  for (const network of run.request.platforms) {
    log.push(logEntry("agent_start", `brief_generator:${network}`));
    const brief = await runBriefGenerator(run, plan, network);
    log.push(logEntry("agent_done", { agent: "brief_generator", network }));

    // Compliance review
    log.push(logEntry("agent_start", `compliance_reviewer:${network}`));
    const compliance = await runComplianceReview(brief);
    log.push(logEntry("compliance_result", { network, passed: compliance.passed, flags: compliance.flags }));

    if (!compliance.passed && compliance.sanitizedBody) {
      brief.body = compliance.sanitizedBody;
      log.push(logEntry("brief_sanitized", { network, flags: compliance.flags }));
    }

    briefs.push(brief);
  }

  // generating → scheduling
  run = await transition(run, "scheduling", log);

  log.push(logEntry("agent_start", "scheduler_agent"));
  const scheduled = await runSchedulerAgent(run, briefs);
  log.push(logEntry("agent_done", { agent: "scheduler_agent", count: scheduled.length }));

  // scheduling → ready_to_publish
  run = await transition(run, "ready_to_publish", log);

  // Analytics review (non-blocking)
  log.push(logEntry("agent_start", "analytics_reviewer"));
  const analyticsReview = await runAnalyticsReviewer(run);
  log.push(logEntry("agent_done", { agent: "analytics_reviewer", review: analyticsReview }));

  // ready_to_publish → completed
  run = await transition(run, "completed", log);
  log.push(logEntry("run_complete", { id: run.runId }));

  const progress = runProgress(run);
  log.push(logEntry("progress", progress));

  return {
    run,
    log,
    scheduledPosts: scheduled.map(s => ({
      network: s.network,
      scheduledAt: s.scheduledAt.toISOString(),
      headline: s.brief.headline,
      slotScore: s.slotScore,
    })),
    analyticsReview,
  };
}
