import { supabase } from '../config/db';

export const analyticsService = {
  // GET /analytics/overview
  async getOverview(workspaceId: string) {
    const { data } = await supabase
      .from('metrics_aggregated')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('date', { ascending: false })
      .limit(30);
    return data || [];
  },

  // GET /analytics/campaigns
  async getCampaigns(workspaceId: string) {
    const { data } = await supabase
      .from('metrics_aggregated')
      .select('*')
      .eq('workspace_id', workspaceId)
      .not('campaign_id', 'is', null)
      .order('date', { ascending: false });
    return data || [];
  },

  // GET /analytics/content
  async getContent(workspaceId: string) {
    const { data } = await supabase
      .from('metrics_aggregated')
      .select('*')
      .eq('workspace_id', workspaceId)
      .not('content_id', 'is', null)
      .order('date', { ascending: false });
    return data || [];
  },

  // GET /analytics/campaigns/:id
  async getCampaignById(campaignId: string, workspaceId: string) {
    const { data } = await supabase
      .from('metrics_aggregated')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('campaign_id', campaignId)
      .order('date', { ascending: false });
    return data || [];
  },

  // GET /analytics/insights — AI-style summaries (placeholder)
  async getInsights(workspaceId: string) {
    // Populated by ai-analytics Edge Function
    const { data } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10);
    return data || [];
  },
};
