import type { Post } from '@/types/campaign.types'
import type { PlatformId } from '@/types/platform.types'

export interface PublishResult {
  id: string
  url: string
}

export interface ScheduleResult {
  id: string
}

export interface PlatformAnalytics {
  platform: PlatformId
  since: Date
  until: Date
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  followerCount: number
  followerGrowth: number
  engagementRate: number
  raw: unknown
}

export interface ISocialService {
  connect(oauthCode: string): Promise<void>
  disconnect(): Promise<void>
  publishPost(post: Post): Promise<PublishResult>
  schedulePost(post: Post, scheduledAt: Date): Promise<ScheduleResult>
  getAnalytics(since: Date, until: Date): Promise<PlatformAnalytics>
}
