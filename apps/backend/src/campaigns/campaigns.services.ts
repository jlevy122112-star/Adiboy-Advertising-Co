import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/db';
import { NotFoundError, ForbiddenError } from '../common/errors';
import { CreateCampaignPayload, UpdateCampaignPayload } from './campaigns.types';

export const campaignsService = {
  // GET /campaigns
  async getAll(workspaceId: string, filters: {
    status?: string;
    channel?: string;
    objective?: string;
  }) {
    let query = supabase
      .from('campaigns')
      .select(`
        *,
        campaign_channels(channel),
        campaign_metrics(impressions, reach, clicks, conversions, spend, roas)
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.objective) query = query.eq('objective', filters.objective);

    const { data } = await query;
    return data || [];
  },

  // GET /campaigns/:id
  async getById(id: string, workspaceId: string) {
    const { data } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_channels(channel),
        campaign_metrics(*)
      `)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single();

    if (!data) throw new NotFoundError('Campaign');
    return data;
  },

  // POST /campaigns
  async create(workspaceId: string, payload: CreateCampaignPayload) {
    const id = uuidv4();
    const { channels, ...rest } = payload;

    const { data, error } = await supabase
      .from('campaigns')
      .insert({ id, workspace_id: workspaceId, ...rest })
      .select('*')
      .single();

    if (error) throw new Error('Failed to create campaign');

    if (channels?.length) {
      await supabase.from('campaign_channels').insert(
        channels.map((channel) => ({ id: uuidv4(), campaign_id: id, channel }))
      );
    }

    return data;
  },

  // PATCH /campaigns/:id
  async update(id: string, workspaceId: string, payload: UpdateCampaignPayload) {
    const existing = await this.getById(id, workspaceId);
    if (!existing) throw new NotFoundError('Campaign');

    const { channels, ...rest } = payload;

    const { data, error } = await supabase
      .from('campaigns')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error('Failed to update campaign');

    if (channels) {
      await supabase.from('campaign_channels').delete().eq('campaign_id', id);
      if (channels.length) {
        await supabase.from('campaign_channels').insert(
          channels.map((channel) => ({ id: uuidv4(), campaign_id: id, channel }))
        );
      }
    }

    return data;
  },

  // DELETE /campaigns/:id
  async delete(id: string, workspaceId: string) {
    const { data } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single();

    if (!data) throw new NotFoundError('Campaign');

    await supabase.from('campaigns').delete().eq('id', id);
  },
};
