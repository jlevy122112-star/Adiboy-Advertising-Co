export type CampaignStatus = 'draft' | 'active' | 'scheduled' | 'published' | 'archived'
export type ContentType = 'image' | 'video' | 'carousel' | 'reel' | 'story' | 'text'

export interface Campaign {
  id: string
  workspaceId: string
  title: string
  description: string
  status: CampaignStatus
  platforms: string[]
  startDate: string
  endDate?: string
  posts: Post[]
  analytics?: CampaignAnalytics
  createdAt: string
  updatedAt: string
}

export interface Post {
  id: string
  campaignId: string
  platform: string
  contentType: ContentType
  caption: string
  hashtags: string[]
  mediaUrls: string[]
  scheduledAt?: string
  publishedAt?: string
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  analytics?: PostAnalytics
}

export interface CampaignAnalytics {
  totalReach: number
  totalImpressions: number
  totalEngagements: number
  engagementRate: number
  clicks: number
}

export interface PostAnalytics {
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
}

export interface CampaignState {
  campaigns: Campaign[]
  activeCampaign: Campaign | null
  loading: boolean
  error: string | null
}
