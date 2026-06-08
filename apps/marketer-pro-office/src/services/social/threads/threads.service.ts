import type { Post } from '@/types/campaign.types'
import type { PlatformId } from '@/types/platform.types'
import type {
  ISocialService,
  PublishResult,
  ScheduleResult,
  PlatformAnalytics,
} from '../social.interface'

// Threads API uses the same Graph infrastructure as Meta but its own versioned base.
const API_BASE = 'https://graph.threads.net/v1.0'

interface ThreadsTokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
}

interface ThreadsMeResponse {
  id: string
  username: string
  name: string
}

interface ThreadsContainerResponse {
  id: string
}

interface ThreadsPublishResponse {
  id: string
}

interface ThreadsInsightsResponse {
  data: Array<{
    name: string
    period: string
    values: Array<{ value: number; end_time: string }>
    title: string
  }>
}

interface ThreadsProfileResponse {
  id: string
  username: string
  threads_profile_picture_url?: string
  threads_biography?: string
}

export class ThreadsService implements ISocialService {
  private accessToken: string
  private userId: string | null = null

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${API_BASE}${path}`)
    url.searchParams.set('access_token', this.accessToken)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

    const res = await fetch(url.toString())
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Threads GET ${path} ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = new URL(`${API_BASE}${path}`)
    url.searchParams.set('access_token', this.accessToken)

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Threads POST ${path} ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  private async resolveUserId(): Promise<string> {
    if (this.userId) return this.userId
    const me = await this.get<ThreadsMeResponse>('/me', { fields: 'id,username,name' })
    this.userId = me.id
    return me.id
  }

  async connect(oauthCode: string): Promise<void> {
    // Short-lived → long-lived exchange. App secret must not be in client code; proxy via backend.
    const res = await fetch(`${API_BASE}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: oauthCode,
        grant_type: 'authorization_code',
        redirect_uri: window.location.origin + '/oauth/threads/callback',
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Threads OAuth exchange failed ${res.status}: ${text}`)
    }
    const data = (await res.json()) as ThreadsTokenResponse
    this.accessToken = data.access_token
    await this.resolveUserId()
  }

  async disconnect(): Promise<void> {
    this.accessToken = ''
    this.userId = null
  }

  private buildText(post: Post): string {
    const tags = post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
    // Threads character limit: 500
    const full = tags ? `${post.caption}\n\n${tags}` : post.caption
    return full.length <= 500 ? full : full.slice(0, 497) + '...'
  }

  /**
   * Create a media container. Returns the container id to pass to publish.
   * Threads supports TEXT, IMAGE, VIDEO, and CAROUSEL_ALBUM types.
   */
  private async createContainer(
    userId: string,
    post: Post,
    isCarouselItem = false,
  ): Promise<string> {
    const body: Record<string, unknown> = {}

    if (post.contentType === 'text' || post.mediaUrls.length === 0) {
      body['media_type'] = 'TEXT'
      body['text'] = this.buildText(post)
    } else if (post.contentType === 'video' || post.contentType === 'reel') {
      body['media_type'] = 'VIDEO'
      body['video_url'] = post.mediaUrls[0]
      if (!isCarouselItem) body['text'] = this.buildText(post)
      body['is_carousel_item'] = isCarouselItem
    } else {
      body['media_type'] = 'IMAGE'
      body['image_url'] = post.mediaUrls[0]
      if (!isCarouselItem) body['text'] = this.buildText(post)
      body['is_carousel_item'] = isCarouselItem
    }

    const container = await this.post<ThreadsContainerResponse>(
      `/${userId}/threads`,
      body,
    )
    return container.id
  }

  /** Poll container status until it finishes processing (for video containers) */
  private async pollContainerStatus(containerId: string, maxAttempts = 15): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, 3000))
      const status = await this.get<{ status: string; id: string }>(
        `/${containerId}`,
        { fields: 'status,id' },
      )
      if (status.status === 'FINISHED') return
      if (status.status === 'ERROR' || status.status === 'EXPIRED') {
        throw new Error(`Threads container ${containerId} status: ${status.status}`)
      }
    }
    throw new Error('Threads container status polling timed out')
  }

  private async publishContainer(
    userId: string,
    containerId: string,
  ): Promise<ThreadsPublishResponse> {
    return this.post<ThreadsPublishResponse>(`/${userId}/threads_publish`, {
      creation_id: containerId,
    })
  }

  async publishPost(post: Post): Promise<PublishResult> {
    const userId = await this.resolveUserId()

    if (post.contentType === 'carousel' && post.mediaUrls.length > 1) {
      // Create individual item containers first
      const itemContainerIds = await Promise.all(
        post.mediaUrls.map(async (url) => {
          const itemPost: Post = { ...post, mediaUrls: [url] }
          return this.createContainer(userId, itemPost, true)
        }),
      )

      // Create the carousel album container
      const carouselContainer = await this.post<ThreadsContainerResponse>(
        `/${userId}/threads`,
        {
          media_type: 'CAROUSEL',
          children: itemContainerIds.join(','),
          text: this.buildText(post),
        },
      )

      await this.pollContainerStatus(carouselContainer.id)
      const result = await this.publishContainer(userId, carouselContainer.id)
      return {
        id: result.id,
        url: `https://www.threads.net/@me/post/${result.id}`,
      }
    }

    const containerId = await this.createContainer(userId, post)

    // Video containers need to finish processing before publishing
    if (post.contentType === 'video' || post.contentType === 'reel') {
      await this.pollContainerStatus(containerId)
    }

    const result = await this.publishContainer(userId, containerId)
    return {
      id: result.id,
      url: `https://www.threads.net/@me/post/${result.id}`,
    }
  }

  async schedulePost(post: Post, scheduledAt: Date): Promise<ScheduleResult> {
    // Threads API does not expose a native scheduling endpoint.
    // Return a synthetic id; the scheduler layer fires publishPost at scheduledAt.
    const syntheticId = `scheduled_${post.id}_${scheduledAt.getTime()}`
    return { id: syntheticId }
  }

  async getAnalytics(since: Date, until: Date): Promise<PlatformAnalytics> {
    const userId = await this.resolveUserId()
    const sinceTs = Math.floor(since.getTime() / 1000).toString()
    const untilTs = Math.floor(until.getTime() / 1000).toString()

    const [insights, profile] = await Promise.all([
      this.get<ThreadsInsightsResponse>(`/${userId}/threads_insights`, {
        metric: 'views,likes,replies,reposts,quotes,follower_count',
        period: 'day',
        since: sinceTs,
        until: untilTs,
      }).catch(() => ({ data: [] } as ThreadsInsightsResponse)),
      this.get<ThreadsProfileResponse>(`/${userId}`, {
        fields: 'id,username,threads_biography',
      }).catch(() => ({ id: userId, username: '' } as ThreadsProfileResponse)),
    ])

    void profile

    const sum = (name: string) =>
      insights.data
        .find((m) => m.name === name)
        ?.values.reduce((acc, v) => acc + v.value, 0) ?? 0

    const impressions = sum('views')
    const likes = sum('likes')
    const comments = sum('replies')
    const shares = sum('reposts') + sum('quotes')
    const followerCount = sum('follower_count')
    const engagements = likes + comments + shares
    const engagementRate = impressions > 0 ? engagements / impressions : 0

    return {
      platform: 'threads' as PlatformId,
      since,
      until,
      impressions,
      reach: impressions,
      likes,
      comments,
      shares,
      saves: 0,
      clicks: 0,
      followerCount,
      followerGrowth: 0,
      engagementRate,
      raw: insights,
    }
  }
}
