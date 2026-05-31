import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../config/db';
import { env } from '../../config/env';

export const linkedinService = {
  getOAuthUrl(workspaceId: string): string {
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.LINKEDIN_CLIENT_ID || '',
      redirect_uri: `${env.FRONTEND_URL}/api/integrations/linkedin/callback`,
      scope: 'r_liteprofile w_member_social r_organization_social w_organization_social',
      state,
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  },

  async storeTokens(workspaceId: string, accessToken: string, refreshToken?: string) {
    await supabase.from('integrations').upsert({
      id: uuidv4(),
      workspace_id: workspaceId,
      provider: 'linkedin',
      access_token: accessToken,
      refresh_token: refreshToken || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,provider' });
  },

  async getStatus(workspaceId: string) {
    const { data } = await supabase
      .from('integrations')
      .select('provider, expires_at, updated_at')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'linkedin')
      .single();
    return { connected: !!data, ...(data || {}) };
  },
};
