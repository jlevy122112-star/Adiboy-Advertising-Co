import type { AnalyticsSnapshot } from '@/types/analytics.types'
import { supabase } from '@/services/api/supabase.client'

export interface DateRange {
  start: string
  end: string
}

export async function getAnalytics(
  workspaceId: string,
  platforms: string[],
  dateRange: DateRange,
): Promise<AnalyticsSnapshot[]> {
  let query = supabase
    .from('analytics_snapshots')
    .select('*')
    .eq('workspace_id', workspaceId)
    .gte('date', dateRange.start)
    .lte('date', dateRange.end)
    .order('date', { ascending: true })

  if (platforms.length > 0) {
    query = query.in('platform', platforms)
  }

  const { data, error } = await query

  if (error) throw error

  return (data ?? []).map(mapRowToSnapshot)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToSnapshot(row: Record<string, any>): AnalyticsSnapshot {
  return {
    platform: row.platform,
    date: row.date,
    followers: row.followers ?? 0,
    followersGrowth: row.followers_growth ?? 0,
    reach: row.reach ?? 0,
    impressions: row.impressions ?? 0,
    engagements: row.engagements ?? 0,
    engagementRate: row.engagement_rate ?? 0,
    clicks: row.clicks ?? 0,
    topPost: row.top_post ?? undefined,
  }
}
