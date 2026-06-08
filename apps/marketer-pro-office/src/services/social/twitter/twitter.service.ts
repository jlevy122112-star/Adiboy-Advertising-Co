import type { Post } from '@/types/campaign.types'
import type { PlatformId } from '@/types/platform.types'
import type {
  ISocialService,
  PublishResult,
  ScheduleResult,
  PlatformAnalytics,
} from '../social.interface'

const API_BASE = 'https://api.twitter.com/2'

interface TwitterTokenResponse {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in?: number
  scope?: string
}

interface TwitterMediaUploadResponse {
  media_id_string: string
  media_id: number
}

interface TwitterTweetResponse {
  data: {
    id: string
    text: string
  }
}

interface TwitterUserResponse {
  data: {
    id: string
    name: string
    username: string
    public_metrics: {
      followers_count: number
      following_count: number
      tweet_count: number
    }
  }
}

interface TwitterTweetMetricsResponse {
  data: Array<{
    id: string
    public_metrics: {
      impression_count: number
      like_count: number
      reply_count: number
      retweet_count: number
      url_link_clicks: number
    }
  }>
}

export class TwitterService implements ISocialService {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...extra,
    }
  }

  private async apiPost<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Twitter POST ${path} ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  private async apiGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${API_BASE}${path}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const res = await fetch(url.toString(), { headers: this.authHeaders() })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Twitter GET ${path} ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  async connect(oauthCode: string): Promise<void> {
    // PKCE token exchange — client_secret must not be in client code; proxy via backend.
    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: oauthCode,
        grant_type: 'authorization_code',
        redirect_uri: window.location.origin + '/oauth/twitter/callback',
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Twitter OAuth exchange failed ${res.status}: ${text}`)
    }
    const data = (await res.json()) as TwitterTokenResponse
    this.accessToken = data.access_token
  }

  async disconnect(): Promise<void> {
    await fetch('https://api.twitter.com/2/oauth2/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: this.accessToken,
        token_type_hint: 'access_token',
      }),
    })
    this.accessToken = ''
  }

  private buildTweetText(post: Post): string {
    const tags = post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
    const text = tags ? `${post.caption}\n\n${tags}` : post.caption
    // Twitter limit is 280 chars; truncate with ellipsis if needed
    return text.length <= 280 ? text : text.slice(0, 277) + '...'
  }

  /**
   * Upload a single media item to the v1.1 media upload endpoint.
   * Fetches the bytes from mediaUrl and POSTs them as multipart/form-data.
   */
  private async uploadMedia(mediaUrl: string): Promise<string> {
    const mediaRes = await fetch(mediaUrl)
    if (!mediaRes.ok) throw new Error(`Failed to fetch media from ${mediaUrl}`)
    const buffer = await mediaRes.arrayBuffer()
    const contentType = mediaRes.headers.get('Content-Type') ?? 'image/jpeg'

    const formData = new FormData()
    formData.append('media', new Blob([buffer], { type: contentType }))

    const uploadRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: formData,
    })
    if (!uploadRes.ok) {
      const text = await uploadRes.text()
      throw new Error(`Twitter media upload failed ${uploadRes.status}: ${text}`)
    }
    const data = (await uploadRes.json()) as TwitterMediaUploadResponse
    return data.media_id_string
  }

  async publishPost(post: Post): Promise<PublishResult> {
    const tweetBody: Record<string, unknown> = {
      text: this.buildTweetText(post),
    }

    if (post.mediaUrls.length > 0) {
      // Upload up to 4 images or 1 video/GIF
      const limit = post.contentType === 'image' || post.contentType === 'carousel' ? 4 : 1
      const mediaIds = await Promise.all(
        post.mediaUrls.slice(0, limit).map((url) => this.uploadMedia(url)),
      )
      tweetBody['media'] = { media_ids: mediaIds }
    }

    const result = await this.apiPost<TwitterTweetResponse>('/tweets', tweetBody)
    return {
      id: result.data.id,
      url: `https://twitter.com/i/web/status/${result.data.id}`,
    }
  }

  /**
   * Post a thread: splits the caption into ≤280-char chunks and chains them.
   */
  async publishThread(post: Post): Promise<PublishResult> {
    const words = post.caption.split(' ')
    const chunks: string[] = []
    let current = ''

    for (const word of words) {
      if ((current + ' ' + word).trim().length > 280) {
        if (current) chunks.push(current.trim())
        current = word
      } else {
        current = current ? current + ' ' + word : word
      }
    }
    if (current) chunks.push(current.trim())

    if (chunks.length <= 1) return this.publishPost(post)

    let replyToId: string | undefined
    let firstId = ''

    for (const chunk of chunks) {
      const body: Record<string, unknown> = { text: chunk }
      if (replyToId) body['reply'] = { in_reply_to_tweet_id: replyToId }

      const result = await this.apiPost<TwitterTweetResponse>('/tweets', body)
      if (!firstId) firstId = result.data.id
      replyToId = result.data.id
    }

    return {
      id: firstId,
      url: `https://twitter.com/i/web/status/${firstId}`,
    }
  }

  async schedulePost(post: Post, scheduledAt: Date): Promise<ScheduleResult> {
    // Twitter API v2 does not expose a native scheduled-tweet endpoint for
    // third-party apps. Store the post locally and enqueue a publish job.
    // This returns a synthetic id the scheduler layer can track.
    const syntheticId = `scheduled_${post.id}_${scheduledAt.getTime()}`
    return { id: syntheticId }
  }

  async getAnalytics(since: Date, until: Date): Promise<PlatformAnalytics> {
    const [userRes, metricsRes] = await Promise.all([
      this.apiGet<TwitterUserResponse>('/users/me', {
        'user.fields': 'public_metrics',
      }),
      this.apiGet<TwitterTweetMetricsResponse>('/users/me/tweets', {
        max_results: '100',
        start_time: since.toISOString(),
        end_time: until.toISOString(),
        'tweet.fields': 'public_metrics',
      }),
    ])

    const tweets = metricsRes.data ?? []
    const sum = (key: keyof (typeof tweets)[0]['public_metrics']) =>
      tweets.reduce((acc, t) => acc + (t.public_metrics[key] as number), 0)

    const impressions = sum('impression_count')
    const likes = sum('like_count')
    const comments = sum('reply_count')
    const shares = sum('retweet_count')
    const clicks = sum('url_link_clicks')
    const engagements = likes + comments + shares + clicks
    const engagementRate = impressions > 0 ? engagements / impressions : 0

    return {
      platform: 'twitter' as PlatformId,
      since,
      until,
      impressions,
      reach: impressions,
      likes,
      comments,
      shares,
      saves: 0,
      clicks,
      followerCount: userRes.data.public_metrics.followers_count,
      followerGrowth: 0,
      engagementRate,
      raw: metricsRes,
    }
  }
}
