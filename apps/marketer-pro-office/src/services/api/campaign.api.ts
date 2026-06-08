import type { Campaign } from '@/types/campaign.types'
import { supabase } from './supabase.client'

export async function getCampaigns(workspaceId: string): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*, posts(*)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapRowToCampaign)
}

export async function getCampaign(id: string): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*, posts(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return mapRowToCampaign(data)
}

export async function createCampaign(data: Omit<Campaign, 'id' | 'posts' | 'createdAt' | 'updatedAt'>): Promise<Campaign> {
  const { data: row, error } = await supabase
    .from('campaigns')
    .insert(mapCampaignToRow(data))
    .select('*, posts(*)')
    .single()

  if (error) throw error
  return mapRowToCampaign(row)
}

export async function updateCampaign(
  id: string,
  data: Partial<Omit<Campaign, 'id' | 'posts' | 'createdAt' | 'updatedAt'>>,
): Promise<Campaign> {
  const { data: row, error } = await supabase
    .from('campaigns')
    .update({ ...mapCampaignToRow(data as Campaign), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, posts(*)')
    .single()

  if (error) throw error
  return mapRowToCampaign(row)
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from('campaigns').delete().eq('id', id)
  if (error) throw error
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToCampaign(row: Record<string, any>): Campaign {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description,
    status: row.status,
    platforms: row.platforms ?? [],
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    posts: (row.posts ?? []).map(mapRowToPost),
    analytics: row.analytics ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToPost(row: Record<string, any>) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    platform: row.platform,
    contentType: row.content_type,
    caption: row.caption,
    hashtags: row.hashtags ?? [],
    mediaUrls: row.media_urls ?? [],
    scheduledAt: row.scheduled_at ?? undefined,
    publishedAt: row.published_at ?? undefined,
    status: row.status,
    analytics: row.analytics ?? undefined,
  }
}

function mapCampaignToRow(campaign: Partial<Campaign>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (campaign.workspaceId !== undefined) row.workspace_id = campaign.workspaceId
  if (campaign.title !== undefined) row.title = campaign.title
  if (campaign.description !== undefined) row.description = campaign.description
  if (campaign.status !== undefined) row.status = campaign.status
  if (campaign.platforms !== undefined) row.platforms = campaign.platforms
  if (campaign.startDate !== undefined) row.start_date = campaign.startDate
  if (campaign.endDate !== undefined) row.end_date = campaign.endDate
  return row
}
