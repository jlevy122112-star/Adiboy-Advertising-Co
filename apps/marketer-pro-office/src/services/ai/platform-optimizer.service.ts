export interface PlatformLimits {
  captionLimit: number
  hashtagLimit: number
  optimalCaptionLength: number
}

export interface MediaSpecs {
  imageAspectRatios: string[]
  recommendedResolution: string
  maxFileSizeMb: number
  supportedFormats: string[]
  videoMaxDurationSec?: number
}

export interface OptimizedContent {
  caption: string
  hashtags: string[]
  mediaSpecs: MediaSpecs
}

interface PlatformConfig extends PlatformLimits {
  mediaSpecs: MediaSpecs
  bestPostingHoursUTC: number[]
}

export const PLATFORM_LIMITS: Record<string, PlatformLimits> = {
  instagram: { captionLimit: 2200, hashtagLimit: 30, optimalCaptionLength: 150 },
  tiktok: { captionLimit: 150, hashtagLimit: 5, optimalCaptionLength: 100 },
  twitter: { captionLimit: 280, hashtagLimit: 2, optimalCaptionLength: 200 },
  linkedin: { captionLimit: 3000, hashtagLimit: 5, optimalCaptionLength: 600 },
  youtube: { captionLimit: 5000, hashtagLimit: 5, optimalCaptionLength: 300 },
  facebook: { captionLimit: 63206, hashtagLimit: 2, optimalCaptionLength: 300 },
  pinterest: { captionLimit: 500, hashtagLimit: 5, optimalCaptionLength: 200 },
  threads: { captionLimit: 500, hashtagLimit: 3, optimalCaptionLength: 300 },
}

const PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  instagram: {
    ...PLATFORM_LIMITS.instagram,
    mediaSpecs: {
      imageAspectRatios: ['1:1', '4:5', '9:16'],
      recommendedResolution: '1080x1080',
      maxFileSizeMb: 30,
      supportedFormats: ['jpg', 'png', 'mp4', 'mov'],
      videoMaxDurationSec: 60,
    },
    bestPostingHoursUTC: [9, 11, 14, 17, 20],
  },
  tiktok: {
    ...PLATFORM_LIMITS.tiktok,
    mediaSpecs: {
      imageAspectRatios: ['9:16'],
      recommendedResolution: '1080x1920',
      maxFileSizeMb: 287,
      supportedFormats: ['mp4', 'mov', 'avi', 'webm'],
      videoMaxDurationSec: 600,
    },
    bestPostingHoursUTC: [6, 10, 19, 21],
  },
  twitter: {
    ...PLATFORM_LIMITS.twitter,
    mediaSpecs: {
      imageAspectRatios: ['16:9', '1:1'],
      recommendedResolution: '1200x675',
      maxFileSizeMb: 5,
      supportedFormats: ['jpg', 'png', 'gif', 'mp4'],
      videoMaxDurationSec: 140,
    },
    bestPostingHoursUTC: [8, 12, 17, 20],
  },
  linkedin: {
    ...PLATFORM_LIMITS.linkedin,
    mediaSpecs: {
      imageAspectRatios: ['1.91:1', '1:1'],
      recommendedResolution: '1200x627',
      maxFileSizeMb: 5,
      supportedFormats: ['jpg', 'png', 'gif', 'mp4'],
      videoMaxDurationSec: 600,
    },
    bestPostingHoursUTC: [8, 10, 12, 17],
  },
  youtube: {
    ...PLATFORM_LIMITS.youtube,
    mediaSpecs: {
      imageAspectRatios: ['16:9'],
      recommendedResolution: '1280x720',
      maxFileSizeMb: 128000,
      supportedFormats: ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm'],
      videoMaxDurationSec: 43200,
    },
    bestPostingHoursUTC: [14, 15, 16, 17, 20],
  },
  facebook: {
    ...PLATFORM_LIMITS.facebook,
    mediaSpecs: {
      imageAspectRatios: ['1.91:1', '1:1', '4:5'],
      recommendedResolution: '1200x630',
      maxFileSizeMb: 4096,
      supportedFormats: ['jpg', 'png', 'gif', 'mp4', 'mov'],
      videoMaxDurationSec: 14400,
    },
    bestPostingHoursUTC: [9, 13, 15, 19],
  },
  pinterest: {
    ...PLATFORM_LIMITS.pinterest,
    mediaSpecs: {
      imageAspectRatios: ['2:3', '1:1'],
      recommendedResolution: '1000x1500',
      maxFileSizeMb: 32,
      supportedFormats: ['jpg', 'png', 'gif', 'mp4'],
      videoMaxDurationSec: 900,
    },
    bestPostingHoursUTC: [20, 21, 23, 2],
  },
  threads: {
    ...PLATFORM_LIMITS.threads,
    mediaSpecs: {
      imageAspectRatios: ['1:1', '4:5', '9:16'],
      recommendedResolution: '1080x1080',
      maxFileSizeMb: 25,
      supportedFormats: ['jpg', 'png', 'gif', 'mp4'],
      videoMaxDurationSec: 300,
    },
    bestPostingHoursUTC: [9, 12, 18, 21],
  },
}

const DEFAULT_MEDIA_SPECS: MediaSpecs = {
  imageAspectRatios: ['1:1', '16:9'],
  recommendedResolution: '1080x1080',
  maxFileSizeMb: 10,
  supportedFormats: ['jpg', 'png'],
}

function truncateToLimit(text: string, limit: number): string {
  if (text.length <= limit) return text
  const truncated = text.slice(0, limit - 1)
  const lastSpace = truncated.lastIndexOf(' ')
  return lastSpace > limit * 0.8 ? truncated.slice(0, lastSpace) : truncated
}

function clampHashtags(hashtags: string[], limit: number): string[] {
  return hashtags.slice(0, limit)
}

export function optimizeForPlatform(
  content: { caption: string; hashtags: string[] },
  platform: string,
): OptimizedContent {
  const key = platform.toLowerCase()
  const config = PLATFORM_CONFIG[key]

  if (!config) {
    return {
      caption: content.caption,
      hashtags: content.hashtags,
      mediaSpecs: DEFAULT_MEDIA_SPECS,
    }
  }

  const caption = truncateToLimit(content.caption, config.captionLimit)
  const hashtags = clampHashtags(content.hashtags, config.hashtagLimit)

  return {
    caption,
    hashtags,
    mediaSpecs: config.mediaSpecs,
  }
}

export function getBestPostingHours(platform: string): number[] {
  const key = platform.toLowerCase()
  return PLATFORM_CONFIG[key]?.bestPostingHoursUTC ?? [9, 12, 18]
}

export function getPlatformLimits(platform: string): PlatformLimits {
  const key = platform.toLowerCase()
  return PLATFORM_LIMITS[key] ?? { captionLimit: 2200, hashtagLimit: 10, optimalCaptionLength: 300 }
}
