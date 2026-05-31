import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../config/db';
import { env } from '../../config/env';

export const tiktokService = {
  getOAuthUrl(workspaceId: string): string {
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64');
    const params = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY || '',
      redirect_uri: `${env.FRONTEND_URL}/api/integrations/tiktok/callback`,
      scope: 'user.info.basic,video.list,video.upload',
      response_type: 'code',
      state,
    });
    return `https://www.tiktok.com/auth/authorize/?${params.toString()}`;
  },

  async storeTokens(workspaceId: string, accessToken: string, refreshToken?: string) {
    await supabase.from('integrations').upsert({
      id: uuidv4(),
      workspace_id: workspaceId,
      provider: 'tiktok',
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
      .eq('provider', 'tiktok')
      .single();
    return { connected: !!data, ...(data || {}) };
  },
};
