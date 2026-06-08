export interface AnalyticsSnapshot {
  platform: string
  date: string
  followers: number
  followersGrowth: number
  reach: number
  impressions: number
  engagements: number
  engagementRate: number
  clicks: number
  topPost?: string
}

export interface AnalyticsDashboardState {
  snapshots: AnalyticsSnapshot[]
  dateRange: { start: string; end: string }
  selectedPlatforms: string[]
  loading: boolean
  error: string | null
}
