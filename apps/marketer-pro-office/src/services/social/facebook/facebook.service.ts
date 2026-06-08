import type { Post } from '@/types/campaign.types'
import type { PlatformId } from '@/types/platform.types'
import type {
  ISocialService,
  PublishResult,
  ScheduleResult,
  PlatformAnalytics,
} from '../social.interface'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

interface FbTokenResponse {
  access_token: string
  token_type: string
}

interface FbMeResponse {
  id: string
  name: string
}

interface FbPagesResponse {
  data: Array<{
    id: string
    name: string
    access_token: string
  }>
}

interface FbPhotoResponse {
  id: string
  post_id?: string
}

interface FbPostResponse {
  id: string
}

interface FbVideoResponse {
  id: string
}

interface FbInsightsValue {
  value: number
  end_time: string
}

interface FbInsightsMetric {
  name: string
  values: FbInsightsValue[]
}

interface FbInsightsResponse {
  data: FbInsightsMetric[]
}

interface FbPageFanCountResponse {
  fan_count: number
  id: string
}

export class FacebookService implements ISocialService {
  private accessToken: string
  private pageId: string | null = null
  private pageAccessToken: string | null = null

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async get<T>(
    path: string,
    token: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const url = new URL(`${GRAPH_API}${path}`)
    url.searchParams.set('access_token', token)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

    const res = await fetch(url.toString())
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Facebook GET ${path} failed ${res.status}: ${body}`)
    }
    return res.json() as Promise<T>
  }

  private async post<T>(
    path: string,
    token: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const url = new URL(`${GRAPH_API}${path}`)
    url.searchParams.set('access_token', token)

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Facebook POST ${path} failed ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  /** Resolve the first managed Page and cache its page-scoped access token */
  private async resolvePage(): Promise<{ pageId: string; pageToken: string }> {
    if (this.pageId && this.pageAccessToken) {
      return { pageId: this.pageId, pageToken: this.pageAccessToken }
    }

    const me = await this.get<FbMeResponse>('/me', this.accessToken, { fields: 'id,name' })
    const pages = await this.get<FbPagesResponse>(
      `/${me.id}/accounts`,
      this.accessToken,
      { fields: 'id,name,access_token' },
    )

    if (!pages.data.length) {
      throw new Error('No Facebook Pages found for this user')
    }

    this.pageId = pages.data[0].id
    this.pageAccessToken = pages.data[0].access_token
    return { pageId: this.pageId, pageToken: this.pageAccessToken }
  }

  async connect(oauthCode: string): Promise<void> {
    const res = await fetch(`${GRAPH_API}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: oauthCode, grant_type: 'authorization_code' }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Facebook OAuth exchange failed ${res.status}: ${text}`)
    }
    const data = (await res.json()) as FbTokenResponse
    this.accessToken = data.access_token
    await this.resolvePage()
  }

  async disconnect(): Promise<void> {
    const me = await this.get<FbMeResponse>('/me', this.accessToken, { fields: 'id' })
    await this.post(`/${me.id}/permissions`, this.accessToken, {})
    this.accessToken = ''
    this.pageId = null
    this.pageAccessToken = null
  }

  private buildMessage(post: Post): string {
    const tags = post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
    return tags ? `${post.caption}\n\n${tags}` : post.caption
  }

  /** Upload a single photo and return its attachment id for multi-photo posts */
  private async uploadPhotoUnpublished(
    pageId: string,
    pageToken: string,
    photoUrl: string,
  ): Promise<string> {
    const result = await this.post<FbPhotoResponse>(`/${pageId}/photos`, pageToken, {
      url: photoUrl,
      published: false,
    })
    return result.id
  }

  private async publishImagePost(
    pageId: string,
    pageToken: string,
    post: Post,
  ): Promise<PublishResult> {
    const [photoUrl] = post.mediaUrls
    const result = await this.post<FbPhotoResponse>(`/${pageId}/photos`, pageToken, {
      url: photoUrl,
      message: this.buildMessage(post),
    })
    const postId = result.post_id ?? result.id
    return { id: postId, url: `https://www.facebook.com/${postId}` }
  }

  private async publishCarouselPost(
    pageId: string,
    pageToken: string,
    post: Post,
  ): Promise<PublishResult> {
    const photoIds = await Promise.all(
      post.mediaUrls.map((url) => this.uploadPhotoUnpublished(pageId, pageToken, url)),
    )

    const result = await this.post<FbPostResponse>(`/${pageId}/feed`, pageToken, {
      message: this.buildMessage(post),
      attached_media: photoIds.map((id) => ({ media_fbid: id })),
    })

    return { id: result.id, url: `https://www.facebook.com/${result.id}` }
  }

  private async publishVideoPost(
    pageId: string,
    pageToken: string,
    post: Post,
    isReel = false,
  ): Promise<PublishResult> {
    const [videoUrl] = post.mediaUrls
    const endpoint = isReel ? `/${pageId}/reels` : `/${pageId}/videos`
    const result = await this.post<FbVideoResponse>(endpoint, pageToken, {
      file_url: videoUrl,
      description: this.buildMessage(post),
      published: true,
    })
    return { id: result.id, url: `https://www.facebook.com/${result.id}` }
  }

  private async publishStory(
    pageId: string,
    pageToken: string,
    post: Post,
  ): Promise<PublishResult> {
    const [mediaUrl] = post.mediaUrls
    const result = await this.post<FbPostResponse>(`/${pageId}/photo_stories`, pageToken, {
      url: mediaUrl,
    })
    return { id: result.id, url: `https://www.facebook.com/${result.id}` }
  }

  async publishPost(post: Post): Promise<PublishResult> {
    const { pageId, pageToken } = await this.resolvePage()

    switch (post.contentType) {
      case 'carousel':
        return this.publishCarouselPost(pageId, pageToken, post)
      case 'video':
        return this.publishVideoPost(pageId, pageToken, post, false)
      case 'reel':
        return this.publishVideoPost(pageId, pageToken, post, true)
      case 'story':
        return this.publishStory(pageId, pageToken, post)
      case 'image':
        return this.publishImagePost(pageId, pageToken, post)
      default: {
        // text post
        const result = await this.post<FbPostResponse>(`/${pageId}/feed`, pageToken, {
          message: this.buildMessage(post),
        })
        return { id: result.id, url: `https://www.facebook.com/${result.id}` }
      }
    }
  }

  async schedulePost(post: Post, scheduledAt: Date): Promise<ScheduleResult> {
    const { pageId, pageToken } = await this.resolvePage()
    const publishTime = Math.floor(scheduledAt.getTime() / 1000)

    const result = await this.post<FbPostResponse>(`/${pageId}/feed`, pageToken, {
      message: this.buildMessage(post),
      published: false,
      scheduled_publish_time: publishTime,
    })

    return { id: result.id }
  }

  async getAnalytics(since: Date, until: Date): Promise<PlatformAnalytics> {
    const { pageId, pageToken } = await this.resolvePage()
    const sinceTs = Math.floor(since.getTime() / 1000).toString()
    const untilTs = Math.floor(until.getTime() / 1000).toString()

    const [insights, fanCount] = await Promise.all([
      this.get<FbInsightsResponse>(`/${pageId}/insights`, pageToken, {
        metric: 'page_impressions,page_post_engagements,page_views_total',
        period: 'day',
        since: sinceTs,
        until: untilTs,
      }),
      this.get<FbPageFanCountResponse>(`/${pageId}`, pageToken, {
        fields: 'fan_count',
      }),
    ])

    const sum = (name: string) =>
      insights.data
        .find((m) => m.name === name)
        ?.values.reduce((acc, v) => acc + v.value, 0) ?? 0

    const impressions = sum('page_impressions')
    const engagements = sum('page_post_engagements')
    const clicks = sum('page_views_total')
    const engagementRate = impressions > 0 ? engagements / impressions : 0

    return {
      platform: 'facebook' as PlatformId,
      since,
      until,
      impressions,
      reach: impressions,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      clicks,
      followerCount: fanCount.fan_count,
      followerGrowth: 0,
      engagementRate,
      raw: insights,
    }
  }
}
