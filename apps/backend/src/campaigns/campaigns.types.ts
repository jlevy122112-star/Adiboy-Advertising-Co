export interface Campaign {
  id: string;
  brand_id: string;
  workspace_id: string;
  name: string;
  objective: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignChannel {
  id: string;
  campaign_id: string;
  channel: string;
}

export interface CampaignMetrics {
  id: string;
  campaign_id: string;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  spend: number;
  roas: number;
  updated_at: string;
}

export type CreateCampaignPayload = Pick<Campaign,
  'name' | 'objective' | 'status' | 'start_date' | 'end_date'
> & { channels?: string[]; brand_id?: string };

export type UpdateCampaignPayload = Partial<CreateCampaignPayload>;
