import type { BestTimeSlot, ConfidenceLevel } from "@home-link/marketer-pro-contract";
import { getStaticSlots, CONTENT_TYPE_MULTIPLIERS } from "./best-time-rules.js";
import {
  getHistoricalEngagementWindows,
  normalizeEngagementScores,
} from "./engagement-window.js";

export interface PredictOptions {
  tenantId: string;
  network: string;
  contentType?: string;
  audienceTimezone?: string; // IANA timezone e.g. "America/New_York"
}

/** Convert IANA timezone to approximate UTC offset in hours. Simple lookup. */
function tzOffsetHours(tz?: string): number {
  if (!tz) return 0;
  const MAP: Record<string, number> = {
    "America/New_York": -5,     "America/Chicago": -6,
    "America/Denver": -7,       "America/Los_Angeles": -8,
    "America/Anchorage": -9,    "Pacific/Honolulu": -10,
    "Europe/London": 0,         "Europe/Paris": 1,
    "Europe/Berlin": 1,         "Europe/Moscow": 3,
    "Asia/Dubai": 4,            "Asia/Kolkata": 5.5,
    "Asia/Bangkok": 7,          "Asia/Singapore": 8,
    "Asia/Tokyo": 9,            "Australia/Sydney": 11,
    "Pacific/Auckland": 13,
  };
  return MAP[tz] ?? 0;
}

/** Shift UTC hour by timezone offset to get peak in audience local time, then back to UTC. */
function adjustForTimezone(hourUTC: number, tzOffset: number): number {
  // audience is mostly in tzOffset — peak hours stay near 9am–9pm local
  const localHour = (hourUTC + tzOffset + 24) % 24;
  const isGoodLocalHour = localHour >= 7 && localHour <= 22;
  return isGoodLocalHour ? 1.0 : 0.6;
}

function confidence(sampleCount: number, hasHistorical: boolean): ConfidenceLevel {
  if (hasHistorical && sampleCount >= 10) return "high";
  if (hasHistorical && sampleCount >= 3)  return "medium";
  return "low";
}

export async function predictBestTimes(opts: PredictOptions): Promise<BestTimeSlot[]> {
  const staticSlots   = getStaticSlots(opts.network);
  const historical    = await getHistoricalEngagementWindows(opts.tenantId, opts.network);
  const histScores    = normalizeEngagementScores(historical);
  const hasHistorical = histScores.size > 0;
  const tzOffset      = tzOffsetHours(opts.audienceTimezone);
  const contentMult   = opts.contentType
    ? (CONTENT_TYPE_MULTIPLIERS[opts.contentType]?.[opts.network.toLowerCase()] ?? 1.0)
    : 1.0;

  // Build a combined score map across all slots
  const slotMap = new Map<string, BestTimeSlot>();

  for (const slot of staticSlots) {
    const key       = `${slot.dayOfWeek}:${slot.hourUTC}`;
    const histScore = histScores.get(key) ?? 0;
    const tzMult    = adjustForTimezone(slot.hourUTC, tzOffset);

    // Weighted: 60% static rules, 40% historical (if available)
    const baseWeight   = hasHistorical ? 0.6 : 1.0;
    const histWeight   = hasHistorical ? 0.4 : 0.0;
    const rawScore     = (slot.baseScore * baseWeight) + (histScore * histWeight);
    const finalScore   = Math.min(100, Math.round(rawScore * contentMult * tzMult));

    const histWindow   = historical.find(h => h.dayOfWeek === slot.dayOfWeek && h.hourUTC === slot.hourUTC);
    const sampleCount  = histWindow?.sampleCount ?? 0;

    const reasons = [slot.reason];
    if (hasHistorical && histScore > 60) reasons.push(`Historical data: ${histScore}/100 engagement score`);
    if (contentMult > 1.0) reasons.push(`${opts.contentType} content performs well on ${opts.network}`);
    if (opts.audienceTimezone && tzMult >= 1.0) reasons.push(`Optimal for ${opts.audienceTimezone} audience`);

    slotMap.set(key, {
      dayOfWeek:       slot.dayOfWeek,
      hourUTC:         slot.hourUTC,
      score:           finalScore,
      engagementScore: hasHistorical ? histScore : slot.baseScore,
      reachScore:      slot.baseScore,
      confidence:      confidence(sampleCount, hasHistorical),
      reasons,
    });
  }

  // Also include any historically strong slots not in static rules
  for (const [key, histScore] of histScores) {
    if (slotMap.has(key) || histScore < 70) continue;
    const [dow, hour] = key.split(":").map(Number);
    const tzMult = adjustForTimezone(hour!, tzOffset);
    slotMap.set(key, {
      dayOfWeek:       dow!,
      hourUTC:         hour!,
      score:           Math.min(100, Math.round(histScore * contentMult * tzMult)),
      engagementScore: histScore,
      reachScore:      histScore,
      confidence:      "high",
      reasons:         [`Strong historical engagement at this time on ${opts.network}`],
    });
  }

  return Array.from(slotMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
