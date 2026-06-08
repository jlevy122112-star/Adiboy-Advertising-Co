import type { Post } from '@/types/campaign.types'
import type { PlatformId } from '@/types/platform.types'
import type {
  ISocialService,
  PublishResult,
  ScheduleResult,
  PlatformAnalytics,
} from '../social.interface'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

interface IgTokenResponse {
  access_token: string
  token_type: string
}

interface IgMeResponse {
  id: string
  name: string
}

interface IgContainerResponse {
  id: string
}

interface IgPublishResponse {
  id: string
}

interface IgInsightsValue {
  value: number
}

interface IgInsightsMetric {
  name: string
  values: IgInsightsValue[]
}

interface IgInsightsResponse {
  data: IgInsightsMetric[]
}

interface IgAccountResponse {
  followers_count: number
  id: string
  username: string
}

export class InstagramService implements ISocialService {
  private accessToken: string
  private igUserId: string | null = null

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${GRAPH_API}${path}`)
    url.searchParams.set('access_token', this.accessToken)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

    const res = await fetch(url.toString())
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Instagram GET ${path} failed ${res.status}: ${body}`)
    }
    return res.json() as Promise<T>
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = new URL(`${GRAPH_API}${path}`)
    url.searchParams.set('access_token', this.accessToken)

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Instagram POST ${path} failed ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  private async resolveUserId(): Promise<string> {
    if (this.igUserId) return this.igUserId
    const data = await this.get<IgMeResponse>('/me', { fields: 'id,name' })
    this.igUserId = data.id
    return data.id
  }

  async connect(oauthCode: string): Promise<void> {
    // Exchange short-lived code for long-lived token via your backend proxy.
    // Direct exchange requires app secret, which must not be in client code.
    const res = await fetch(`${GRAPH_API}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: oauthCode, grant_type: 'authorization_code' }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Instagram OAuth exchange failed ${res.status}: ${text}`)
    }
    const data = (await res.json()) as IgTokenResponse
    this.accessToken = data.access_token
    await this.resolveUserId()
  }

  async disconnect(): Promise<void> {
    const userId = await this.resolveUserId()
    await this.post(`/${userId}/permissions`, { method: 'DELETE' })
    this.accessToken = ''
    this.igUserId = null
  }

  private buildCaption(post: Post): string {
    const tags = post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
    return tags ? `${post.caption}\n\n${tags}` : post.caption
  }

  /** Single image or video post */
  private async publishSingleMedia(
    userId: string,
    post: Post,
  ): Promise<IgPublishResponse> {
    const [mediaUrl] = post.mediaUrls
    const isVideo = post.contentType === 'video' || post.contentType === 'reel'

    const containerBody: Record<string, unknown> = {
      caption: this.buildCaption(post),
    }

    if (isVideo) {
      containerBody['video_url'] = mediaUrl
      containerBody['media_type'] = post.contentType === 'reel' ? 'REELS' : 'VIDEO'
    } else if (post.contentType === 'story') {
      containerBody['image_url'] = mediaUrl
      containerBody['media_type'] = 'IMAGE'
      containerBody['is_stories_item'] = true
    } else {
      containerBody['image_url'] = mediaUrl
    }

    const container = await this.post<IgContainerResponse>(
      `/${userId}/media`,
      containerBody,
    )
    return this.post<IgPublishResponse>(`/${userId}/media_publish`, {
      creation_id: container.id,
    })
  }

  /** Carousel post (2–10 images/videos) */
  private async publishCarousel(
    userId: string,
    post: Post,
  ): Promise<IgPublishResponse> {
    const childIds: string[] = await Promise.all(
      post.mediaUrls.map(async (url) => {
        const child = await this.post<IgContainerResponse>(`/${userId}/media`, {
          image_url: url,
          is_carousel_item: true,
        })
        return child.id
      }),
    )

    const carousel = await this.post<IgContainerResponse>(`/${userId}/media`, {
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption: this.buildCaption(post),
    })

    return this.post<IgPublishResponse>(`/${userId}/media_publish`, {
      creation_id: carousel.id,
    })
  }

  async publishPost(post: Post): Promise<PublishResult> {
    const userId = await this.resolveUserId()
    let result: IgPublishResponse

    if (post.contentType === 'carousel') {
      result = await this.publishCarousel(userId, post)
    } else {
      result = await this.publishSingleMedia(userId, post)
    }

    const media = await this.get<{ permalink: string }>(
      `/${result.id}`,
      { fields: 'permalink' },
    )

    return { id: result.id, url: media.permalink }
  }

  async schedulePost(post: Post, scheduledAt: Date): Promise<ScheduleResult> {
    // Instagram Graph API does not support native scheduling via containers.
    // This creates the container and returns an id; a background job must
    // call /media_publish at scheduledAt.
    const userId = await this.resolveUserId()
    const [mediaUrl] = post.mediaUrls

    const container = await this.post<IgContainerResponse>(`/${userId}/media`, {
      image_url: mediaUrl,
      caption: this.buildCaption(post),
      // publish_time is supported on some Business accounts; include for forward-compat
      publish_time: Math.floor(scheduledAt.getTime() / 1000),
    })

    return { id: container.id }
  }

  async getAnalytics(since: Date, until: Date): Promise<PlatformAnalytics> {
    const userId = await this.resolveUserId()
    const sinceTs = Math.floor(since.getTime() / 1000).toString()
    const untilTs = Math.floor(until.getTime() / 1000).toString()

    const [insights, account] = await Promise.all([
      this.get<IgInsightsResponse>(`/${userId}/insights`, {
        metric: 'impressions,reach,profile_views',
        period: 'day',
        since: sinceTs,
        until: untilTs,
      }),
      this.get<IgAccountResponse>(`/${userId}`, {
        fields: 'followers_count,id,username',
      }),
    ])

    const sum = (name: string) =>
      insights.data
        .find((m) => m.name === name)
        ?.values.reduce((acc, v) => acc + v.value, 0) ?? 0

    return {
      platform: 'instagram' as PlatformId,
      since,
      until,
      impressions: sum('impressions'),
      reach: sum('reach'),
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      clicks: sum('profile_views'),
      followerCount: account.followers_count,
      followerGrowth: 0,
      engagementRate: 0,
      raw: insights,
    }
  }
}
