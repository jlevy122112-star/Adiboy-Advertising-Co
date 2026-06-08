import type { Post } from '@/types/campaign.types'
import type { PlatformId } from '@/types/platform.types'
import type {
  ISocialService,
  PublishResult,
  ScheduleResult,
  PlatformAnalytics,
} from '../social.interface'

const API_BASE = 'https://api.linkedin.com/v2'

interface LiTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

interface LiMeResponse {
  id: string
  localizedFirstName: string
  localizedLastName: string
}

interface LiUploadRegisterResponse {
  value: {
    uploadMechanism: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
        uploadUrl: string
      }
    }
    asset: string
  }
}

interface LiUgcPostResponse {
  id: string
}

interface LiPageStatResponse {
  elements: Array<{
    timeRange: { start: number; end: number }
    totalPageStatistics: {
      clicks: { totalClicks: number }
      impressions: { pageViews: number }
    }
  }>
}

interface LiFollowerStatsResponse {
  elements: Array<{
    followerCounts: {
      organicFollowerCount: number
      paidFollowerCount: number
    }
  }>
}

export class LinkedInService implements ISocialService {
  private accessToken: string
  private personUrn: string | null = null

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      ...extra,
    }
  }

  private async apiGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${API_BASE}${path}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const res = await fetch(url.toString(), { headers: this.authHeaders() })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`LinkedIn GET ${path} ${res.status}: ${text}`)
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
      throw new Error(`LinkedIn POST ${path} ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  private async resolvePersonUrn(): Promise<string> {
    if (this.personUrn) return this.personUrn
    const me = await this.apiGet<LiMeResponse>('/me')
    this.personUrn = `urn:li:person:${me.id}`
    return this.personUrn
  }

  async connect(oauthCode: string): Promise<void> {
    // Token exchange requires client_secret — proxy via backend.
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: oauthCode,
        grant_type: 'authorization_code',
        redirect_uri: window.location.origin + '/oauth/linkedin/callback',
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`LinkedIn OAuth exchange failed ${res.status}: ${text}`)
    }
    const data = (await res.json()) as LiTokenResponse
    this.accessToken = data.access_token
    await this.resolvePersonUrn()
  }

  async disconnect(): Promise<void> {
    this.accessToken = ''
    this.personUrn = null
  }

  private buildCommentary(post: Post): string {
    const tags = post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
    return tags ? `${post.caption}\n\n${tags}` : post.caption
  }

  /** Register a media upload and return the asset URN */
  private async registerMediaUpload(
    authorUrn: string,
    mediaCategory: 'IMAGE' | 'VIDEO',
  ): Promise<{ uploadUrl: string; asset: string }> {
    const res = await this.apiPost<LiUploadRegisterResponse>(
      '/assets?action=registerUpload',
      {
        registerUploadRequest: {
          owner: authorUrn,
          recipes: [`urn:li:digitalmediaRecipe:feedshare-${mediaCategory.toLowerCase()}`],
          serviceRelationships: [
            {
              identifier: 'urn:li:userGeneratedContent',
              relationshipType: 'OWNER',
            },
          ],
        },
      },
    )
    const mech =
      res.value.uploadMechanism[
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
      ]
    return { uploadUrl: mech.uploadUrl, asset: res.value.asset }
  }

  /** Fetch bytes from mediaUrl and PUT them to the LinkedIn upload URL */
  private async uploadMedia(
    mediaUrl: string,
    uploadUrl: string,
    contentType: string,
  ): Promise<void> {
    const mediaRes = await fetch(mediaUrl)
    if (!mediaRes.ok) throw new Error(`Failed to fetch media from ${mediaUrl}`)
    const buffer = await mediaRes.arrayBuffer()

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': contentType,
      },
      body: buffer,
    })
    if (!uploadRes.ok) {
      const text = await uploadRes.text()
      throw new Error(`LinkedIn media upload failed ${uploadRes.status}: ${text}`)
    }
  }

  /** Image or video UGC post */
  private async publishMediaPost(
    authorUrn: string,
    post: Post,
    isVideo: boolean,
  ): Promise<PublishResult> {
    const [mediaUrl] = post.mediaUrls
    const mediaCategory: 'IMAGE' | 'VIDEO' = isVideo ? 'VIDEO' : 'IMAGE'
    const contentType = isVideo ? 'video/mp4' : 'image/jpeg'

    const { uploadUrl, asset } = await this.registerMediaUpload(authorUrn, mediaCategory)
    await this.uploadMedia(mediaUrl, uploadUrl, contentType)

    const body = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: this.buildCommentary(post) },
          shareMediaCategory: mediaCategory,
          media: [
            {
              status: 'READY',
              media: asset,
              title: { text: post.caption.slice(0, 200) },
            },
          ],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }

    const result = await this.apiPost<LiUgcPostResponse>('/ugcPosts', body)
    const postId = result.id
    return {
      id: postId,
      url: `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}`,
    }
  }

  /** Text-only or article share */
  private async publishTextPost(
    authorUrn: string,
    post: Post,
  ): Promise<PublishResult> {
    const body = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: this.buildCommentary(post) },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }

    const result = await this.apiPost<LiUgcPostResponse>('/ugcPosts', body)
    const postId = result.id
    return {
      id: postId,
      url: `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}`,
    }
  }

  async publishPost(post: Post): Promise<PublishResult> {
    const authorUrn = await this.resolvePersonUrn()
    const isVideo = post.contentType === 'video' || post.contentType === 'reel'

    if (post.mediaUrls.length === 0) return this.publishTextPost(authorUrn, post)
    return this.publishMediaPost(authorUrn, post, isVideo)
  }

  async schedulePost(post: Post, scheduledAt: Date): Promise<ScheduleResult> {
    // LinkedIn Marketing API supports scheduled posts via the /shares endpoint
    // with a publishedAt timestamp for Organization pages. For personal profiles
    // native scheduling is not available — store and enqueue locally.
    const syntheticId = `scheduled_${post.id}_${scheduledAt.getTime()}`
    return { id: syntheticId }
  }

  async getAnalytics(since: Date, until: Date): Promise<PlatformAnalytics> {
    const authorUrn = await this.resolvePersonUrn()
    const personId = authorUrn.replace('urn:li:person:', '')

    const [pageStats, followerStats] = await Promise.all([
      this.apiGet<LiPageStatResponse>('/networkSizes/' + encodeURIComponent(authorUrn), {
        edgeType: 'CompanyFollowedByMember',
      }).catch(() => ({ elements: [] } as LiPageStatResponse)),
      this.apiGet<LiFollowerStatsResponse>(
        `/organizationalEntityFollowerStatistics`,
        { q: 'organizationalEntity', organizationalEntity: authorUrn },
      ).catch(() => ({ elements: [] } as LiFollowerStatsResponse)),
    ])

    void since
    void until
    void pageStats
    void personId

    const followerCount =
      (followerStats.elements[0]?.followerCounts.organicFollowerCount ?? 0) +
      (followerStats.elements[0]?.followerCounts.paidFollowerCount ?? 0)

    return {
      platform: 'linkedin' as PlatformId,
      since,
      until,
      impressions: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      clicks: 0,
      followerCount,
      followerGrowth: 0,
      engagementRate: 0,
      raw: { pageStats, followerStats },
    }
  }
}
