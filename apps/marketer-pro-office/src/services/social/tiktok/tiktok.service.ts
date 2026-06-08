import type { Post } from '@/types/campaign.types'
import type { PlatformId } from '@/types/platform.types'
import type {
  ISocialService,
  PublishResult,
  ScheduleResult,
  PlatformAnalytics,
} from '../social.interface'

const API_BASE = 'https://open.tiktokapis.com/v2'

interface TikTokTokenResponse {
  data: {
    access_token: string
    refresh_token: string
    open_id: string
    expires_in: number
  }
  error: {
    code: string
    message: string
    log_id: string
  }
}

interface TikTokUploadInitResponse {
  data: {
    publish_id: string
    upload_url: string
  }
  error: { code: string; message: string; log_id: string }
}

interface TikTokPublishStatusResponse {
  data: {
    status: 'PROCESSING_UPLOAD' | 'PROCESSING_DOWNLOAD' | 'SEND_TO_USER_INBOX' | 'PUBLISH_COMPLETE' | 'FAILED'
    publicaly_available_post_id?: string[]
    fail_reason?: string
  }
  error: { code: string; message: string; log_id: string }
}

interface TikTokUserInfo {
  data: {
    user: {
      open_id: string
      union_id: string
      avatar_url: string
      display_name: string
      follower_count: number
    }
  }
  error: { code: string; message: string; log_id: string }
}

interface TikTokVideoQueryResponse {
  data: {
    videos: Array<{
      id: string
      like_count: number
      comment_count: number
      share_count: number
      view_count: number
    }>
    cursor: number
    has_more: boolean
  }
  error: { code: string; message: string; log_id: string }
}

export class TikTokService implements ISocialService {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
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
      throw new Error(`TikTok POST ${path} ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  private async apiGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${API_BASE}${path}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const res = await fetch(url.toString(), { headers: this.authHeaders() })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`TikTok GET ${path} ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  async connect(oauthCode: string): Promise<void> {
    // Token exchange requires client_key + client_secret — use your backend proxy.
    const res = await fetch(`${API_BASE}/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: oauthCode, grant_type: 'authorization_code' }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`TikTok OAuth exchange failed ${res.status}: ${text}`)
    }
    const data = (await res.json()) as TikTokTokenResponse
    if (data.error?.code && data.error.code !== 'ok') {
      throw new Error(`TikTok OAuth error: ${data.error.message}`)
    }
    this.accessToken = data.data.access_token
  }

  async disconnect(): Promise<void> {
    await this.apiPost('/oauth/revoke/', { token: this.accessToken })
    this.accessToken = ''
  }

  private buildCaption(post: Post): string {
    const tags = post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
    return tags ? `${post.caption} ${tags}` : post.caption
  }

  /** Initiate a file-based upload and poll until published */
  private async uploadAndPublish(
    videoUrl: string,
    caption: string,
  ): Promise<TikTokUploadInitResponse['data']> {
    // Step 1: initialise upload
    const init = await this.apiPost<TikTokUploadInitResponse>(
      '/post/publish/video/init/',
      {
        post_info: {
          title: caption.slice(0, 150),
          privacy_level: 'SELF_ONLY', // creator changes this in TikTok UI before posting
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: videoUrl,
        },
      },
    )

    if (init.error?.code && init.error.code !== 'ok') {
      throw new Error(`TikTok init failed: ${init.error.message}`)
    }

    return init.data
  }

  private async pollPublishStatus(publishId: string, maxAttempts = 20): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, 3000))
      const status = await this.apiPost<TikTokPublishStatusResponse>(
        '/post/publish/status/fetch/',
        { publish_id: publishId },
      )
      const s = status.data.status
      if (s === 'PUBLISH_COMPLETE') {
        return status.data.publicaly_available_post_id?.[0] ?? publishId
      }
      if (s === 'FAILED') {
        throw new Error(`TikTok publish failed: ${status.data.fail_reason ?? 'unknown'}`)
      }
    }
    throw new Error('TikTok publish polling timed out')
  }

  async publishPost(post: Post): Promise<PublishResult> {
    const [videoUrl] = post.mediaUrls
    if (!videoUrl) throw new Error('TikTok requires at least one video URL')

    const caption = this.buildCaption(post)
    const uploadData = await this.uploadAndPublish(videoUrl, caption)
    const postId = await this.pollPublishStatus(uploadData.publish_id)

    return {
      id: postId,
      url: `https://www.tiktok.com/@me/video/${postId}`,
    }
  }

  async schedulePost(post: Post, scheduledAt: Date): Promise<ScheduleResult> {
    const [videoUrl] = post.mediaUrls
    if (!videoUrl) throw new Error('TikTok requires at least one video URL')

    const caption = this.buildCaption(post)

    const init = await this.apiPost<TikTokUploadInitResponse>(
      '/post/publish/video/init/',
      {
        post_info: {
          title: caption.slice(0, 150),
          privacy_level: 'SELF_ONLY',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
          scheduled_publish_time: Math.floor(scheduledAt.getTime() / 1000),
          auto_add_music: false,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: videoUrl,
        },
      },
    )

    if (init.error?.code && init.error.code !== 'ok') {
      throw new Error(`TikTok schedule failed: ${init.error.message}`)
    }

    return { id: init.data.publish_id }
  }

  async getAnalytics(since: Date, until: Date): Promise<PlatformAnalytics> {
    const [userRes, videoRes] = await Promise.all([
      this.apiGet<TikTokUserInfo>('/user/info/', {
        fields: 'open_id,union_id,avatar_url,display_name,follower_count',
      }),
      this.apiPost<TikTokVideoQueryResponse>('/video/query/', {
        filters: {
          video_ids: [],
        },
        fields: ['id', 'like_count', 'comment_count', 'share_count', 'view_count'],
        max_count: 20,
      }),
    ])

    const videos = videoRes.data?.videos ?? []
    const sum = (key: keyof (typeof videos)[0]) =>
      videos.reduce((acc, v) => acc + (v[key] as number), 0)

    const impressions = sum('view_count')
    const likes = sum('like_count')
    const comments = sum('comment_count')
    const shares = sum('share_count')
    const engagements = likes + comments + shares
    const engagementRate = impressions > 0 ? engagements / impressions : 0

    return {
      platform: 'tiktok' as PlatformId,
      since,
      until,
      impressions,
      reach: impressions,
      likes,
      comments,
      shares,
      saves: 0,
      clicks: 0,
      followerCount: userRes.data.user.follower_count,
      followerGrowth: 0,
      engagementRate,
      raw: { userRes, videoRes },
    }
  }
}
