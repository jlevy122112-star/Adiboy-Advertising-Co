/**
 * Campaign Orchestrator — "Sit back. We got this."
 *
 * The user describes their business + goal in plain language.
 * The AI returns a complete, ready-to-execute cross-platform marketing
 * campaign plan: schedule, assets, SEO strategy, peak-time slots, ad copy.
 * The user reviews, optionally edits, then hits Launch.
 *
 * Platforms: Facebook · Instagram · LinkedIn · YouTube
 */

import { useState, useCallback, useRef } from 'react'
import { useBrandTheme } from '../BrandThemePanel'
import { apiFetch } from '../hooks/useApi'
import './campaign-orchestrator.css'

const DRAFT_API     = (import.meta.env.VITE_CAMPAIGN_API_ORIGIN    as string | undefined) ?? 'http://localhost:8801'
const SERP_API      = (import.meta.env.VITE_SERP_API_ORIGIN        as string | undefined) ?? 'http://localhost:8802'
const AUTONOMY_API  = (import.meta.env.VITE_AUTONOMOUS_API_ORIGIN  as string | undefined) ?? 'http://localhost:8805'
const PREDICTIVE_API = (import.meta.env.VITE_PREDICTIVE_API_ORIGIN as string | undefined) ?? 'http://localhost:8804'

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type CampaignGoal =
  | 'brand_awareness'
  | 'lead_generation'
  | 'product_launch'
  | 'event_promotion'
  | 'sale_offer'
  | 'content_marketing'

type Duration = '1_week' | '2_weeks' | '1_month'
type Platform = 'facebook' | 'instagram' | 'linkedin' | 'youtube'

interface AssetSpec {
  id: string
  platform: Platform
  type: AssetType
  label: string
  dims: string
  description: string
  enabled: boolean
}

type AssetType =
  | 'feed_image'
  | 'reel'
  | 'story'
  | 'cover_photo'
  | 'profile_image'
  | 'ad_image'
  | 'ad_copy'
  | 'carousel'
  | 'video_thumbnail'
  | 'channel_art'
  | 'blog_hero'
  | 'short'

interface ScheduledPost {
  id: string
  platform: Platform
  dayLabel: string
  time: string
  assetType: AssetType
  label: string
  peakScore: 'peak' | 'good' | 'standard'
  enabled: boolean
}

interface SeoStrategy {
  focusKeywords: string[]
  hashtagsByPlatform: Partial<Record<Platform, string[]>>
  blogPostTitle: string
  blogPostOutline: string[]
  metaDescription: string
}

interface CampaignPlan {
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
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

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

const PLATFORM_META: Record<Platform, { label: string; color: string; bg: string; icon: string }> = {
  facebook:  { label: 'Facebook',  color: '#1877F2', bg: '#E7F0FF', icon: 'f' },
  instagram: { label: 'Instagram', color: '#d6249f', bg: '#FDE8F7', icon: '◈' },
  linkedin:  { label: 'LinkedIn',  color: '#0A66C2', bg: '#E6F0FA', icon: 'in' },
  youtube:   { label: 'YouTube',   color: '#FF0000', bg: '#FFE9E9', icon: '▶' },
}

const ASSET_TYPE_ICONS: Record<AssetType, string> = {
  feed_image:    '🖼',
  reel:          '🎬',
  story:         '📱',
  cover_photo:   '🏞',
  profile_image: '👤',
  ad_image:      '📣',
  ad_copy:       '✍',
  carousel:      '🎠',
  video_thumbnail: '🎯',
  channel_art:   '🎨',
  blog_hero:     '📄',
  short:         '⚡',
}

/* -------------------------------------------------------------------------- */
/*  Plan builder (client-side scaffold, enriched by API response)             */
/* -------------------------------------------------------------------------- */

function buildPlanFromApiResponse(
  raw: Record<string, unknown>,
  prompt: string,
  goal: CampaignGoal,
  platforms: Platform[],
  duration: Duration,
): CampaignPlan {
  const goalLabel = GOALS.find(g => g.value === goal)?.label ?? goal
  const durLabel  = DURATIONS.find(d => d.value === duration)?.label ?? duration

  const headline   = (raw.headline   as string | undefined) ?? prompt.slice(0, 60)
  const body       = (raw.body       as string | undefined) ?? ''
  const hashtags   = (raw.hashtags   as string[] | undefined) ?? []
  const keywords   = (raw.keywords   as string[] | undefined) ?? hashtags.slice(0, 5)

  // Build per-platform asset specs
  const assets: AssetSpec[] = []
  let assetIdx = 0
  const mk = (platform: Platform, type: AssetType, label: string, dims: string, desc: string): AssetSpec => ({
    id: `a${assetIdx++}`, platform, type, label, dims, description: desc, enabled: true,
  })

  if (platforms.includes('facebook')) {
    assets.push(
      mk('facebook', 'cover_photo',  'Cover Photo',        '820 × 312',  'Branded page cover showcasing your campaign headline'),
      mk('facebook', 'profile_image','Profile Picture',    '170 × 170',  'Logo on transparent or brand-color background'),
      mk('facebook', 'feed_image',   'Feed Post ×3',       '1200 × 630', 'Three scroll-stopping campaign images with ad copy overlay'),
      mk('facebook', 'reel',         'Facebook Reel ×2',   '1080 × 1920','15–30s vertical video with brand intro and offer'),
      mk('facebook', 'carousel',     'Carousel Ad',        '1080 × 1080','3-card carousel: product/feature showcase with individual CTAs'),
      mk('facebook', 'ad_image',     'Ad Creative ×2',     '1200 × 628', 'Right-column and feed ad images, WCAG-AA compliant text overlay'),
      mk('facebook', 'ad_copy',      'Ad Copy Sets ×3',    '—',          'Headline + primary text + CTA for each audience segment'),
      mk('facebook', 'story',        'Stories ×4',         '1080 × 1920','Daily story sequence: teaser → reveal → offer → urgency'),
    )
  }

  if (platforms.includes('instagram')) {
    assets.push(
      mk('instagram', 'profile_image','Profile Picture',   '320 × 320',  'Logo centered on brand-color circle background'),
      mk('instagram', 'feed_image',  'Feed Grid ×6',       '1080 × 1080','Six cohesive feed images: alternating product + copy tiles'),
      mk('instagram', 'reel',        'Reels ×3',           '1080 × 1920','15s, 30s, and 60s Reels: hook → value → CTA structure'),
      mk('instagram', 'story',       'Stories ×6',         '1080 × 1920','Daily story set with polls, link stickers, and countdown timers'),
      mk('instagram', 'carousel',    'Carousel ×2',        '1080 × 1080','Swipeable before/after or multi-feature carousels'),
      mk('instagram', 'ad_image',    'Ad Creatives ×3',    '1080 × 1080','Square ads for feed placement with punchy headline overlay'),
    )
  }

  if (platforms.includes('linkedin')) {
    assets.push(
      mk('linkedin', 'cover_photo',  'Company Cover',      '1128 × 191', 'Professional banner: tagline + brand colors + logo'),
      mk('linkedin', 'profile_image','Company Logo',       '300 × 300',  'Clean logo on white or brand-color background'),
      mk('linkedin', 'feed_image',   'Feed Posts ×4',      '1200 × 627', 'Four value-lead posts: stat, story, tip, and offer'),
      mk('linkedin', 'ad_image',     'Sponsored Content ×2','1200 × 627','High-converting sponsored post creatives with lead form CTAs'),
      mk('linkedin', 'blog_hero',    'Article Hero ×1',    '1200 × 644', 'Thought leadership article with branded hero image'),
      mk('linkedin', 'ad_copy',      'Ad Copy Sets ×2',    '—',          'LinkedIn-optimized copy: professional tone, benefit-first headlines'),
    )
  }

  if (platforms.includes('youtube')) {
    assets.push(
      mk('youtube', 'channel_art',   'Channel Art',        '2560 × 1440','Full-bleed banner: optimized for TV, desktop, and mobile safe zones'),
      mk('youtube', 'profile_image', 'Channel Icon',       '800 × 800',  'Logo on brand-color background, circular safe zone'),
      mk('youtube', 'video_thumbnail','Thumbnails ×4',     '1280 × 720', 'CTR-optimized thumbnails: bold text + face/product + brand color'),
      mk('youtube', 'short',         'YouTube Shorts ×2',  '1080 × 1920','15s and 60s Shorts with hook in first 3 seconds'),
      mk('youtube', 'reel',          'Long-form Video ×1', '1920 × 1080','3–5 min brand story video: problem → solution → offer structure'),
      mk('youtube', 'ad_copy',       'Video Ad Scripts ×2','—',          '6s bumper ad + 30s skippable ad scripts with strong hooks'),
    )
  }

  // Build schedule (peak times per platform, spaced across duration)
  const schedule: ScheduledPost[] = []
  const peakSlots: Record<Platform, Array<{ day: string; time: string; score: 'peak' | 'good' }>> = {
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

  const assetTypeByPlatform: Record<Platform, AssetType[]> = {
    facebook:  ['feed_image', 'reel', 'story', 'carousel', 'ad_image'],
    instagram: ['feed_image', 'reel', 'story', 'carousel', 'ad_image'],
    linkedin:  ['feed_image', 'ad_image', 'blog_hero'],
    youtube:   ['short', 'reel', 'video_thumbnail'],
  }

  const assetTypeLabels: Record<AssetType, string> = {
    feed_image: 'Feed Post', reel: 'Reel', story: 'Story',
    cover_photo: 'Cover Photo', profile_image: 'Profile Image',
    ad_image: 'Ad Creative', ad_copy: 'Ad Copy', carousel: 'Carousel',
    video_thumbnail: 'Thumbnail', channel_art: 'Channel Art',
    blog_hero: 'Article', short: 'Short',
  }

  let schedIdx = 0
  for (const platform of platforms) {
    const slots = peakSlots[platform] ?? []
    const types = assetTypeByPlatform[platform] ?? ['feed_image']
    slots.forEach((slot, i) => {
      schedule.push({
        id: `s${schedIdx++}`,
        platform,
        dayLabel: slot.day,
        time: slot.time,
        assetType: types[i % types.length],
        label: assetTypeLabels[types[i % types.length]],
        peakScore: slot.score,
        enabled: true,
      })
    })
  }

  // Sort schedule by day order
  const dayOrder: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  schedule.sort((a, b) => (dayOrder[a.dayLabel] ?? 0) - (dayOrder[b.dayLabel] ?? 0))

  // SEO strategy
  const hashtagsByPlatform: Partial<Record<Platform, string[]>> = {}
  for (const platform of platforms) {
    const base = hashtags.slice(0, platform === 'instagram' ? 30 : platform === 'youtube' ? 15 : 10)
    hashtagsByPlatform[platform] = base
  }

  const seo: SeoStrategy = {
    focusKeywords: keywords,
    hashtagsByPlatform,
    blogPostTitle: headline,
    blogPostOutline: [
      'Introduction — Hook with a bold stat or question',
      'Problem — What your audience is struggling with',
      'Solution — How your product/service solves it',
      'Proof — Case study, testimonials, or data',
      'Offer — Clear CTA with urgency',
    ],
    metaDescription: body.slice(0, 160),
  }

  // Ad copy
  const adCopy = platforms.flatMap(platform => [{
    platform,
    headline: headline.slice(0, 60),
    body: body.slice(0, platform === 'linkedin' ? 150 : 90),
    cta: goal === 'sale_offer' ? 'Shop Now' : goal === 'lead_generation' ? 'Get Started' : goal === 'event_promotion' ? 'Register Now' : 'Learn More',
  }])

  return {
    campaignName: `${goalLabel} Campaign — ${durLabel}`,
    summary: body.slice(0, 200) || `AI-crafted ${durLabel.toLowerCase()} ${goalLabel.toLowerCase()} campaign across ${platforms.length} platforms.`,
    platforms,
    duration,
    totalAssets: assets.filter(a => a.enabled).length,
    totalPosts: schedule.filter(s => s.enabled).length,
    estimatedReach: platforms.length >= 3 ? '12K–48K' : platforms.length === 2 ? '6K–22K' : '3K–10K',
    assets,
    schedule,
    seo,
    adCopy,
  }
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function GoalCard({ goal, selected, onSelect }: {
  goal: typeof GOALS[0]; selected: boolean; onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={`co-goal-card${selected ? ' co-goal-card--selected' : ''}`}
      onClick={onSelect}
    >
      <span className="co-goal-icon">{goal.icon}</span>
      <span className="co-goal-label">{goal.label}</span>
      <span className="co-goal-desc">{goal.desc}</span>
    </button>
  )
}

function PlatformToggle({ platform, selected, onToggle }: {
  platform: Platform; selected: boolean; onToggle: () => void
}) {
  const m = PLATFORM_META[platform]
  return (
    <button
      type="button"
      className={`co-platform-toggle${selected ? ' co-platform-toggle--on' : ''}`}
      style={selected ? { '--p-color': m.color, '--p-bg': m.bg } as React.CSSProperties : {}}
      onClick={onToggle}
    >
      <span className="co-platform-icon" style={selected ? { background: m.color, color: '#fff' } : {}}>
        {m.icon}
      </span>
      <span className="co-platform-name">{m.label}</span>
      {selected && <span className="co-platform-check" style={{ color: m.color }}>✓</span>}
    </button>
  )
}

function AssetCard({ asset, onToggle }: { asset: AssetSpec; onToggle: () => void }) {
  const m = PLATFORM_META[asset.platform]
  return (
    <div
      className={`co-asset-card${asset.enabled ? '' : ' co-asset-card--disabled'}`}
      onClick={onToggle}
      role="checkbox"
      aria-checked={asset.enabled}
      tabIndex={0}
      onKeyDown={e => e.key === ' ' && onToggle()}
    >
      <div className="co-asset-check">{asset.enabled ? '✓' : '○'}</div>
      <div className="co-asset-icon">{ASSET_TYPE_ICONS[asset.type]}</div>
      <div className="co-asset-info">
        <div className="co-asset-label">{asset.label}</div>
        <div className="co-asset-dims">{asset.dims}</div>
        <div className="co-asset-desc">{asset.description}</div>
      </div>
      <div className="co-asset-platform-dot" style={{ background: m.color }} title={m.label} />
    </div>
  )
}

function ScheduleRow({ post, onToggle }: { post: ScheduledPost; onToggle: () => void }) {
  const m = PLATFORM_META[post.platform]
  return (
    <div
      className={`co-sched-row${post.enabled ? '' : ' co-sched-row--disabled'}`}
      onClick={onToggle}
      role="checkbox"
      aria-checked={post.enabled}
      tabIndex={0}
      onKeyDown={e => e.key === ' ' && onToggle()}
    >
      <div className={`co-sched-score co-sched-score--${post.peakScore}`}>
        {post.peakScore === 'peak' ? '🔥' : '⭐'}
      </div>
      <div className="co-sched-day">{post.dayLabel}</div>
      <div className="co-sched-time">{post.time}</div>
      <div className="co-sched-platform" style={{ background: m.color }}>{m.icon}</div>
      <div className="co-sched-type">{ASSET_TYPE_ICONS[post.assetType]} {post.label}</div>
      <div className="co-sched-toggle">{post.enabled ? '✓' : '○'}</div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                             */
/* -------------------------------------------------------------------------- */

type Step = 'input' | 'generating' | 'plan'

export function CampaignOrchestrator() {
  const { displayName, logoUrl, primaryHex } = useBrandTheme()

  const [step, setStep] = useState<Step>('input')
  const [prompt, setPrompt]         = useState('')
  const [goal, setGoal]             = useState<CampaignGoal>('brand_awareness')
  const [duration, setDuration]     = useState<Duration>('2_weeks')
  const [platforms, setPlatforms]   = useState<Set<Platform>>(
    new Set(['facebook', 'instagram', 'linkedin', 'youtube'] as Platform[])
  )
  const [plan, setPlan]             = useState<CampaignPlan | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [launching, setLaunching]   = useState(false)
  const [launched, setLaunched]     = useState(false)
  const [activeTab, setActiveTab]   = useState<'assets' | 'schedule' | 'seo' | 'copy'>('assets')

  const planRef = useRef<HTMLDivElement>(null)

  const togglePlatform = useCallback((p: Platform) => {
    setPlatforms(prev => {
      const next = new Set(prev)
      if (next.has(p)) { if (next.size > 1) next.delete(p) }
      else next.add(p)
      return next
    })
  }, [])

  const toggleAsset = useCallback((id: string) => {
    setPlan(prev => prev ? {
      ...prev,
      assets: prev.assets.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a),
      totalAssets: prev.assets.filter(a => a.id !== id ? a.enabled : !a.enabled).length,
    } : prev)
  }, [])

  const togglePost = useCallback((id: string) => {
    setPlan(prev => prev ? {
      ...prev,
      schedule: prev.schedule.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s),
      totalPosts: prev.schedule.filter(s => s.id !== id ? s.enabled : !s.enabled).length,
    } : prev)
  }, [])

  const generate = useCallback(async () => {
    if (!prompt.trim()) { setError('Describe your business or campaign first.'); return }
    if (platforms.size === 0) { setError('Select at least one platform.'); return }

    setError(null)
    setStep('generating')
    setLaunched(false)

    const brandCtx = displayName ? `Brand: ${displayName}. ` : ''
    const goalLabel = GOALS.find(g => g.value === goal)?.label ?? goal
    const durLabel  = DURATIONS.find(d => d.value === duration)?.label ?? duration

    const res = await apiFetch<{
      headline?: string; body?: string; cta?: string;
      hashtags?: string[]; keywords?: string[]
    }>(
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

    if (!res.ok) {
      setError(`Generation failed: ${res.error}`)
      setStep('input')
      return
    }

    const newPlan = buildPlanFromApiResponse(
      res.data as Record<string, unknown>,
      prompt.trim(), goal, Array.from(platforms), duration
    )

    setPlan(newPlan)
    setStep('plan')
    setTimeout(() => planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
  }, [prompt, goal, duration, platforms, displayName])

  const launchCampaign = useCallback(async () => {
    if (!plan) return
    setLaunching(true)

    await apiFetch(`${AUTONOMY_API}/api/autonomous/start`, {
      method: 'POST',
      json: {
        platforms: plan.platforms,
        scope: 'full_campaign',
        brief: {
          topic: prompt,
          goal,
          duration: plan.duration,
          totalAssets: plan.totalAssets,
          totalPosts: plan.totalPosts,
          schedule: plan.schedule.filter(s => s.enabled),
          assets: plan.assets.filter(a => a.enabled),
          seo: plan.seo,
          adCopy: plan.adCopy,
        },
      },
    })

    setLaunching(false)
    setLaunched(true)
  }, [plan, prompt, goal])

  /* ── Render: step = input ─────────────────────────────────────────────── */

  if (step === 'input') {
    return (
      <div className="co-root">
        <div className="co-hero">
          <div className="co-hero-badge">✦ Campaign Orchestrator</div>
          <h2 className="co-hero-title">
            Your entire marketing campaign.<br />
            <span className="co-hero-title-accent">One prompt.</span>
          </h2>
          <p className="co-hero-sub">
            Describe your business or what you want to promote. We'll generate a complete,
            ready-to-launch campaign — Reels, feed posts, ad copy, cover photos, profile
            images, scheduled at peak traffic times across Facebook, Instagram, LinkedIn, and YouTube.
          </p>
        </div>

        <div className="co-form">
          {/* Prompt */}
          <div className="co-field">
            <label className="co-label">Tell us what you want to promote *</label>
            <textarea
              className="co-textarea"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              placeholder={`Examples:\n"30% off summer sale this weekend — women's activewear brand targeting 25–40 female fitness enthusiasts in Portland"\n\n"Launching a new AI productivity app for freelancers — emphasize time savings and integrations"`}
              maxLength={1000}
            />
            <div className="co-textarea-count">{prompt.length}/1000</div>
          </div>

          {/* Goal */}
          <div className="co-field">
            <label className="co-label">Campaign goal *</label>
            <div className="co-goal-grid">
              {GOALS.map(g => (
                <GoalCard key={g.value} goal={g} selected={goal === g.value} onSelect={() => setGoal(g.value)} />
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="co-field">
            <label className="co-label">Campaign duration</label>
            <div className="co-duration-row">
              {DURATIONS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  className={`co-duration-btn${duration === d.value ? ' co-duration-btn--active' : ''}`}
                  onClick={() => setDuration(d.value)}
                >
                  <span className="co-duration-label">{d.label}</span>
                  <span className="co-duration-posts">{d.posts}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Platforms */}
          <div className="co-field">
            <label className="co-label">Platforms (select all that apply)</label>
            <div className="co-platform-row">
              {(['facebook', 'instagram', 'linkedin', 'youtube'] as Platform[]).map(p => (
                <PlatformToggle
                  key={p}
                  platform={p}
                  selected={platforms.has(p)}
                  onToggle={() => togglePlatform(p)}
                />
              ))}
            </div>
            <p className="co-platform-note">
              {platforms.size} platform{platforms.size !== 1 ? 's' : ''} selected
              · Est. reach <strong>{platforms.size >= 3 ? '12K–48K' : platforms.size === 2 ? '6K–22K' : '3K–10K'} people</strong>
            </p>
          </div>

          {error && <div className="co-error">{error}</div>}

          <button
            type="button"
            className="co-launch-btn"
            onClick={generate}
            disabled={!prompt.trim() || platforms.size === 0}
          >
            <span className="co-launch-icon">✦</span>
            Build My Campaign Plan
            <span className="co-launch-arrow">→</span>
          </button>

          <p className="co-disclaimer">
            We'll generate your full plan first. You review, edit, then launch — nothing posts without your approval.
          </p>
        </div>
      </div>
    )
  }

  /* ── Render: step = generating ─────────────────────────────────────────── */

  if (step === 'generating') {
    const steps = [
      { label: 'Analyzing your brief', done: true },
      { label: 'Building SEO keyword strategy', done: true },
      { label: 'Crafting platform-specific copy', done: false },
      { label: 'Scheduling at peak traffic windows', done: false },
      { label: 'Designing asset specifications', done: false },
      { label: 'Assembling campaign plan', done: false },
    ]
    return (
      <div className="co-root co-root--generating">
        <div className="co-gen-spinner">
          <div className="co-gen-ring" />
          <div className="co-gen-logo">
            {logoUrl
              ? <img src={logoUrl} alt="" className="co-gen-logo-img" />
              : <span style={{ color: primaryHex ?? 'var(--accent)' }}>✦</span>
            }
          </div>
        </div>
        <h2 className="co-gen-title">Building your campaign…</h2>
        <p className="co-gen-sub">Sit back. We've got this.</p>
        <div className="co-gen-steps">
          {steps.map((s, i) => (
            <div key={i} className={`co-gen-step${s.done ? ' co-gen-step--done' : i === steps.findIndex(x => !x.done) ? ' co-gen-step--active' : ''}`}>
              <span className="co-gen-step-dot" />
              {s.label}
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ── Render: step = plan ───────────────────────────────────────────────── */

  if (!plan) return null

  const enabledAssets   = plan.assets.filter(a => a.enabled)
  const enabledPosts    = plan.schedule.filter(s => s.enabled)

  return (
    <div className="co-root" ref={planRef}>
      {/* ── Plan header ─────────────────────────────────────────────────── */}
      <div className="co-plan-header">
        <div className="co-plan-header-left">
          <div className="co-plan-badge">✦ Campaign Plan Ready</div>
          <h2 className="co-plan-title">{plan.campaignName}</h2>
          <p className="co-plan-summary">{plan.summary}</p>
        </div>
        <button type="button" className="co-plan-restart" onClick={() => { setStep('input'); setPlan(null); setLaunched(false) }}>
          ← New Campaign
        </button>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <div className="co-stats">
        {[
          { label: 'Platforms',    value: plan.platforms.length.toString() },
          { label: 'Assets',       value: enabledAssets.length.toString()  },
          { label: 'Posts',        value: enabledPosts.length.toString()   },
          { label: 'Est. Reach',   value: plan.estimatedReach              },
          { label: 'Duration',     value: DURATIONS.find(d => d.value === plan.duration)?.label ?? plan.duration },
        ].map(s => (
          <div key={s.label} className="co-stat">
            <div className="co-stat-value">{s.value}</div>
            <div className="co-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Platform pills ──────────────────────────────────────────────── */}
      <div className="co-plan-platforms">
        {plan.platforms.map(p => {
          const m = PLATFORM_META[p]
          const count = plan.assets.filter(a => a.platform === p && a.enabled).length
          return (
            <div key={p} className="co-plan-platform-pill" style={{ borderColor: m.color }}>
              <span className="co-plan-platform-dot" style={{ background: m.color }}>{m.icon}</span>
              <span className="co-plan-platform-name">{m.label}</span>
              <span className="co-plan-platform-count" style={{ color: m.color }}>{count} assets</span>
            </div>
          )
        })}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="co-tabs">
        {[
          { id: 'assets',   label: `Assets (${enabledAssets.length})`    },
          { id: 'schedule', label: `Schedule (${enabledPosts.length})`   },
          { id: 'seo',      label: 'SEO Strategy'                         },
          { id: 'copy',     label: 'Ad Copy'                              },
        ].map(t => (
          <button
            key={t.id}
            type="button"
            className={`co-tab${activeTab === t.id ? ' co-tab--active' : ''}`}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Assets ─────────────────────────────────────────────────── */}
      {activeTab === 'assets' && (
        <div className="co-tab-panel">
          <p className="co-tab-hint">Click any asset to include/exclude it from your campaign. Everything checked will be generated when you launch.</p>
          {plan.platforms.map(platform => {
            const platformAssets = plan.assets.filter(a => a.platform === platform)
            const m = PLATFORM_META[platform]
            return (
              <div key={platform} className="co-asset-group">
                <div className="co-asset-group-header" style={{ borderLeftColor: m.color }}>
                  <span className="co-asset-group-icon" style={{ background: m.color }}>{m.icon}</span>
                  <span className="co-asset-group-name">{m.label}</span>
                  <span className="co-asset-group-count">{platformAssets.filter(a => a.enabled).length} of {platformAssets.length} selected</span>
                </div>
                <div className="co-asset-list">
                  {platformAssets.map(asset => (
                    <AssetCard key={asset.id} asset={asset} onToggle={() => toggleAsset(asset.id)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tab: Schedule ───────────────────────────────────────────────── */}
      {activeTab === 'schedule' && (
        <div className="co-tab-panel">
          <p className="co-tab-hint">🔥 Peak times are based on your audience's highest engagement windows. Click any row to include/exclude.</p>
          <div className="co-sched-legend">
            <span className="co-sched-legend-item"><span className="co-sched-legend-dot co-sched-legend-dot--peak">🔥</span> Peak traffic</span>
            <span className="co-sched-legend-item"><span className="co-sched-legend-dot co-sched-legend-dot--good">⭐</span> High traffic</span>
          </div>
          <div className="co-sched-list">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => {
              const dayPosts = plan.schedule.filter(s => s.dayLabel === day)
              if (!dayPosts.length) return null
              return (
                <div key={day} className="co-sched-day-group">
                  <div className="co-sched-day-label">{day}</div>
                  {dayPosts.map(post => (
                    <ScheduleRow key={post.id} post={post} onToggle={() => togglePost(post.id)} />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Tab: SEO Strategy ───────────────────────────────────────────── */}
      {activeTab === 'seo' && (
        <div className="co-tab-panel co-seo-panel">
          <div className="co-seo-section">
            <h3 className="co-seo-title">Focus Keywords</h3>
            <div className="co-seo-chips">
              {plan.seo.focusKeywords.map(kw => (
                <span key={kw} className="co-seo-chip">{kw}</span>
              ))}
            </div>
          </div>
          <div className="co-seo-section">
            <h3 className="co-seo-title">Hashtag Strategy by Platform</h3>
            {Object.entries(plan.seo.hashtagsByPlatform).map(([platform, tags]) => {
              const m = PLATFORM_META[platform as Platform]
              return (
                <div key={platform} className="co-seo-platform-tags">
                  <span className="co-seo-platform-dot" style={{ background: m.color }}>{m.icon}</span>
                  <span className="co-seo-platform-name">{m.label}:</span>
                  <div className="co-seo-tag-row">
                    {(tags ?? []).map(tag => (
                      <span key={tag} className="co-seo-tag">#{tag}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="co-seo-section">
            <h3 className="co-seo-title">Blog / Article Outline</h3>
            <div className="co-seo-blog-title">{plan.seo.blogPostTitle}</div>
            <ol className="co-seo-outline">
              {plan.seo.blogPostOutline.map((item, i) => (
                <li key={i} className="co-seo-outline-item">{item}</li>
              ))}
            </ol>
          </div>
          {plan.seo.metaDescription && (
            <div className="co-seo-section">
              <h3 className="co-seo-title">Meta Description</h3>
              <div className="co-seo-meta-desc">
                {plan.seo.metaDescription}
                <span className="co-seo-meta-count">{plan.seo.metaDescription.length}/160</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Ad Copy ────────────────────────────────────────────────── */}
      {activeTab === 'copy' && (
        <div className="co-tab-panel">
          {plan.adCopy.map((copy, i) => {
            const m = PLATFORM_META[copy.platform]
            return (
              <div key={i} className="co-copy-card">
                <div className="co-copy-card-header" style={{ borderLeftColor: m.color }}>
                  <span className="co-copy-platform-dot" style={{ background: m.color }}>{m.icon}</span>
                  <span className="co-copy-platform-name">{m.label} Ad Copy</span>
                </div>
                <div className="co-copy-row">
                  <div className="co-copy-field-label">Headline</div>
                  <div className="co-copy-field-value">{copy.headline}</div>
                </div>
                <div className="co-copy-row">
                  <div className="co-copy-field-label">Primary Text</div>
                  <div className="co-copy-field-value">{copy.body}</div>
                </div>
                <div className="co-copy-row">
                  <div className="co-copy-field-label">Call to Action</div>
                  <div className="co-copy-field-value">
                    <span className="co-copy-cta-pill">{copy.cta}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Launch bar ──────────────────────────────────────────────────── */}
      <div className="co-launch-bar">
        {launched ? (
          <div className="co-launched">
            <span className="co-launched-icon">✓</span>
            Campaign launched! Your autonomous agent is generating and scheduling everything.
            <a href="#/campaigns" className="co-launched-link">View in Campaigns →</a>
          </div>
        ) : (
          <>
            <div className="co-launch-summary">
              <strong>{enabledAssets.length} assets</strong> · <strong>{enabledPosts.length} scheduled posts</strong> · <strong>{plan.platforms.length} platforms</strong>
            </div>
            <button
              type="button"
              className="co-launch-campaign-btn"
              onClick={launchCampaign}
              disabled={launching || enabledAssets.length === 0}
            >
              {launching ? (
                <><span className="co-btn-spinner" /> Launching…</>
              ) : (
                <><span>✦</span> Launch Campaign</>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
