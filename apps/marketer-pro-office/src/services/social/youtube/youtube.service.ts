import type { Post } from '@/types/campaign.types'
import type { PlatformId } from '@/types/platform.types'
import type {
  ISocialService,
  PublishResult,
  ScheduleResult,
  PlatformAnalytics,
} from '../social.interface'

const API_BASE = 'https://www.googleapis.com/youtube/v3'
const UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3'

interface YtVideoResource {
  kind: string
  etag: string
  id: string
  snippet?: {
    title: string
    description: string
    channelId: string
    channelTitle: string
    publishedAt: string
    tags: string[]
  }
  status?: {
    uploadStatus: string
    privacyStatus: string
  }
}

interface YtChannelListResponse {
  items: Array<{
    id: string
    statistics: {
      subscriberCount: string
      viewCount: string
    }
  }>
}

interface YtAnalyticsResponse {
  columnHeaders: Array<{ name: string }>
  rows: Array<Array<number | string>>
}

interface YtOAuthTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export class YouTubeService implements ISocialService {
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

  private async apiGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${API_BASE}${path}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const res = await fetch(url.toString(), { headers: this.authHeaders() })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`YouTube GET ${path} ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  async connect(oauthCode: string): Promise<void> {
    // Token exchange requires client_secret — proxy through your backend.
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: oauthCode,
        grant_type: 'authorization_code',
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`YouTube OAuth exchange failed ${res.status}: ${text}`)
    }
    const data = (await res.json()) as YtOAuthTokenResponse
    this.accessToken = data.access_token
  }

  async disconnect(): Promise<void> {
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(this.accessToken)}`,
      { method: 'POST' },
    )
    this.accessToken = ''
  }

  private buildDescription(post: Post): string {
    const tags = post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
    return tags ? `${post.caption}\n\n${tags}` : post.caption
  }

  /**
   * Resumable upload: fetch the video bytes from mediaUrl and stream them
   * to the YouTube resumable upload endpoint.
   */
  private async resumableUpload(
    videoUrl: string,
    snippet: Record<string, unknown>,
    status: Record<string, unknown>,
  ): Promise<YtVideoResource> {
    // Step 1: initiate
    const initRes = await fetch(
      `${UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`,
      {
        method: 'POST',
        headers: {
          ...this.authHeaders(),
          'X-Upload-Content-Type': 'video/*',
        },
        body: JSON.stringify({ snippet, status }),
      },
    )
    if (!initRes.ok) {
      const text = await initRes.text()
      throw new Error(`YouTube resumable init failed ${initRes.status}: ${text}`)
    }
    const uploadUri = initRes.headers.get('Location')
    if (!uploadUri) throw new Error('YouTube did not return a resumable upload URI')

    // Step 2: fetch video bytes from URL
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error(`Failed to fetch video from ${videoUrl}`)
    const videoBuffer = await videoRes.arrayBuffer()

    // Step 3: upload
    const uploadRes = await fetch(uploadUri, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/*',
        'Content-Length': videoBuffer.byteLength.toString(),
      },
      body: videoBuffer,
    })
    if (!uploadRes.ok) {
      const text = await uploadRes.text()
      throw new Error(`YouTube video upload failed ${uploadRes.status}: ${text}`)
    }
    return uploadRes.json() as Promise<YtVideoResource>
  }

  async publishPost(post: Post): Promise<PublishResult> {
    const [videoUrl] = post.mediaUrls
    if (!videoUrl) throw new Error('YouTube requires a video URL')

    const isShort =
      post.contentType === 'reel' || post.caption.toLowerCase().includes('#shorts')

    const tags = post.hashtags.map((h) => h.replace(/^#/, ''))
    if (isShort && !tags.includes('Shorts')) tags.push('Shorts')

    const snippet: Record<string, unknown> = {
      title: post.caption.slice(0, 100),
      description: this.buildDescription(post),
      tags,
      categoryId: '22', // People & Blogs default
    }

    const status: Record<string, unknown> = { privacyStatus: 'public' }

    const video = await this.resumableUpload(videoUrl, snippet, status)

    return {
      id: video.id,
      url: `https://www.youtube.com/watch?v=${video.id}`,
    }
  }

  async schedulePost(post: Post, scheduledAt: Date): Promise<ScheduleResult> {
    const [videoUrl] = post.mediaUrls
    if (!videoUrl) throw new Error('YouTube requires a video URL')

    const tags = post.hashtags.map((h) => h.replace(/^#/, ''))

    const snippet: Record<string, unknown> = {
      title: post.caption.slice(0, 100),
      description: this.buildDescription(post),
      tags,
      categoryId: '22',
    }

    const status: Record<string, unknown> = {
      privacyStatus: 'private',
      publishAt: scheduledAt.toISOString(),
    }

    const video = await this.resumableUpload(videoUrl, snippet, status)
    return { id: video.id }
  }

  /** Community post (text + optional image). Requires channel memberships. */
  async publishCommunityPost(post: Post): Promise<PublishResult> {
    const body: Record<string, unknown> = {
      snippet: {
        type: 'textOriginal',
        textOriginal: { text: this.buildDescription(post) },
      },
    }

    if (post.mediaUrls[0]) {
      body['snippet'] = {
        ...(body['snippet'] as Record<string, unknown>),
        type: 'imagePost',
        imagePost: { mediaUrl: post.mediaUrls[0] },
      }
    }

    const res = await fetch(`${API_BASE}/communityPosts?part=snippet`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`YouTube community post failed ${res.status}: ${text}`)
    }
    const data = (await res.json()) as { id: string }
    return { id: data.id, url: `https://www.youtube.com/post/${data.id}` }
  }

  async getAnalytics(since: Date, until: Date): Promise<PlatformAnalytics> {
    const [channelRes, analyticsRes] = await Promise.all([
      this.apiGet<YtChannelListResponse>('/channels', {
        part: 'statistics',
        mine: 'true',
      }),
      fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?` +
          new URLSearchParams({
            ids: 'channel==MINE',
            startDate: isoDate(since),
            endDate: isoDate(until),
            metrics: 'views,estimatedMinutesWatched,likes,comments,shares,subscribersGained',
            dimensions: 'day',
          }).toString(),
        { headers: this.authHeaders() },
      ).then((r) => r.json() as Promise<YtAnalyticsResponse>),
    ])

    const colIndex = (name: string) =>
      analyticsRes.columnHeaders.findIndex((h) => h.name === name)

    const sumCol = (name: string) => {
      const idx = colIndex(name)
      if (idx < 0) return 0
      return (analyticsRes.rows ?? []).reduce(
        (acc, row) => acc + (Number(row[idx]) || 0),
        0,
      )
    }

    const followerCount = parseInt(channelRes.items[0]?.statistics?.subscriberCount ?? '0', 10)

    return {
      platform: 'youtube' as PlatformId,
      since,
      until,
      impressions: sumCol('views'),
      reach: sumCol('views'),
      likes: sumCol('likes'),
      comments: sumCol('comments'),
      shares: sumCol('shares'),
      saves: 0,
      clicks: 0,
      followerCount,
      followerGrowth: sumCol('subscribersGained'),
      engagementRate: 0,
      raw: analyticsRes,
    }
  }
}
