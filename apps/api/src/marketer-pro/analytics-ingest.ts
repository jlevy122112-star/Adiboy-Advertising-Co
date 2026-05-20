/**
 * Analytics ingestion service — fetches metrics from network APIs and saves snapshots.
 */

import type { AnalyticsNetwork } from "@home-link/marketer-pro-contract";
import type { AnalyticsProvider, AnalyticsProviderArgs } from "../analytics/analytics-provider.js";
import { stubAnalyticsProvider } from "../analytics/analytics-provider.js";
import { metaAnalyticsProvider } from "../analytics/meta-analytics.js";
import { xAnalyticsProvider } from "../analytics/x-analytics.js";
import { linkedinAnalyticsProvider } from "../analytics/linkedin-analytics.js";
import { youtubeAnalyticsProvider } from "../analytics/youtube-analytics.js";
import { tiktokAnalyticsProvider } from "../analytics/tiktok-analytics.js";
import { upsertAnalyticsSnapshot } from "../db/analytics-snapshot.js";
import { getScheduleEntry } from "../db/schedule-entry.js";

const PROVIDERS: Partial<Record<AnalyticsNetwork, AnalyticsProvider>> = {
  facebook: metaAnalyticsProvider,
  instagram: metaAnalyticsProvider,
  x: xAnalyticsProvider,
  linkedin: linkedinAnalyticsProvider,
  youtube: youtubeAnalyticsProvider,
  tiktok: tiktokAnalyticsProvider,
};

function resolveProvider(network: AnalyticsNetwork): AnalyticsProvider {
  return PROVIDERS[network] ?? stubAnalyticsProvider;
}

export type IngestResult =
  | { ok: true; snapshotId: string }
  | { ok: false; error: string };

export async function ingestAnalyticsForEntry(
  tenantId: string,
  scheduleEntryId: string,
  accessToken?: string,
): Promise<IngestResult> {
  const entry = await getScheduleEntry(tenantId, scheduleEntryId);
  if (!entry) return { ok: false, error: "schedule_entry_not_found" };

  const network = (entry.network ?? "generic") as AnalyticsNetwork;
  const externalPostId = entry.external_id ?? "";

  if (!externalPostId) return { ok: false, error: "no_external_post_id" };

  const provider = resolveProvider(network);
  const args: AnalyticsProviderArgs = { tenantId, scheduleEntryId, externalPostId, network, accessToken };
  const result = await provider(args);

  if (!result.ok) return { ok: false, error: result.error };

  const snapshot = await upsertAnalyticsSnapshot({
    tenantId,
    scheduleEntryId,
    network,
    period: "lifetime",
    externalPostId,
    externalPostStatus: result.metrics.externalPostStatus,
    ...result.metrics,
  });

  if (!snapshot) return { ok: false, error: "db_write_failed" };
  return { ok: true, snapshotId: snapshot.id };
}
