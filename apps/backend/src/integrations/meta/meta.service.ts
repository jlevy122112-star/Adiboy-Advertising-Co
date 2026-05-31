import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../config/db';
import { env } from '../../config/env';

export const metaService = {
  // POST /integrations/meta/connect — returns OAuth URL
  getOAuthUrl(workspaceId: string): string {
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64');
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID || '',
      redirect_uri: `${env.FRONTEND_URL}/api/integrations/meta/callback`,
      scope: 'pages_manage_posts,instagram_basic,instagram_content_publish,read_insights',
      response_type: 'code',
      state,
    });
    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
  },

  // Store access token after OAuth callback
  async storeTokens(workspaceId: string, accessToken: string, refreshToken?: string) {
    await supabase.from('integrations').upsert({
      id: uuidv4(),
      workspace_id: workspaceId,
      provider: 'meta',
      access_token: accessToken,
      refresh_token: refreshToken || null,
      expires_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,provider' });
  },

  // GET /integrations/meta/status
  async getStatus(workspaceId: string) {
    const { data } = await supabase
      .from('integrations')
      .select('provider, expires_at, updated_at')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'meta')
      .single();
    return { connected: !!data, ...(data || {}) };
  },

  // POST /integrations/meta/webhook — handle incoming updates
  async handleWebhook(body: unknown) {
    // Validate webhook signature and process updates
    // Store raw metrics into metrics_raw table
    return { received: true };
  },
};
