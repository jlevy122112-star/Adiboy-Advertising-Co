import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/db';
import { NotFoundError } from '../common/errors';
import { CreateContentPayload, UpdateContentPayload } from './content.types';

export const contentService = {
  // GET /campaigns/:id/content
  async getByCampaign(campaignId: string) {
    const { data } = await supabase
      .from('content_items')
      .select('*, content_variants(*)')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });
    return data || [];
  },

  // POST /campaigns/:id/content
  async create(campaignId: string, payload: CreateContentPayload) {
    const id = uuidv4();
    const { variants, ...rest } = payload;

    const { data, error } = await supabase
      .from('content_items')
      .insert({ id, campaign_id: campaignId, ...rest })
      .select('*')
      .single();

    if (error) throw new Error('Failed to create content item');

    if (variants?.length) {
      await supabase.from('content_variants').insert(
        variants.map((v) => ({ id: uuidv4(), content_id: id, ...v }))
      );
    }

    // Log status history
    await supabase.from('content_status_history').insert({
      id: uuidv4(),
      content_id: id,
      status: rest.status || 'draft',
      changed_at: new Date().toISOString(),
    });

    return data;
  },

  // GET /content/:id
  async getById(id: string) {
    const { data } = await supabase
      .from('content_items')
      .select('*, content_variants(*), content_status_history(*)')
      .eq('id', id)
      .single();

    if (!data) throw new NotFoundError('Content item');
    return data;
  },

  // PATCH /content/:id
  async update(id: string, payload: UpdateContentPayload) {
    const { data, error } = await supabase
      .from('content_items')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error('Failed to update content item');

    if (payload.status) {
      await supabase.from('content_status_history').insert({
        id: uuidv4(),
        content_id: id,
        status: payload.status,
        changed_at: new Date().toISOString(),
      });
    }

    return data;
  },

  // POST /content/:id/schedule
  async schedule(id: string, scheduledAt: string) {
    return this.update(id, { status: 'scheduled', scheduled_at: scheduledAt });
  },

  // POST /content/:id/publish (internal/job-triggered)
  async publish(id: string) {
    return this.update(id, { status: 'published' });
  },
};
