/**
 * Campaign Orchestrator — "Sit back. We got this."
 *
 * User enters one prompt → AI returns TWO complete marketing strategies →
 * user picks their approach → full plan: assets, schedule, SEO, ad copy.
 */

import { useState, useCallback, useRef } from 'react'
import { useBrandTheme } from '../BrandThemePanel'
import { apiFetch } from '../hooks/useApi'
import { CampaignCalendar } from './CampaignCalendar'

import './campaign-orchestrator.css'

const DRAFT_API    = (import.meta.env.VITE_CAMPAIGN_API_ORIGIN   as string | undefined) ?? 'http://localhost:8801'
const AUTONOMY_API = (import.meta.env.VITE_AUTONOMOUS_API_ORIGIN as string | undefined) ?? 'http://localhost:8805'

/* ─────────────────────────────────────────── types ─── */

type CampaignGoal = 'brand_awareness' | 'lead_generation' | 'product_launch' | 'event_promotion' | 'sale_offer' | 'content_marketing'
type Duration = '1_week' | '2_weeks' | '1_month'
export type Platform = 'facebook' | 'instagram' | 'linkedin' | 'youtube'
export type AssetType = 'feed_image' | 'reel' | 'story' | 'cover_photo' | 'profile_image' | 'ad_image' | 'ad_copy' | 'carousel' | 'video_thumbnail' | 'channel_art' | 'blog_hero' | 'short'
type BudgetTier = 'organic' | 'low_spend' | 'medium_spend'

export interface AssetSpec {
  id: string; platform: Platform; type: AssetType; label: string; dims: string; description: string; enabled: boolean
}
export interface ScheduledPost {
  id: string; dayIndex: number | null; platform: Platform; dayLabel: string; time: string; assetType: AssetType; label: string; peakScore: 'peak' | 'good' | 'standard'; enabled: boolean
}
export interface SeoStrategy {
  focusKeywords: string[]
  hashtagsByPlatform: Partial<Record<Platform, string[]>>
  blogPostTitle: string
  blogPostOutline: string[]
  metaDescription: string
}
export interface CampaignPlan {
  campaignName: string
  summary: string
  platforms: Platform[]
  duration: Duration
  totalAssets: number
  totalPosts: number
  estimatedReach: string
  assets: AssetSpec[]
  schedule: ScheduledPost[]
  seo: SeoStrategy
  adCopy: Array<{ platform: Platform; headline: string; body: string; cta: string }>
  contentPillars: string[]
  audiencePersona: string
  kpis: string[]
  budgetTier: BudgetTier
}
export interface CampaignVariant extends CampaignPlan {
  variantId: 'A' | 'B'
  strategyName: string
  strategyTagline: string
  differentiators: string[]
  approachIcon: string
  postsPerWeek: string
}

/* ─────────────────────────────────────────── constants ─── */

const GOALS: Array<{ value: CampaignGoal; label: string; icon: string; desc: string }> = [
  { value: 'brand_awareness',   label: 'Brand Awareness',   icon: '◎', desc: 'Build recognition and top-of-mind presence' },
  { value: 'lead_generation',   label: 'Lead Generation',   icon: '◈', desc: 'Drive signups, inquiries, and qualified leads' },
  { value: 'product_launch',    label: 'Product Launch',    icon: '⚡', desc: 'Announce and hype a new product or feature' },
  { value: 'event_promotion',   label: 'Event Promotion',   icon: '◆', desc: 'Fill seats and drive event registrations' },
  { value: 'sale_offer',        label: 'Sale / Offer',      icon: '◇', desc: 'Drive purchases with urgency and deals' },
  { value: 'content_marketing', label: 'Content Marketing', icon: '▦', desc: 'Educate, entertain, and grow organic audience' },
]

const DURATIONS: Array<{ value: Duration; label: string; posts: string }> = [
  { value: '1_week',  label: '1 Week',  posts: '12–18 posts' },
  { value: '2_weeks', label: '2 Weeks', posts: '24–36 posts' },
  { value: '1_month', label: '1 Month', posts: '48–72 posts' },
]

export const PLATFORM_META: Record<Platform, { label: string; color: string; bg: string; icon: string }> = {
  facebook:  { label: 'Facebook',  color: '#1877F2', bg: '#E7F0FF', icon: 'f' },
  instagram: { label: 'Instagram', color: '#d6249f', bg: '#FDE8F7', icon: '◈' },
  linkedin:  { label: 'LinkedIn',  color: '#0A66C2', bg: '#E6F0FA', icon: 'in' },
  youtube:   { label: 'YouTube',   color: '#FF0000', bg: '#FFE9E9', icon: '▶' },
}

export const ASSET_TYPE_ICONS: Record<AssetType, string> = {
  feed_image: '🖼', reel: '🎬', story: '📱', cover_photo: '🏞', profile_image: '👤',
  ad_image: '📣', ad_copy: '✍', carousel: '🎠', video_thumbnail: '🎯',
  channel_art: '🎨', blog_hero: '📄', short: '⚡',
}

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  feed_image: 'Feed Post', reel: 'Reel', story: 'Story', cover_photo: 'Cover Photo',
  profile_image: 'Profile Image', ad_image: 'Ad Creative', ad_copy: 'Ad Copy',
  carousel: 'Carousel', video_thumbnail: 'Thumbnail', channel_art: 'Channel Art',
  blog_hero: 'Article', short: 'Short',
}

/* ─────────────────────────────────────────── plan builders ─── */

type RawApiResponse = Record<string, unknown>

const PEAK_SLOTS: Record<Platform, Array<{ day: string; time: string; score: 'peak' | 'good' }>> = {
  facebook:  [
    { day: 'Mon', time: '9:00 AM',  score: 'good' },
    { day: 'Mon', time: '12:00 PM', score: 'peak' },
    { day: 'Wed', time: '1:00 PM',  score: 'peak' },
    { day: 'Thu', time: '3:00 PM',  score: 'peak' },
    { day: 'Fri', time: '1:00 PM',  score: 'good' },
    { day: 'Sat', time: '12:00 PM', score: 'good' },
  ],
  instagram: [
    { day: 'Mon', time: '11:00 AM', score: 'peak' },
    { day: 'Tue', time: '2:00 PM',  score: 'good' },
    { day: 'Wed', time: '11:00 AM', score: 'peak' },
    { day: 'Thu', time: '5:00 PM',  score: 'peak' },
    { day: 'Fri', time: '11:00 AM', score: 'peak' },
    { day: 'Sun', time: '10:00 AM', score: 'good' },
  ],
  linkedin:  [
    { day: 'Tue', time: '8:00 AM',  score: 'peak' },
    { day: 'Tue', time: '12:00 PM', score: 'peak' },
    { day: 'Wed', time: '9:00 AM',  score: 'peak' },
    { day: 'Thu', time: '8:00 AM',  score: 'good' },
    { day: 'Fri', time: '9:00 AM',  score: 'good' },
  ],
  youtube:   [
    { day: 'Tue', time: '3:00 PM',  score: 'good' },
    { day: 'Thu', time: '4:00 PM',  score: 'peak' },
    { day: 'Sat', time: '10:00 AM', score: 'peak' },
    { day: 'Sun', time: '2:00 PM',  score: 'peak' },
  ],
}

function makeAsset(
  counter: { n: number }, platform: Platform, type: AssetType,
  label: string, dims: string, desc: string, enabled = true,
): AssetSpec {
  return { id: `a${counter.n++}`, platform, type, label, dims, description: desc, enabled }
}

function buildSchedule(platforms: Platform[], peakOnly: boolean): ScheduledPost[] {
  const sched: ScheduledPost[] = []
  let n = 0
  const assetCycle: Record<Platform, AssetType[]> = {
    facebook:  ['feed_image', 'reel', 'story', 'carousel', 'ad_image'],
    instagram: ['feed_image', 'reel', 'story', 'carousel', 'ad_image'],
    linkedin:  ['feed_image', 'ad_image', 'blog_hero'],
    youtube:   ['short', 'reel', 'video_thumbnail'],
  }
  for (const platform of platforms) {
    const slots = peakOnly
      ? PEAK_SLOTS[platform].filter(s => s.score === 'peak')
      : PEAK_SLOTS[platform]
    const types = assetCycle[platform]
    slots.forEach((slot, i) => {
      sched.push({
        id: `s${n++}`, dayIndex: null, platform, dayLabel: slot.day, time: slot.time,
        assetType: types[i % types.length],
        label: ASSET_TYPE_LABELS[types[i % types.length]],
        peakScore: slot.score, enabled: true,
      })
    })
  }
  const dayOrder: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  return sched.sort((a, b) => (dayOrder[a.dayLabel] ?? 0) - (dayOrder[b.dayLabel] ?? 0))
}

const DAY_NAME_TO_DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function assignDayIndices(posts: ScheduledPost[], startDate = new Date()): ScheduledPost[] {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const usedCounts = new Map<string, number>()
  return posts.map(post => {
    const targetDow = DAY_NAME_TO_DOW[post.dayLabel]
    if (targetDow === undefined) return { ...post, dayIndex: null }
    const occurrences: number[] = []
    for (let d = 0; d < 30; d++) {
      const date = new Date(start)
      date.setDate(date.getDate() + d)
      if (date.getDay() === targetDow) occurrences.push(d)
    }
    const key = `${post.dayLabel}-${post.time}-${post.platform}`
    const count = usedCounts.get(key) ?? 0
    usedCounts.set(key, count + 1)
    return { ...post, dayIndex: occurrences[count % occurrences.length] ?? null }
  })
}

function buildVariantA(
  raw: RawApiResponse,
  prompt: string, goal: CampaignGoal, platforms: Platform[], duration: Duration,
): CampaignVariant {
  const headline  = (raw.headline  as string | undefined) ?? prompt.slice(0, 60)
  const body      = (raw.body      as string | undefined) ?? ''
  const hashtags  = (raw.hashtags  as string[] | undefined) ?? []
  const keywords  = (raw.keywords  as string[] | undefined) ?? hashtags.slice(0, 5)
  const durLabel  = DURATIONS.find(d => d.value === duration)?.label ?? duration

  const c = { n: 0 }
  const assets: AssetSpec[] = []

  if (platforms.includes('facebook')) {
    assets.push(
      makeAsset(c, 'facebook', 'cover_photo',   'Cover Photo',       '820 × 312',  'Branded page cover with campaign headline and brand colors'),
      makeAsset(c, 'facebook', 'profile_image', 'Profile Picture',   '170 × 170',  'Logo on transparent or brand-color background'),
      makeAsset(c, 'facebook', 'feed_image',    'Feed Posts ×4',     '1200 × 630', 'Four scroll-stopping campaign images with ad copy overlay'),
      makeAsset(c, 'facebook', 'reel',          'Facebook Reels ×3', '1080 × 1920','15–30s vertical videos: brand intro, offer, and urgency'),
      makeAsset(c, 'facebook', 'story',         'Stories ×6',        '1080 × 1920','Daily story sequence: teaser → reveal → offer → urgency → recap'),
      makeAsset(c, 'facebook', 'carousel',      'Carousel Ads ×2',   '1080 × 1080','3-card carousels: product showcase with individual CTAs per card'),
      makeAsset(c, 'facebook', 'ad_image',      'Ad Creatives ×3',   '1200 × 628', 'Feed and right-column ad images, WCAG-AA compliant text overlay'),
      makeAsset(c, 'facebook', 'ad_copy',       'Ad Copy Sets ×4',   '—',          'Headline + primary text + CTA for each audience segment, A/B ready'),
    )
  }
  if (platforms.includes('instagram')) {
    assets.push(
      makeAsset(c, 'instagram', 'profile_image', 'Profile Picture',  '320 × 320',  'Logo centered on brand-color circle background'),
      makeAsset(c, 'instagram', 'feed_image',    'Feed Grid ×9',     '1080 × 1080','Nine cohesive grid images: 3-row layout, alternating product + copy tiles'),
      makeAsset(c, 'instagram', 'reel',          'Reels ×4',         '1080 × 1920','15s, 30s, 60s, and 90s Reels: hook → value → CTA cadence'),
      makeAsset(c, 'instagram', 'story',         'Stories ×8',       '1080 × 1920','Daily story sets with polls, link stickers, countdown timers, quiz taps'),
      makeAsset(c, 'instagram', 'carousel',      'Carousels ×3',     '1080 × 1080','Swipeable before/after, multi-feature, and testimonial carousels'),
      makeAsset(c, 'instagram', 'ad_image',      'Ad Creatives ×3',  '1080 × 1080','Square ads for feed placement with punchy headline overlay'),
    )
  }
  if (platforms.includes('linkedin')) {
    assets.push(
      makeAsset(c, 'linkedin', 'cover_photo',   'Company Cover',        '1128 × 191', 'Professional banner: tagline + brand colors + logo placement'),
      makeAsset(c, 'linkedin', 'profile_image', 'Company Logo',         '300 × 300',  'Clean logo on white or brand-color background'),
      makeAsset(c, 'linkedin', 'feed_image',    'Feed Posts ×4',        '1200 × 627', 'Four value-led posts: stat card, story, tip, and urgent offer'),
      makeAsset(c, 'linkedin', 'ad_image',      'Sponsored Content ×3', '1200 × 627', 'High-converting sponsored creatives with lead form CTAs'),
      makeAsset(c, 'linkedin', 'carousel',      'Document Ad ×1',       '1080 × 1080','Scrollable document ad: 5-slide problem-solution framework'),
      makeAsset(c, 'linkedin', 'ad_copy',       'Ad Copy Sets ×2',      '—',          'LinkedIn-optimized copy: professional tone, benefit-first headlines'),
    )
  }
  if (platforms.includes('youtube')) {
    assets.push(
      makeAsset(c, 'youtube', 'channel_art',      'Channel Art',        '2560 × 1440','Full-bleed banner: TV, desktop, and mobile safe-zone optimized'),
      makeAsset(c, 'youtube', 'profile_image',    'Channel Icon',       '800 × 800',  'Logo on brand-color background with circular safe zone'),
      makeAsset(c, 'youtube', 'video_thumbnail',  'Thumbnails ×5',      '1280 × 720', 'CTR-optimized: bold text + face/product + brand color blocking'),
      makeAsset(c, 'youtube', 'short',            'YouTube Shorts ×3',  '1080 × 1920','15s, 30s, and 60s Shorts with hook in first 3 seconds'),
      makeAsset(c, 'youtube', 'reel',             'Long-form Videos ×2','1920 × 1080','3–5 min videos: problem → solution → offer narrative structure'),
      makeAsset(c, 'youtube', 'ad_copy',          'Ad Scripts ×2',      '—',          '6s bumper + 30s skippable ad scripts with strong pattern interrupts'),
    )
  }

  const schedule = assignDayIndices(buildSchedule(platforms, false))
  const hashtagsByPlatform: Partial<Record<Platform, string[]>> = {}
  for (const p of platforms) hashtagsByPlatform[p] = hashtags.slice(0, p === 'instagram' ? 30 : 10)

  const cta = goal === 'sale_offer' ? 'Shop Now' : goal === 'lead_generation' ? 'Get Started Free' : goal === 'event_promotion' ? 'Register Now' : goal === 'product_launch' ? 'Try It Now' : 'Learn More'

  return {
    variantId: 'A',
    strategyName: 'Volume & Velocity',
    strategyTagline: 'Maximum reach. Daily presence. Built to dominate the feed.',
    approachIcon: '⚡',
    differentiators: [
      'Daily posting cadence across all selected platforms',
      'Short-form video priority: Reels, Shorts, and Stories at scale',
      'Paid ad creative sets with A/B headline and image variants',
      'All peak traffic slots scheduled — nothing left on the table',
    ],
    postsPerWeek: platforms.length >= 3 ? '18–24' : platforms.length === 2 ? '12–16' : '6–10',
    contentPillars: ['Brand Story', 'Product Features', 'Social Proof', 'Urgency & Offers'],
    audiencePersona: `High-intent buyers and brand-aware prospects ready to convert — reached at maximum frequency across ${platforms.length} platforms.`,
    kpis: ['Impressions & reach', 'Click-through rate (CTR)', 'Cost per acquisition (CPA)', 'Story completion rate', 'Reel views & shares'],
    budgetTier: 'medium_spend',
    campaignName: `${GOALS.find(g => g.value === goal)?.label ?? goal} — Volume & Velocity (${durLabel})`,
    summary: body.slice(0, 200) || `High-frequency ${durLabel.toLowerCase()} campaign across ${platforms.length} platforms — every peak slot, every format.`,
    platforms, duration,
    totalAssets: assets.length,
    totalPosts: schedule.length,
    estimatedReach: platforms.length >= 3 ? '25K–80K' : platforms.length === 2 ? '12K–35K' : '5K–15K',
    assets, schedule,
    seo: {
      focusKeywords: keywords,
      hashtagsByPlatform,
      blogPostTitle: headline,
      blogPostOutline: [
        'Hook — Bold stat or provocative question that stops the scroll',
        'Problem — What your audience is struggling with right now',
        'Solution — How your offering solves it, with proof',
        'Social Proof — Customer wins, reviews, and case studies',
        'Offer — Clear CTA with urgency and scarcity',
      ],
      metaDescription: body.slice(0, 160),
    },
    adCopy: platforms.map(platform => ({
      platform,
      headline: headline.slice(0, platform === 'linkedin' ? 70 : 60),
      body: body.slice(0, platform === 'linkedin' ? 150 : platform === 'facebook' ? 125 : 90),
      cta,
    })),
  }
}

function buildVariantB(
  raw: RawApiResponse,
  prompt: string, goal: CampaignGoal, platforms: Platform[], duration: Duration,
): CampaignVariant {
  const headline  = (raw.headline  as string | undefined) ?? prompt.slice(0, 60)
  const body      = (raw.body      as string | undefined) ?? ''
  const hashtags  = (raw.hashtags  as string[] | undefined) ?? []
  const keywords  = (raw.keywords  as string[] | undefined) ?? hashtags.slice(0, 5)
  const goalLabel = GOALS.find(g => g.value === goal)?.label ?? goal
  const durLabel  = DURATIONS.find(d => d.value === duration)?.label ?? duration

  const c = { n: 0 }
  const assets: AssetSpec[] = []

  if (platforms.includes('facebook')) {
    assets.push(
      makeAsset(c, 'facebook', 'cover_photo',  'Cover Photo',      '820 × 312',  'Thought leadership banner — clean, editorial, whitespace-forward'),
      makeAsset(c, 'facebook', 'feed_image',   'Deep-Dive Posts ×3','1200 × 630','Three high-value posts: data insight, story, and definitive guide'),
      makeAsset(c, 'facebook', 'carousel',     'Story Carousel ×1','1080 × 1080','5-slide carousel: hero narrative with rich data visualizations'),
      makeAsset(c, 'facebook', 'blog_hero',    'Facebook Article ×1','1200 × 630','Long-form Facebook article with full thought leadership piece'),
      makeAsset(c, 'facebook', 'ad_copy',      'Ad Copy Sets ×2',  '—',          'Long-copy educational ads — awareness and consideration stages'),
    )
  }
  if (platforms.includes('instagram')) {
    assets.push(
      makeAsset(c, 'instagram', 'profile_image','Profile Picture', '320 × 320',  'Clean logo with editorial feel — light background, precise spacing'),
      makeAsset(c, 'instagram', 'feed_image',   'Feed Posts ×6',  '1080 × 1080','Six curated grid posts with editorial consistency and strong typography'),
      makeAsset(c, 'instagram', 'reel',         'Reels ×2',       '1080 × 1920','60s and 90s educational Reels: tutorial or expert breakdown format'),
      makeAsset(c, 'instagram', 'carousel',     'Carousels ×3',   '1080 × 1080','Deep-dive carousels: how-to guides, myth-busting, and stat breakdowns'),
      makeAsset(c, 'instagram', 'story',        'Story Sets ×3',  '1080 × 1920','Curated story sets: Q&A, poll, and behind-the-scenes drops'),
    )
  }
  if (platforms.includes('linkedin')) {
    assets.push(
      makeAsset(c, 'linkedin', 'cover_photo',   'Company Cover',        '1128 × 191','Authority-positioning banner: industry credential + clean editorial'),
      makeAsset(c, 'linkedin', 'profile_image', 'Company Logo',         '300 × 300', 'Professional logo on neutral or white background'),
      makeAsset(c, 'linkedin', 'feed_image',    'Thought Leadership ×5','1200 × 627','Five expert posts: data report, opinion piece, how-to, case study, prediction'),
      makeAsset(c, 'linkedin', 'blog_hero',     'Articles ×2',          '1200 × 644','Two long-form thought leadership articles with branded hero images'),
      makeAsset(c, 'linkedin', 'carousel',      'Document Ads ×2',      '1080 × 1080','PDF-style document carousels: whitepaper summary and step-by-step guide'),
      makeAsset(c, 'linkedin', 'ad_copy',       'Sponsored Posts ×2',   '—',          'Credibility-first copy with data hooks and expert positioning'),
    )
  }
  if (platforms.includes('youtube')) {
    assets.push(
      makeAsset(c, 'youtube', 'channel_art',     'Channel Art',        '2560 × 1440','Editorial banner with authority positioning tagline'),
      makeAsset(c, 'youtube', 'profile_image',   'Channel Icon',       '800 × 800',  'Clean logo — recognizable at small sizes across all devices'),
      makeAsset(c, 'youtube', 'video_thumbnail', 'Thumbnails ×3',      '1280 × 720', 'Authority thumbnails: expert pose, data callout, clean typography'),
      makeAsset(c, 'youtube', 'reel',            'Deep-Dive Videos ×3','1920 × 1080','8–15 min authoritative videos: masterclass, case study, and ultimate guide'),
      makeAsset(c, 'youtube', 'short',           'YouTube Shorts ×2',  '1080 × 1920','60s value-packed micro-lessons from the long-form content'),
      makeAsset(c, 'youtube', 'ad_copy',         'Video Ad Scripts ×1','—',          '90s non-skippable pre-roll script: story-driven, soft CTA'),
    )
  }

  const schedule = assignDayIndices(buildSchedule(platforms, true)) // peak slots only = fewer posts
  const hashtagsByPlatform: Partial<Record<Platform, string[]>> = {}
  for (const p of platforms) hashtagsByPlatform[p] = hashtags.slice(0, p === 'instagram' ? 12 : 5)

  const cta = goal === 'lead_generation' ? 'Download Free Guide' : goal === 'content_marketing' ? 'Read the Full Story' : goal === 'product_launch' ? 'See How It Works' : 'Explore More'

  return {
    variantId: 'B',
    strategyName: 'Authority & Trust',
    strategyTagline: 'Quality over quantity. Own the conversation. Earn trust at scale.',
    approachIcon: '◆',
    differentiators: [
      'Selective posting at peak slots only — never noise, always signal',
      'Long-form content: deep-dive videos, articles, and expert carousels',
      'Organic SEO and keyword discoverability at the core',
      'Community-first: conversation starters, Q&As, and expert positioning',
    ],
    postsPerWeek: platforms.length >= 3 ? '9–14' : platforms.length === 2 ? '6–9' : '3–5',
    contentPillars: ['Expert Insights', 'Problem → Solution', 'Community Stories', 'Industry Trends'],
    audiencePersona: `Informed decision-makers and brand-aware research-mode buyers who reward expertise and depth over frequency.`,
    kpis: ['Organic reach & impressions', 'Engagement rate (saves/shares)', 'Follower growth rate', 'Profile visits from content', 'Inbound inquiries'],
    budgetTier: 'organic',
    campaignName: `${goalLabel} — Authority & Trust (${durLabel})`,
    summary: body.slice(0, 200) || `A curated ${durLabel.toLowerCase()} strategy across ${platforms.length} platforms — fewer posts, bigger impact, lasting authority.`,
    platforms, duration,
    totalAssets: assets.length,
    totalPosts: schedule.length,
    estimatedReach: platforms.length >= 3 ? '15K–50K' : platforms.length === 2 ? '8K–25K' : '3K–12K',
    assets, schedule,
    seo: {
      focusKeywords: keywords,
      hashtagsByPlatform,
      blogPostTitle: `The Complete Guide to ${headline}`,
      blogPostOutline: [
        'Introduction — Why this matters right now (industry context)',
        'The Core Problem — What most people get wrong',
        'Deep Dive — Your authoritative framework or methodology',
        'Real-World Proof — Case studies and specific data',
        'Implementation — Step-by-step action plan for the reader',
        'Conclusion — The future state and your unique perspective',
      ],
      metaDescription: body.slice(0, 160),
    },
    adCopy: platforms.map(platform => ({
      platform,
      headline: platform === 'linkedin'
        ? `The Expert's Approach to ${headline.slice(0, 50)}`
        : `How Smart ${headline.slice(0, 45)} Works`,
      body: platform === 'linkedin'
        ? `Most companies approach this wrong. Here's the data-backed framework that ${goalLabel.toLowerCase()}s at 3× the industry average.`
        : `Stop guessing. Here's the proven approach that ${goalLabel.toLowerCase()} without the wasted spend.`,
      cta,
    })),
  }
}

function getRecommendedVariant(goal: CampaignGoal): 'A' | 'B' {
  return ['brand_awareness', 'sale_offer', 'event_promotion', 'product_launch'].includes(goal) ? 'A' : 'B'
}

/* ─────────────────────────────────────────── sub-components ─── */

function GoalCard({ goal, selected, onSelect }: { goal: typeof GOALS[0]; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={`co-goal-card${selected ? ' co-goal-card--selected' : ''}`} onClick={onSelect}>
      <span className="co-goal-icon">{goal.icon}</span>
      <span className="co-goal-label">{goal.label}</span>
      <span className="co-goal-desc">{goal.desc}</span>
    </button>
  )
}

function PlatformToggle({ platform, selected, onToggle }: { platform: Platform; selected: boolean; onToggle: () => void }) {
  const m = PLATFORM_META[platform]
  return (
    <button
      type="button"
      className={`co-platform-toggle${selected ? ' co-platform-toggle--on' : ''}`}
      style={selected ? { '--p-color': m.color, '--p-bg': m.bg } as React.CSSProperties : {}}
      onClick={onToggle}
    >
      <span className="co-platform-icon" style={selected ? { background: m.color, color: '#fff' } : {}}>{m.icon}</span>
      <span className="co-platform-name">{m.label}</span>
      {selected && <span className="co-platform-check" style={{ color: m.color }}>✓</span>}
    </button>
  )
}

function VariantCard({ variant, isRecommended, onChoose }: {
  variant: CampaignVariant; isRecommended: boolean; onChoose: () => void
}) {
  const isA = variant.variantId === 'A'
  const accentColor = isA ? '#7C3AED' : '#059669'
  const accentLight = isA ? '#F5F3FF' : '#ECFDF5'

  return (
    <div className={`co-variant-card co-variant-card--${variant.variantId}`} style={{ '--v-accent': accentColor, '--v-light': accentLight } as React.CSSProperties}>
      {isRecommended && (
        <div className="co-variant-rec-badge" style={{ background: accentColor }}>
          ★ Recommended for your goal
        </div>
      )}
      <div className="co-variant-header">
        <div className="co-variant-id-badge" style={{ background: accentColor }}>
          Plan {variant.variantId}
        </div>
        <div className="co-variant-icon">{variant.approachIcon}</div>
        <h3 className="co-variant-name" style={{ color: accentColor }}>{variant.strategyName}</h3>
        <p className="co-variant-tagline">{variant.strategyTagline}</p>
      </div>

      <div className="co-variant-stats-row">
        <div className="co-variant-stat">
          <span className="co-variant-stat-value">{variant.totalAssets}</span>
          <span className="co-variant-stat-label">Assets</span>
        </div>
        <div className="co-variant-stat-divider" />
        <div className="co-variant-stat">
          <span className="co-variant-stat-value">{variant.postsPerWeek}</span>
          <span className="co-variant-stat-label">Posts/week</span>
        </div>
        <div className="co-variant-stat-divider" />
        <div className="co-variant-stat">
          <span className="co-variant-stat-value">{variant.estimatedReach}</span>
          <span className="co-variant-stat-label">Est. reach</span>
        </div>
        <div className="co-variant-stat-divider" />
        <div className="co-variant-stat">
          <span className="co-variant-stat-value">{variant.budgetTier === 'organic' ? '$0' : variant.budgetTier === 'low_spend' ? '$' : '$$'}</span>
          <span className="co-variant-stat-label">Ad spend</span>
        </div>
      </div>

      <div className="co-variant-section">
        <div className="co-variant-section-label">Approach</div>
        <ul className="co-variant-differentiators">
          {variant.differentiators.map((d, i) => (
            <li key={i} className="co-variant-diff-item">
              <span className="co-variant-diff-dot" style={{ background: accentColor }} />
              {d}
            </li>
          ))}
        </ul>
      </div>

      <div className="co-variant-section">
        <div className="co-variant-section-label">Content Pillars</div>
        <div className="co-variant-pillars">
          {variant.contentPillars.map(p => (
            <span key={p} className="co-variant-pillar" style={{ borderColor: accentColor, color: accentColor }}>{p}</span>
          ))}
        </div>
      </div>

      <div className="co-variant-section">
        <div className="co-variant-section-label">What You'll Track</div>
        <div className="co-variant-kpis">
          {variant.kpis.map(k => (
            <span key={k} className="co-variant-kpi">{k}</span>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="co-variant-choose-btn"
        style={{ background: accentColor }}
        onClick={onChoose}
      >
        Choose Plan {variant.variantId} — {variant.strategyName} →
      </button>
    </div>
  )
}

/* ─────────────────────────────────────────── main component ─── */

type Step = 'input' | 'generating' | 'comparing' | 'plan'

export function CampaignOrchestrator() {
  const { theme } = useBrandTheme()
  const { displayName, logoUrl, primaryHex } = theme

  const [step, setStep]           = useState<Step>('input')
  const [prompt, setPrompt]       = useState('')
  const [goal, setGoal]           = useState<CampaignGoal>('brand_awareness')
  const [duration, setDuration]   = useState<Duration>('2_weeks')
  const [platforms, setPlatforms] = useState<Set<Platform>>(new Set(['facebook', 'instagram', 'linkedin', 'youtube'] as Platform[]))
  const [variants, setVariants]   = useState<[CampaignVariant, CampaignVariant] | null>(null)
  const [plan, setPlan]           = useState<CampaignVariant | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)
  const [launched, setLaunched]   = useState(false)
  const [calendarPosts, setCalendarPosts] = useState<ScheduledPost[]>([])

  const planRef     = useRef<HTMLDivElement>(null)
  const comparingRef = useRef<HTMLDivElement>(null)

  const togglePlatform = useCallback((p: Platform) => {
    setPlatforms(prev => {
      const next = new Set(prev)
      if (next.has(p)) { if (next.size > 1) next.delete(p) }
      else next.add(p)
      return next
    })
  }, [])

  const handlePostsChange = useCallback((newPosts: ScheduledPost[]) => {
    setCalendarPosts(newPosts)
  }, [])

  const generate = useCallback(async () => {
    if (!prompt.trim()) { setError('Describe your business or campaign first.'); return }
    setError(null)
    setStep('generating')
    setLaunched(false)

    const goalLabel = GOALS.find(g => g.value === goal)?.label ?? goal
    const durLabel  = DURATIONS.find(d => d.value === duration)?.label ?? duration
    const brandCtx  = displayName ? `Brand: ${displayName}. ` : ''

    const res = await apiFetch<{ headline?: string; body?: string; cta?: string; hashtags?: string[]; keywords?: string[] }>(
      `${DRAFT_API}/api/marketer-pro/generation/draft-from-brief`,
      {
        method: 'POST',
        json: {
          topic: prompt.trim(),
          tone: 'enthusiastic',
          brandContext: `${brandCtx}Campaign goal: ${goalLabel}. Duration: ${durLabel}. Platforms: ${Array.from(platforms).join(', ')}.`,
          platforms: Array.from(platforms),
        },
      },
    )

    if (res.ok === false) {
      setError(`Generation failed: ${res.error}`)
      setStep('input')
      return
    }

    const raw = res.data as Record<string, unknown>
    const pArr = Array.from(platforms)
    const varA = buildVariantA(raw, prompt.trim(), goal, pArr, duration)
    const varB = buildVariantB(raw, prompt.trim(), goal, pArr, duration)
    setVariants([varA, varB])
    setStep('comparing')
    setTimeout(() => comparingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
  }, [prompt, goal, duration, platforms, displayName])

  const choosePlan = useCallback((v: CampaignVariant) => {
    setPlan(v)
    setCalendarPosts(v.schedule)
    setStep('plan')
    setTimeout(() => planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
  }, [])

  const launchCampaign = useCallback(async () => {
    if (!plan) return
    setLaunching(true)
    await apiFetch(`${AUTONOMY_API}/api/autonomous/start`, {
      method: 'POST',
      json: {
        platforms: plan.platforms,
        scope: 'full_campaign',
        strategy: plan.variantId === 'A' ? 'volume_velocity' : 'authority_trust',
        brief: {
          topic: prompt, goal, duration: plan.duration,
          totalAssets: plan.totalAssets, totalPosts: plan.totalPosts,
          contentPillars: plan.contentPillars,
          schedule: calendarPosts.filter(s => s.dayIndex !== null),
          assets: plan.assets.filter(a => a.enabled),
          seo: plan.seo, adCopy: plan.adCopy,
        },
      },
    })
    setLaunching(false)
    setLaunched(true)
  }, [plan, calendarPosts, prompt, goal])

  const reset = useCallback(() => {
    setStep('input'); setVariants(null); setPlan(null); setCalendarPosts([]); setLaunched(false)
  }, [])

  /* ── step: input ─── */
  if (step === 'input') {
    return (
      <div className="co-root">
        <div className="co-hero">
          <div className="co-hero-badge">✦ Campaign Orchestrator</div>
          <h2 className="co-hero-title">
            Your entire marketing campaign.<br />
            <span className="co-hero-title-accent">One prompt. Two strategies.</span>
          </h2>
          <p className="co-hero-sub">
            Describe what you want to promote. We'll generate two complete, ready-to-launch
            campaign strategies — Reels, feed posts, ad copy, cover photos, scheduled at peak
            traffic times across Facebook, Instagram, LinkedIn, and YouTube. You pick your approach.
          </p>
        </div>

        <div className="co-form">
          <div className="co-field">
            <label className="co-label">Tell us what you want to promote *</label>
            <textarea className="co-textarea" value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
              placeholder={`Examples:\n"30% off summer sale — women's activewear brand, targeting 25–40 female fitness enthusiasts in Portland"\n\n"Launching an AI productivity app for freelancers — emphasize time savings and integrations"`}
              maxLength={1000} />
            <div className="co-textarea-count">{prompt.length}/1000</div>
          </div>

          <div className="co-field">
            <label className="co-label">Campaign goal *</label>
            <div className="co-goal-grid">
              {GOALS.map(g => <GoalCard key={g.value} goal={g} selected={goal === g.value} onSelect={() => setGoal(g.value)} />)}
            </div>
          </div>

          <div className="co-field">
            <label className="co-label">Campaign duration</label>
            <div className="co-duration-row">
              {DURATIONS.map(d => (
                <button key={d.value} type="button"
                  className={`co-duration-btn${duration === d.value ? ' co-duration-btn--active' : ''}`}
                  onClick={() => setDuration(d.value)}>
                  <span className="co-duration-label">{d.label}</span>
                  <span className="co-duration-posts">{d.posts}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="co-field">
            <label className="co-label">Platforms</label>
            <div className="co-platform-row">
              {(['facebook', 'instagram', 'linkedin', 'youtube'] as Platform[]).map(p => (
                <PlatformToggle key={p} platform={p} selected={platforms.has(p)} onToggle={() => togglePlatform(p)} />
              ))}
            </div>
            <p className="co-platform-note">
              {platforms.size} platform{platforms.size !== 1 ? 's' : ''} selected
              · Est. reach <strong>{platforms.size >= 3 ? '15K–80K' : platforms.size === 2 ? '8K–35K' : '3K–15K'} people</strong>
            </p>
          </div>

          {error && <div className="co-error">{error}</div>}

          <button type="button" className="co-launch-btn" onClick={generate} disabled={!prompt.trim() || platforms.size === 0}>
            <span className="co-launch-icon">✦</span>
            Generate My Two Campaign Strategies
            <span className="co-launch-arrow">→</span>
          </button>

          <p className="co-disclaimer">
            We generate two complete strategies for you to choose from. Nothing posts without your review and approval.
          </p>
        </div>
      </div>
    )
  }

  /* ── step: generating ─── */
  if (step === 'generating') {
    const genSteps = [
      { label: 'Analyzing your business brief', done: true },
      { label: 'Building SEO keyword strategy', done: true },
      { label: 'Designing Strategy A: Volume & Velocity', done: false },
      { label: 'Designing Strategy B: Authority & Trust', done: false },
      { label: 'Scheduling peak traffic windows', done: false },
      { label: 'Crafting platform-specific copy sets', done: false },
      { label: 'Assembling both campaign plans', done: false },
    ]
    return (
      <div className="co-root co-root--generating">
        <div className="co-gen-spinner">
          <div className="co-gen-ring" />
          <div className="co-gen-logo">
            {logoUrl ? <img src={logoUrl} alt="" className="co-gen-logo-img" /> : <span style={{ color: primaryHex ?? 'var(--accent)' }}>✦</span>}
          </div>
        </div>
        <h2 className="co-gen-title">Building your strategies…</h2>
        <p className="co-gen-sub">Sit back. We've got this.</p>
        <div className="co-gen-steps">
          {genSteps.map((s, i) => (
            <div key={i} className={`co-gen-step${s.done ? ' co-gen-step--done' : i === genSteps.findIndex(x => !x.done) ? ' co-gen-step--active' : ''}`}>
              <span className="co-gen-step-dot" />
              {s.label}
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ── step: comparing ─── */
  if (step === 'comparing' && variants) {
    const rec = getRecommendedVariant(goal)
    return (
      <div className="co-root" ref={comparingRef}>
        <div className="co-comparing-hero">
          <div className="co-hero-badge">✦ Two strategies built for your campaign</div>
          <h2 className="co-comparing-title">Choose your approach</h2>
          <p className="co-comparing-sub">
            Both plans are fully built — assets, schedule, SEO, and ad copy. Pick the strategy that fits
            your goals, then review and customize every detail before launch.
          </p>
        </div>

        <div className="co-variants-grid">
          {variants.map(v => (
            <VariantCard key={v.variantId} variant={v} isRecommended={v.variantId === rec} onChoose={() => choosePlan(v)} />
          ))}
        </div>

        <div className="co-comparing-footer">
          <button type="button" className="co-comparing-back" onClick={reset}>← Change Brief</button>
          <p className="co-comparing-note">
            You can edit any detail — assets, schedule, copy — after choosing a strategy.
          </p>
        </div>
      </div>
    )
  }

  /* ── step: plan ─── */
  if (!plan) return null
  return (
    <CampaignCalendar
      posts={calendarPosts}
      platforms={plan.platforms}
      campaignName={plan.campaignName}
      totalAssets={plan.totalAssets}
      assets={plan.assets}
      seo={plan.seo}
      adCopy={plan.adCopy}
      onPostsChange={handlePostsChange}
      onLaunch={launchCampaign}
      launching={launching}
      launched={launched}
      onSwitchStrategy={() => { setStep('comparing'); setPlan(null); setCalendarPosts([]) }}
      onNewCampaign={reset}
      variantId={plan.variantId}
      strategyName={plan.strategyName}
    />
  )
}
