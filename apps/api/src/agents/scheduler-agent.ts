import type { AutonomousRun } from "@home-link/marketer-pro-contract";
import type { GeneratedBrief } from "./brief-generator.js";
import { predictBestTimes } from "../predictive/predict-best-time.js";

export interface ScheduledPost {
  network: string;
  scheduledAt: Date;
  brief: GeneratedBrief;
  slotScore: number;
}

export async function runSchedulerAgent(
  run: AutonomousRun,
  briefs: GeneratedBrief[],
): Promise<ScheduledPost[]> {
  const scheduled: ScheduledPost[] = [];
  const now = new Date();

  for (const brief of briefs) {
    const slots = await predictBestTimes({
      tenantId: run.workspaceId,
      network: brief.network,
    });

    const topSlot = slots[0];
    if (!topSlot) {
      // Fallback: schedule 24h from now
      scheduled.push({
        network: brief.network,
        scheduledAt: new Date(now.getTime() + 24 * 3600_000),
        brief,
        slotScore: 50,
      });
      continue;
    }

    // Find next occurrence of this day+hour
    const target = new Date(now);
    const daysUntil = (topSlot.dayOfWeek - now.getUTCDay() + 7) % 7 || 7;
    target.setUTCDate(target.getUTCDate() + daysUntil);
    target.setUTCHours(topSlot.hourUTC, 0, 0, 0);

    scheduled.push({
      network: brief.network,
      scheduledAt: target,
      brief,
      slotScore: topSlot.score,
    });
  }

  return scheduled;
}
