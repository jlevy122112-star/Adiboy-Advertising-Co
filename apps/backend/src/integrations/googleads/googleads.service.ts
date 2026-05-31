import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../config/db';
import { env } from '../../config/env';

export const googleAdsService = {
  getOAuthUrl(workspaceId: string): string {
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64');
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      redirect_uri: `${env.FRONTEND_URL}/api/integrations/googleads/callback`,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/adwords',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },

  async storeTokens(workspaceId: string, accessToken: string, refreshToken?: string) {
    await supabase.from('integrations').upsert({
      id: uuidv4(),
      workspace_id: workspaceId,
      provider: 'googleads',
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
      .eq('provider', 'googleads')
      .single();
    return { connected: !!data, ...(data || {}) };
  },
};
