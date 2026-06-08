import type { Post } from '@/types/campaign.types'
import type { PlatformId } from '@/types/platform.types'
import type {
  ISocialService,
  PublishResult,
  ScheduleResult,
  PlatformAnalytics,
} from '../social.interface'

const API_BASE = 'https://api.pinterest.com/v5'

interface PinTokenResponse {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in?: number
}

interface PinUserResponse {
  username: string
  id: string
  account_type: string
}

interface PinBoardsResponse {
  items: Array<{
    id: string
    name: string
    owner: { username: string }
  }>
  bookmark?: string
}

interface PinMediaUploadResponse {
  media_id: string
  media_type: string
  upload_url: string
  upload_parameters: Record<string, string>
}

interface PinMediaStatusResponse {
  media_id: string
  status: 'registered' | 'processing' | 'succeeded' | 'failed'
}

interface PinCreateResponse {
  id: string
  link?: string
  title?: string
  description?: string
}

interface PinAnalyticsResponse {
  all: {
    daily_metrics: Array<{
      date: string
      data_status: string
      impression: number
      engagements: number
      pin_click: number
      outbound_click: number
      save: number
    }>
    summary_metrics: {
      impression: number
      engagements: number
      pin_click: number
      outbound_click: number
      save: number
    }
  }
}

interface PinFollowersResponse {
  bookmark?: string
  items: Array<{ id: string; username: string }>
}

export class PinterestService implements ISocialService {
  private accessToken: string
  private userId: string | null = null
  private defaultBoardId: string | null = null

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
      throw new Error(`Pinterest GET ${path} ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  private async apiPost<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Pinterest POST ${path} ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  private async resolveUserId(): Promise<string> {
    if (this.userId) return this.userId
    const me = await this.apiGet<PinUserResponse>('/user_account')
    this.userId = me.id
    return me.id
  }

  /** Return the first board for the authenticated user, cached after first call */
  private async resolveDefaultBoardId(): Promise<string> {
    if (this.defaultBoardId) return this.defaultBoardId
    const boards = await this.apiGet<PinBoardsResponse>('/boards', { page_size: '1' })
    if (!boards.items.length) throw new Error('No Pinterest boards found for this user')
    this.defaultBoardId = boards.items[0].id
    return this.defaultBoardId
  }

  async connect(oauthCode: string): Promise<void> {
    const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: oauthCode,
        grant_type: 'authorization_code',
        redirect_uri: window.location.origin + '/oauth/pinterest/callback',
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Pinterest OAuth exchange failed ${res.status}: ${text}`)
    }
    const data = (await res.json()) as PinTokenResponse
    this.accessToken = data.access_token
    await this.resolveUserId()
    await this.resolveDefaultBoardId()
  }

  async disconnect(): Promise<void> {
    this.accessToken = ''
    this.userId = null
    this.defaultBoardId = null
  }

  private buildDescription(post: Post): string {
    const tags = post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
    return tags ? `${post.caption}\n\n${tags}` : post.caption
  }

  /**
   * Register a media upload (video pins), upload the bytes, and poll until
   * Pinterest processing is complete.
   */
  private async uploadVideo(videoUrl: string): Promise<string> {
    // Step 1: register
    const registration = await this.apiPost<PinMediaUploadResponse>('/media', {
      media_type: 'video',
    })

    // Step 2: fetch video bytes
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error(`Failed to fetch video from ${videoUrl}`)
    const buffer = await videoRes.arrayBuffer()

    // Step 3: multipart POST to S3 upload URL with Pinterest-supplied parameters
    const formData = new FormData()
    for (const [k, v] of Object.entries(registration.upload_parameters)) {
      formData.append(k, v)
    }
    formData.append('file', new Blob([buffer], { type: 'video/mp4' }))

    const uploadRes = await fetch(registration.upload_url, {
      method: 'POST',
      body: formData,
    })
    if (!uploadRes.ok) {
      const text = await uploadRes.text()
      throw new Error(`Pinterest video upload failed ${uploadRes.status}: ${text}`)
    }

    // Step 4: poll for processing completion
    await this.pollMediaStatus(registration.media_id)
    return registration.media_id
  }

  private async pollMediaStatus(mediaId: string, maxAttempts = 20): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, 3000))
      const status = await this.apiGet<PinMediaStatusResponse>(`/media/${mediaId}`)
      if (status.status === 'succeeded') return
      if (status.status === 'failed') {
        throw new Error(`Pinterest media processing failed for ${mediaId}`)
      }
    }
    throw new Error('Pinterest media processing polling timed out')
  }

  async publishPost(post: Post): Promise<PublishResult> {
    const boardId = await this.resolveDefaultBoardId()
    const isVideo = post.contentType === 'video' || post.contentType === 'reel'
    const [mediaUrl] = post.mediaUrls
    if (!mediaUrl) throw new Error('Pinterest requires at least one media URL')

    const pinBody: Record<string, unknown> = {
      board_id: boardId,
      title: post.caption.slice(0, 100),
      description: this.buildDescription(post),
    }

    if (isVideo) {
      const mediaId = await this.uploadVideo(mediaUrl)
      pinBody['media_source'] = {
        source_type: 'video_id',
        media_id: mediaId,
      }
    } else {
      pinBody['media_source'] = {
        source_type: 'image_url',
        url: mediaUrl,
      }
    }

    const result = await this.apiPost<PinCreateResponse>('/pins', pinBody)
    return {
      id: result.id,
      url: `https://www.pinterest.com/pin/${result.id}/`,
    }
  }

  async schedulePost(post: Post, scheduledAt: Date): Promise<ScheduleResult> {
    // Pinterest API v5 does not expose a scheduled-pin endpoint for third-party
    // apps. Return a synthetic id; the scheduler layer fires publishPost at scheduledAt.
    const syntheticId = `scheduled_${post.id}_${scheduledAt.getTime()}`
    return { id: syntheticId }
  }

  async getAnalytics(since: Date, until: Date): Promise<PlatformAnalytics> {
    const sinceStr = since.toISOString().slice(0, 10)
    const untilStr = until.toISOString().slice(0, 10)

    const [analytics, followersRes] = await Promise.all([
      this.apiGet<PinAnalyticsResponse>('/user_account/analytics', {
        start_date: sinceStr,
        end_date: untilStr,
        metric_types: 'IMPRESSION,ENGAGEMENT,PIN_CLICK,OUTBOUND_CLICK,SAVE',
      }),
      this.apiGet<PinFollowersResponse>('/user_account/followers', { page_size: '1' }).catch(
        () => ({ items: [] } as PinFollowersResponse),
      ),
    ])

    const summary = analytics.all?.summary_metrics
    const impressions = summary?.impression ?? 0
    const engagements = summary?.engagements ?? 0
    const saves = summary?.save ?? 0
    const clicks = summary?.pin_click ?? 0
    const engagementRate = impressions > 0 ? engagements / impressions : 0

    void followersRes

    return {
      platform: 'pinterest' as PlatformId,
      since,
      until,
      impressions,
      reach: impressions,
      likes: 0,
      comments: 0,
      shares: 0,
      saves,
      clicks,
      followerCount: 0,
      followerGrowth: 0,
      engagementRate,
      raw: analytics,
    }
  }
}
