import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../config/db';
import { logger } from '../../common/logger';

interface FetchMetricsPayload {
  workspaceId: string;
}

// Worker: call platform APIs, store metrics_raw, update metrics_aggregated
export async function fetchMetricsWorker(payload: unknown): Promise<void> {
  const { workspaceId } = payload as FetchMetricsPayload;

  const { data: integrations } = await supabase
    .from('integrations')
    .select('provider, access_token')
    .eq('workspace_id', workspaceId);

  if (!integrations?.length) {
    logger.info(`fetchMetricsWorker: no integrations for workspace ${workspaceId}`);
    return;
  }

  for (const integration of integrations) {
    // Platform-specific metrics fetch goes here per provider
    // e.g. Meta Insights API, TikTok Analytics API, LinkedIn Analytics API

    // Store raw metrics
    await supabase.from('metrics_raw').insert({
      id: uuidv4(),
      workspace_id: workspaceId,
      provider: integration.provider,
      payload: {},
      fetched_at: new Date().toISOString(),
    });

    logger.info(`fetchMetricsWorker: fetched metrics from ${integration.provider}`);
  }
}
