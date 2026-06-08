export type PlatformId =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'twitter'
  | 'linkedin'
  | 'facebook'
  | 'pinterest'
  | 'threads'

export interface Platform {
  id: PlatformId
  name: string
  color: string
  icon: string
  connected: boolean
  accountName?: string
  accountAvatar?: string
  accessToken?: string
  tokenExpiry?: string
  capabilities: PlatformCapabilities
}

export interface PlatformCapabilities {
  image: boolean
  video: boolean
  carousel: boolean
  stories: boolean
  reels: boolean
  scheduling: boolean
  analytics: boolean
}

export interface PlatformState {
  platforms: Record<PlatformId, Platform>
  connecting: PlatformId | null
  error: string | null
}

export interface OAuthCallbackParams {
  platform: PlatformId
  code: string
  state: string
}
