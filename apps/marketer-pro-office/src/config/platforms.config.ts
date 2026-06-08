import type { PlatformId, Platform } from '@/types/platform.types'

export const PLATFORMS_CONFIG: Record<PlatformId, Omit<Platform, 'connected' | 'accessToken' | 'tokenExpiry' | 'accountName' | 'accountAvatar'>> = {
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    color: '#E1306C',
    icon: '📸',
    capabilities: {
      image: true, video: true, carousel: true,
      stories: true, reels: true, scheduling: true, analytics: true,
    },
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    color: '#010101',
    icon: '🎵',
    capabilities: {
      image: false, video: true, carousel: false,
      stories: false, reels: true, scheduling: true, analytics: true,
    },
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    color: '#FF0000',
    icon: '▶️',
    capabilities: {
      image: false, video: true, carousel: false,
      stories: true, reels: true, scheduling: true, analytics: true,
    },
  },
  twitter: {
    id: 'twitter',
    name: 'X (Twitter)',
    color: '#000000',
    icon: '𝕏',
    capabilities: {
      image: true, video: true, carousel: true,
      stories: false, reels: false, scheduling: true, analytics: true,
    },
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    color: '#0A66C2',
    icon: '💼',
    capabilities: {
      image: true, video: true, carousel: true,
      stories: false, reels: false, scheduling: true, analytics: true,
    },
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    color: '#1877F2',
    icon: '👥',
    capabilities: {
      image: true, video: true, carousel: true,
      stories: true, reels: true, scheduling: true, analytics: true,
    },
  },
  pinterest: {
    id: 'pinterest',
    name: 'Pinterest',
    color: '#E60023',
    icon: '📌',
    capabilities: {
      image: true, video: true, carousel: false,
      stories: false, reels: false, scheduling: true, analytics: true,
    },
  },
  threads: {
    id: 'threads',
    name: 'Threads',
    color: '#000000',
    icon: '🧵',
    capabilities: {
      image: true, video: true, carousel: false,
      stories: false, reels: false, scheduling: false, analytics: false,
    },
  },
}

export const PLATFORM_IDS: PlatformId[] = [
  'instagram', 'tiktok', 'youtube', 'twitter',
  'linkedin', 'facebook', 'pinterest', 'threads',
]
