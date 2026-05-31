import { supabase } from '../config/db';

export const calendarService = {
  // GET /calendar?start=&end=&channels=&campaignId=
  async getEvents(workspaceId: string, params: {
    start?: string;
    end?: string;
    channels?: string;
    campaignId?: string;
  }) {
    let query = supabase
      .from('content_items')
      .select(`
        id, campaign_id, channel, type, title, status, scheduled_at,
        campaigns!inner(workspace_id)
      `)
      .eq('campaigns.workspace_id', workspaceId)
      .not('scheduled_at', 'is', null)
      .order('scheduled_at', { ascending: true });

    if (params.start) query = query.gte('scheduled_at', params.start);
    if (params.end) query = query.lte('scheduled_at', params.end);
    if (params.campaignId) query = query.eq('campaign_id', params.campaignId);
    if (params.channels) {
      const channelList = params.channels.split(',');
      query = query.in('channel', channelList);
    }

    const { data } = await query;
    return data || [];
  },

  // GET /calendar/day
  async getDayView(workspaceId: string, date: string) {
    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;
    return this.getEvents(workspaceId, { start, end });
  },

  // POST /calendar/drag — { contentId, newDateTime }
  async drag(contentId: string, newDateTime: string) {
    const { data, error } = await supabase
      .from('content_items')
      .update({
        scheduled_at: newDateTime,
        status: 'scheduled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId)
      .select('*')
      .single();

    if (error) throw new Error('Failed to reschedule content item');
    return data;
  },
};
