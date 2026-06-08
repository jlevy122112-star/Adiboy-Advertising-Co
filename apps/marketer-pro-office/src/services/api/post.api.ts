import type { Post } from '@/types/campaign.types'
import { supabase } from './supabase.client'

export async function getPostsByCampaign(campaignId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapRowToPost)
}

export async function createPost(data: Omit<Post, 'id' | 'publishedAt' | 'analytics'>): Promise<Post> {
  const { data: row, error } = await supabase
    .from('posts')
    .insert(mapPostToRow(data))
    .select()
    .single()

  if (error) throw error
  return mapRowToPost(row)
}

export async function updatePost(id: string, data: Partial<Omit<Post, 'id'>>): Promise<Post> {
  const { data: row, error } = await supabase
    .from('posts')
    .update(mapPostToRow(data as Post))
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return mapRowToPost(row)
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) throw error
}

export async function schedulePost(id: string, scheduledAt: string): Promise<Post> {
  const { data: row, error } = await supabase
    .from('posts')
    .update({ scheduled_at: scheduledAt, status: 'scheduled' })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return mapRowToPost(row)
}

export async function publishPost(id: string): Promise<Post> {
  const { data: row, error } = await supabase
    .from('posts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return mapRowToPost(row)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToPost(row: Record<string, any>): Post {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    platform: row.platform,
    contentType: row.content_type,
    caption: row.caption ?? '',
    hashtags: row.hashtags ?? [],
    mediaUrls: row.media_urls ?? [],
    scheduledAt: row.scheduled_at ?? undefined,
    publishedAt: row.published_at ?? undefined,
    status: row.status,
    analytics: row.analytics ?? undefined,
  }
}

function mapPostToRow(post: Partial<Post>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (post.campaignId !== undefined) row.campaign_id = post.campaignId
  if (post.platform !== undefined) row.platform = post.platform
  if (post.contentType !== undefined) row.content_type = post.contentType
  if (post.caption !== undefined) row.caption = post.caption
  if (post.hashtags !== undefined) row.hashtags = post.hashtags
  if (post.mediaUrls !== undefined) row.media_urls = post.mediaUrls
  if (post.scheduledAt !== undefined) row.scheduled_at = post.scheduledAt
  if (post.status !== undefined) row.status = post.status
  return row
}
