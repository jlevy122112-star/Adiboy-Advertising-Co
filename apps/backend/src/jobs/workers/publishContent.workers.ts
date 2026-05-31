import { supabase } from '../../config/db';
import { logger } from '../../common/logger';

interface PublishPayload {
  contentId: string;
}

// Worker: fetch content, integration tokens, call platform API, update status
export async function publishContentWorker(payload: unknown): Promise<void> {
  const { contentId } = payload as PublishPayload;

  const { data: content } = await supabase
    .from('content_items')
    .select('*, content_variants(*), campaigns(workspace_id)')
    .eq('id', contentId)
    .single();

  if (!content) {
    logger.warn(`publishContentWorker: content not found: ${contentId}`);
    return;
  }

  const workspaceId = content.campaigns?.workspace_id;
  const { data: integration } = await supabase
    .from('integrations')
    .select('access_token')
    .eq('workspace_id', workspaceId)
    .eq('provider', content.channel)
    .single();

  if (!integration) {
    logger.warn(`publishContentWorker: no integration for channel: ${content.channel}`);
    return;
  }

  // Platform API call goes here per channel
  // e.g. Meta Graph API, TikTok Content Posting API, LinkedIn Share API

  // Mark published
  await supabase
    .from('content_items')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('id', contentId);

  logger.info(`publishContentWorker: published content ${contentId} to ${content.channel}`);
}
