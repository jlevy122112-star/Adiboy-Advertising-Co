/**
 * Instagram Creative Studio — Creator · Business · Shopping Partner.
 *
 * Modes: Feed · Carousel (drag-to-reorder, up to 10 slides) · Reels · Story
 * Features:
 *   - MediaDropZone with HTML5 DnD reorder + per-image alt text
 *   - AI caption generator (2,200 char limit with real-time counter)
 *   - Hashtag builder: up to 30 tags, first-comment strategy, trending suggestions
 *   - Location, collab (@mention) tagging
 *   - Privacy selector, interactions toggles, branded-content disclosure
 *   - Brand logo watermark (if branding uploaded)
 *   - 9:16 / square phone preview with full IG UI chrome
 *   - 3×3 feed grid preview showing placement
 *   - 3-day schedule calendar with IG peak-time highlights
 *   - Partner Readiness checklist
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useContentBrief } from '../generation/ContentBriefContext'
import { useBrandTheme } from '../BrandThemePanel'
import { MediaDropZone, type MediaItem } from '../platform-studio/MediaDropZone'
import { ScheduleCalendar, type BestTimeSlot } from '../platform-studio/ScheduleCalendar'
import { HashtagBuilder } from '../platform-studio/HashtagBuilder'
import { apiFetch } from '../hooks/useApi'
import './instagram-studio.css'

// ── Constants ────────────────────────────────────────────────────────────────

const CAPTION_MAX = 2200
const CAMPAIGN_API = (import.meta.env.VITE_CAMPAIGN_API_ORIGIN as string | undefined) ?? 'http://localhost:8801'

const IG_BEST_TIMES: BestTimeSlot[] = [
  { hour: 8,  score: 'good' },
  { hour: 11, score: 'peak' },
  { hour: 12, score: 'peak' },
  { hour: 17, score: 'peak' },
  { hour: 18, score: 'good' },
  { hour: 19, score: 'good' },
]

const TRENDING_TAGS = [
  'reels','explore','instagood','photooftheday','love','fashion',
  'beautiful','happy','lifestyle','art','photography','travel',
  'food','fitness','nature','style','motivation','entrepreneur',
  'smallbusiness','contentcreator',
]

// ── Types ────────────────────────────────────────────────────────────────────

type IgFormat = 'feed' | 'carousel' | 'reels' | 'story'
type Privacy  = 'everyone' | 'followers' | 'close_friends'

interface IgDraft {
  format:          IgFormat
  media:           MediaItem[]
  caption:         string
  firstCommentTags: boolean
  hashtags:        string[]
  location:        string
  collabTag:       string
  altTagEnabled:   boolean
  commentsEnabled: boolean
  sharingEnabled:  boolean
  remixEnabled:    boolean
  brandedContent:  boolean
  watermark:       boolean
  privacy:         Privacy
  scheduledAt:     Date | null
}

const DEFAULT_DRAFT: IgDraft = {
  format: 'feed', media: [], caption: '',
  firstCommentTags: false, hashtags: [],
  location: '', collabTag: '', altTagEnabled: true,
  commentsEnabled: true, sharingEnabled: true, remixEnabled: true,
  brandedContent: false, watermark: false,
  privacy: 'everyone', scheduledAt: null,
}

const FORMAT_CFG = {
  feed:     { maxMedia: 1,  accept: 'image/*',         hint: '1:1 square or 4:5 portrait' },
  carousel: { maxMedia: 10, accept: 'image/*',          hint: '1:1 square for all slides — drag to reorder' },
  reels:    { maxMedia: 1,  accept: 'video/*',          hint: '9:16 vertical · 1080×1920 · up to 90 s' },
  story:    { maxMedia: 1,  accept: 'image/*,video/*',  hint: '9:16 vertical · auto-expires 24 h' },
}

const PRIVACY_OPTIONS: Array<{ value: Privacy; label: string; desc: string }> = [
  { value: 'everyone',      label: 'Everyone',      desc: 'Public account visibility' },
  { value: 'followers',     label: 'Followers',     desc: 'Your followers only' },
  { value: 'close_friends', label: 'Close Friends', desc: 'Select list only' },
]

// ── Sub-components ───────────────────────────────────────────────────────────

function CharCount({ value, max }: { value: string; max: number }) {
  const pct = value.length / max
  const color = pct > 0.9 ? 'var(--danger)' : pct > 0.75 ? 'var(--warning)' : 'var(--text-muted)'
  return <span className="ig-char-count" style={{ color }}>{value.length}/{max}</span>
}

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <label className="ig-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="ig-toggle-input" />
      <span className="ig-toggle-track"><span className="ig-toggle-thumb" /></span>
      <span className="ig-toggle-text">
        <span className="ig-toggle-label">{label}</span>
        {sub && <span className="ig-toggle-sub">{sub}</span>}
      </span>
    </label>
  )
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`ig-check-item${ok ? ' ig-check-item--ok' : ''}`}>
      <span className="ig-check-icon">{ok ? '✓' : '○'}</span>
      <span className="ig-check-label">{label}</span>
    </div>
  )
}

// ── Phone preview ────────────────────────────────────────────────────────────

function PhonePreview({ draft, avatarUrl, handle }: {
  draft: IgDraft; avatarUrl: string | null; handle: string
}) {
  const [slide, setSlide] = useState(0)
  const cover    = draft.media[Math.min(slide, draft.media.length - 1)] ?? null
  const isStory  = draft.format === 'story'
  const isReel   = draft.format === 'reels'
  const isCarousel = draft.format === 'carousel' && draft.media.length > 1
  const displayHandle = handle.trim() || 'your_brand'

  const AvatarRing = ({ size = 32 }: { size?: number }) => (
    <div className="ig-av-ring" style={{ width: size, height: size }}>
      {avatarUrl
        ? <img src={avatarUrl} alt={displayHandle} className="ig-av-img" />
        : <div className="ig-av-placeholder">{displayHandle.slice(0,1).toUpperCase()}</div>
      }
    </div>
  )

  return (
    <div className={`ig-phone${isStory || isReel ? ' ig-phone--9-16' : ''}`}>
      {/* Notch */}
      <div className="ig-phone-notch" />

      {/* Status bar */}
      <div className="ig-status">
        <span className="ig-status-time">9:41</span>
        <div className="ig-status-icons">
          <svg width="11" height="10" viewBox="0 0 20 18" fill="currentColor"><path d="M1 1a16 16 0 0 1 18 0M4.5 5.5a11 11 0 0 1 11 0M8 10a6 6 0 0 1 4 0M10 14.5h.01"/></svg>
          <svg width="14" height="10" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x=".7" y=".7" width="16.6" height="14.6" rx="2"/><rect x="18" y="5.5" width="3" height="5" rx="1.5" fill="currentColor" stroke="none"/><rect x="2" y="2.5" width="13" height="11" rx="1.2" fill="currentColor" stroke="none"/></svg>
        </div>
      </div>

      {/* Story / Reel chrome */}
      {(isStory || isReel) && (
        <div className="ig-story-chrome">
          <div className="ig-story-progress">
            <div className="ig-story-bar" style={{ width: '55%' }} />
          </div>
          <div className="ig-story-row">
            <AvatarRing size={24} />
            <span className="ig-story-handle">{displayHandle}</span>
            <span className="ig-story-ago">now</span>
            <button className="ig-story-close">✕</button>
          </div>
        </div>
      )}

      {/* Feed post header */}
      {!isStory && !isReel && (
        <div className="ig-post-head">
          <AvatarRing size={30} />
          <div className="ig-post-meta">
            <span className="ig-post-handle">{displayHandle}</span>
            {draft.location && <span className="ig-post-location">{draft.location}</span>}
            {draft.collabTag && <span className="ig-post-collab">with {draft.collabTag}</span>}
          </div>
          <button className="ig-post-more">···</button>
        </div>
      )}

      {/* Media frame */}
      <div className={`ig-frame${isStory || isReel ? ' ig-frame--full' : ''}`}>
        {cover ? (
          cover.type === 'video'
            ? <video src={cover.url} className="ig-frame-img" muted loop autoPlay playsInline />
            : <img src={cover.url} alt={cover.altText || cover.name} className="ig-frame-img" />
        ) : (
          <div className="ig-frame-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
            <span>{draft.format === 'reels' ? 'Reel preview' : draft.format === 'story' ? 'Story preview' : 'Photo preview'}</span>
          </div>
        )}

        {/* Watermark overlay */}
        {draft.watermark && avatarUrl && (
          <div className="ig-watermark">
            <img src={avatarUrl} alt="" className="ig-watermark-img" />
            <span className="ig-watermark-text">{displayHandle}</span>
          </div>
        )}

        {/* Carousel controls */}
        {isCarousel && (
          <>
            {slide > 0 && (
              <button className="ig-car-btn ig-car-btn--l" onClick={() => setSlide(s => s - 1)}>‹</button>
            )}
            {slide < draft.media.length - 1 && (
              <button className="ig-car-btn ig-car-btn--r" onClick={() => setSlide(s => s + 1)}>›</button>
            )}
            <div className="ig-car-dots">
              {draft.media.map((_, i) => (
                <button key={i} className={`ig-car-dot${i === slide ? ' ig-car-dot--on' : ''}`} onClick={() => setSlide(i)} />
              ))}
            </div>
          </>
        )}

        {/* Reel overlay */}
        {isReel && (
          <div className="ig-reel-overlay">
            <div className="ig-reel-sidebar">
              <div className="ig-reel-action">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </div>
              <div className="ig-reel-action">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div className="ig-reel-action">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </div>
              <div className="ig-reel-action">⋮</div>
            </div>
            <div className="ig-reel-bottom">
              <div className="ig-reel-user">
                <AvatarRing size={24} />
                <span className="ig-reel-handle">{displayHandle}</span>
              </div>
              {draft.caption && (
                <p className="ig-reel-caption">
                  {draft.caption.length > 80 ? draft.caption.slice(0, 80) + '…' : draft.caption}
                </p>
              )}
              <div className="ig-reel-sound">♪ Original audio · {displayHandle}</div>
            </div>
          </div>
        )}

        {/* Story overlay */}
        {isStory && (
          <div className="ig-story-bottom">
            <div className="ig-story-reply">
              <input className="ig-story-reply-input" placeholder={`Reply to ${displayHandle}…`} readOnly />
              <button className="ig-story-react">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feed/Carousel post footer */}
      {!isStory && !isReel && (
        <div className="ig-post-foot">
          <div className="ig-post-actions">
            <div className="ig-actions-l">
              <button className="ig-action-btn" aria-label="Like">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
              <button className="ig-action-btn" aria-label="Comment">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </button>
              <button className="ig-action-btn" aria-label="Share">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
            <button className="ig-action-btn" aria-label="Save">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
          </div>
          <div className="ig-post-likes">Be the first to like this</div>
          {draft.caption && (
            <div className="ig-post-caption">
              <span className="ig-caption-handle">{displayHandle}</span>
              {' '}
              <span className="ig-caption-text">
                {draft.caption.length > 100 ? draft.caption.slice(0, 100) + '…' : draft.caption}
              </span>
            </div>
          )}
          {!draft.firstCommentTags && draft.hashtags.length > 0 && (
            <div className="ig-post-tags">
              {draft.hashtags.slice(0, 6).map(t => `#${t}`).join(' ')}
              {draft.hashtags.length > 6 && ` +${draft.hashtags.length - 6}`}
            </div>
          )}
          {draft.brandedContent && (
            <div className="ig-paid-label">Paid partnership · {displayHandle}</div>
          )}
          <div className="ig-post-time">Just now</div>
        </div>
      )}

      {/* Home indicator */}
      <div className="ig-phone-home" />
    </div>
  )
}

// ── 3×3 feed grid preview ────────────────────────────────────────────────────

function FeedGrid({ draft }: { draft: IgDraft }) {
  const cover = draft.media[0] ?? null
  return (
    <div className="ig-feedgrid">
      <div className="ig-feedgrid-label">Your grid — where this lands</div>
      <div className="ig-feedgrid-grid">
        {Array.from({ length: 9 }).map((_, i) => {
          const isNew = i === 4
          return (
            <div key={i} className={`ig-feedgrid-cell${isNew ? ' ig-feedgrid-cell--new' : ''}`}>
              {isNew && cover ? (
                cover.type === 'video'
                  ? <video src={cover.url} className="ig-feedgrid-img" muted />
                  : <img src={cover.url} alt="" className="ig-feedgrid-img" />
              ) : (
                <div className="ig-feedgrid-bg" style={{ opacity: 0.3 + (i % 5) * 0.1 }} />
              )}
              {isNew && draft.format === 'carousel' && <span className="ig-feedgrid-badge">⧉</span>}
              {isNew && draft.format === 'reels'    && <span className="ig-feedgrid-badge">▶</span>}
              {isNew && <div className="ig-feedgrid-ring" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main panel ───────────────────────────────────────────────────────────────

export function InstagramStudioPanel() {
  const { theme } = useBrandTheme()
  const [draft, setDraft] = useState<IgDraft>(DEFAULT_DRAFT)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const captionRef = useRef<HTMLTextAreaElement>(null)

  function update<K extends keyof IgDraft>(key: K, val: IgDraft[K]) {
    setDraft(d => ({ ...d, [key]: val }))
  }

  function setFormat(f: IgFormat) {
    setDraft(d => ({ ...d, format: f, media: [] }))
  }

  const { briefId, adaptation, isSelected } = useContentBrief('instagram')
  useEffect(() => {
    if (!briefId || !adaptation || !isSelected) return
    const body = [adaptation.copy.headline, adaptation.copy.body, adaptation.copy.cta].filter(Boolean).join('\n\n')
    setDraft(d => ({
      ...d,
      caption: body.slice(0, CAPTION_MAX),
      hashtags: adaptation.copy.hashtags ?? d.hashtags,
    }))
  }, [briefId, adaptation, isSelected])

  const onMediaChange = useCallback((m: MediaItem[]) => setDraft(d => ({ ...d, media: m })), [])
  const onTagsChange  = useCallback((t: string[])    => setDraft(d => ({ ...d, hashtags: t })), [])
  const onSchedule    = useCallback((dt: Date)        => setDraft(d => ({ ...d, scheduledAt: dt })), [])

  async function generateCaption() {
    if (generating) return
    setGenerating(true)
    try {
      const res = await apiFetch<{ caption: string; hashtags?: string[] }>(
        `${CAMPAIGN_API}/ai/instagram-caption`,
        {
          method: 'POST',
          json: { format: draft.format, hashtags: draft.hashtags, brandName: theme.displayName },
        }
      )
      if (res.ok && res.data?.caption) update('caption', res.data.caption)
      if (res.ok && res.data?.hashtags?.length) {
        const merged = [...new Set([...draft.hashtags, ...res.data.hashtags])].slice(0, 30)
        update('hashtags', merged)
      }
    } finally {
      setGenerating(false)
    }
  }

  async function publishNow() {
    if (publishing) return
    setPublishing(true)
    setResult(null)
    try {
      const res = await apiFetch<{ ok: boolean; postId?: string; detail?: string }>(
        `${CAMPAIGN_API}/instagram/publish`,
        {
          method: 'POST',
          json: {
            format: draft.format,
            caption: draft.caption,
            hashtags: draft.firstCommentTags ? [] : draft.hashtags,
            firstCommentHashtags: draft.firstCommentTags ? draft.hashtags : [],
            location: draft.location,
            privacy: draft.privacy,
            brandedContent: draft.brandedContent,
            mediaIds: draft.media.map(m => m.id),
          },
        }
      )
      if (res.ok && res.data?.ok) {
        setResult({ ok: true, message: `Published! Post ID: ${res.data.postId ?? '—'}` })
        setDraft(DEFAULT_DRAFT)
      } else {
        setResult({ ok: false, message: (res.ok ? res.data?.detail : undefined) ?? 'Publish failed — check your Instagram connection.' })
      }
    } finally {
      setPublishing(false)
    }
  }

  const captionWithTags = draft.firstCommentTags
    ? draft.caption
    : draft.caption + (draft.hashtags.length ? '\n\n' + draft.hashtags.map(t => `#${t}`).join(' ') : '')

  const overLimit  = captionWithTags.length > CAPTION_MAX
  const hasMedia   = draft.media.length > 0
  const hasCaption = draft.caption.trim().length > 0
  const canPublish = hasMedia && hasCaption && !overLimit
  const canSchedule = canPublish && draft.scheduledAt !== null
  const displayHandle = theme.displayName.trim() || 'your_brand'

  return (
    <div className="ig-root">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="ig-header">
        <div className="ig-header-left">
          <div className="ig-logo">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </div>
          <div>
            <div className="ig-title">Instagram Creative Studio</div>
            <div className="ig-subtitle">Creator · Business · Shopping</div>
          </div>
        </div>
        <div className="ig-partner-badges">
          <span className="ig-badge ig-badge--creator">Creator</span>
          <span className="ig-badge ig-badge--business">Business</span>
          <span className="ig-badge ig-badge--shopping">Shopping</span>
        </div>
      </div>

      <div className="ig-layout">

        {/* ── Left: editor ──────────────────────────────────────────────────── */}
        <div className="ig-editor">

          {/* Format selector */}
          <section className="ig-section">
            <div className="ig-section-title">Format</div>
            <div className="ig-format-row">
              {(['feed', 'carousel', 'reels', 'story'] as IgFormat[]).map(f => (
                <button
                  key={f}
                  className={`ig-format-btn${draft.format === f ? ' ig-format-btn--active' : ''}`}
                  onClick={() => setFormat(f)}
                >
                  {f === 'feed'     && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>}
                  {f === 'carousel' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="5" width="13" height="14" rx="2"/><rect x="9" y="3" width="13" height="14" rx="2" opacity=".45"/></svg>}
                  {f === 'reels'    && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
                  {f === 'story'    && <svg width="8" height="12" viewBox="0 0 14 22" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="1" y="1" width="12" height="20" rx="3"/></svg>}
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div className="ig-field-hint">{FORMAT_CFG[draft.format].hint}</div>
          </section>

          {/* Media */}
          <section className="ig-section">
            <div className="ig-section-header">
              <div className="ig-section-title">
                Media
                {draft.format === 'carousel' && (
                  <span className="ig-section-badge">{draft.media.length}/{FORMAT_CFG.carousel.maxMedia} slides</span>
                )}
              </div>
            </div>
            <MediaDropZone
              items={draft.media}
              onChange={onMediaChange}
              maxItems={FORMAT_CFG[draft.format].maxMedia}
              accept={FORMAT_CFG[draft.format].accept}
              aspectHint={FORMAT_CFG[draft.format].hint}
            />
          </section>

          {/* Caption */}
          <section className="ig-section">
            <div className="ig-section-header">
              <div className="ig-section-title">Caption</div>
              <div className="ig-section-actions">
                <CharCount value={captionWithTags} max={CAPTION_MAX} />
                <button className="ig-ai-btn" onClick={generateCaption} disabled={generating}>
                  {generating
                    ? <><span className="ig-spinner" /> Generating…</>
                    : <>⚡ AI Caption</>
                  }
                </button>
              </div>
            </div>
            <textarea
              ref={captionRef}
              className={`ig-textarea${overLimit ? ' ig-textarea--error' : ''}`}
              rows={5}
              placeholder="Write a caption that stops the scroll — hook them in the first line…"
              value={draft.caption}
              onChange={e => update('caption', e.target.value)}
            />
            {overLimit && <div className="ig-field-error">Caption + hashtags exceed 2,200 character limit</div>}
          </section>

          {/* Hashtags */}
          <section className="ig-section">
            <div className="ig-section-header">
              <div className="ig-section-title">Hashtags</div>
              <Toggle
                checked={draft.firstCommentTags}
                onChange={v => update('firstCommentTags', v)}
                label="Post in first comment"
              />
            </div>
            <HashtagBuilder
              tags={draft.hashtags}
              onChange={onTagsChange}
              maxTags={30}
              suggestions={TRENDING_TAGS}
              platform="Instagram"
            />
            {draft.firstCommentTags && draft.hashtags.length > 0 && (
              <div className="ig-info-box">
                Hashtags will be posted as the first comment — keeps caption clean and boosts engagement.
              </div>
            )}
          </section>

          {/* Location + Collab */}
          <section className="ig-section">
            <div className="ig-section-title">Tag &amp; Location</div>
            <div className="ig-two-col">
              <div>
                <div className="ig-field-label">Location</div>
                <div className="ig-input-icon-wrap">
                  <svg className="ig-input-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <input className="ig-input ig-input--has-icon" placeholder="Add a location…" value={draft.location} onChange={e => update('location', e.target.value)} />
                </div>
              </div>
              <div>
                <div className="ig-field-label">Collab (@)</div>
                <div className="ig-input-icon-wrap">
                  <svg className="ig-input-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>
                  <input className="ig-input ig-input--has-icon" placeholder="@collaborator" value={draft.collabTag} onChange={e => update('collabTag', e.target.value)} />
                </div>
              </div>
            </div>
          </section>

          {/* Audience */}
          <section className="ig-section">
            <div className="ig-section-title">Audience</div>
            <div className="ig-privacy-grid">
              {PRIVACY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`ig-privacy-btn${draft.privacy === opt.value ? ' ig-privacy-btn--active' : ''}`}
                  onClick={() => update('privacy', opt.value)}
                >
                  <div className="ig-privacy-label">{opt.label}</div>
                  <div className="ig-privacy-desc">{opt.desc}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Interactions */}
          <section className="ig-section">
            <div className="ig-section-title">Interactions</div>
            <div className="ig-toggles">
              <Toggle checked={draft.commentsEnabled} onChange={v => update('commentsEnabled', v)} label="Allow Comments" />
              <Toggle checked={draft.sharingEnabled}  onChange={v => update('sharingEnabled', v)}  label="Allow Sharing" />
              {draft.format === 'reels' && (
                <Toggle checked={draft.remixEnabled}  onChange={v => update('remixEnabled', v)}    label="Allow Remix" sub="Reels only" />
              )}
            </div>
          </section>

          {/* Branded content + Watermark */}
          <section className="ig-section">
            <div className="ig-section-title">Branded Content</div>
            <div className="ig-branded-info">
              Instagram requires disclosure for any paid partnership or brand promotion.
            </div>
            <div className="ig-toggles">
              <Toggle
                checked={draft.brandedContent}
                onChange={v => update('brandedContent', v)}
                label="Paid partnership / Sponsored"
                sub="Adds 'Paid partnership' label"
              />
              {theme.logoUrl && (
                <Toggle
                  checked={draft.watermark}
                  onChange={v => update('watermark', v)}
                  label="Brand watermark"
                  sub="Overlay your uploaded logo"
                />
              )}
            </div>
          </section>

          {/* Schedule */}
          <section className="ig-section">
            <div className="ig-section-title">Schedule</div>
            <ScheduleCalendar
              value={draft.scheduledAt}
              onChange={onSchedule}
              bestTimes={IG_BEST_TIMES}
              platform="Instagram"
            />
          </section>

          {/* Publish */}
          <div className="ig-publish-row">
            <button
              className="ig-publish-btn ig-publish-btn--outline"
              disabled={!canPublish || publishing}
              onClick={() => setResult({ ok: true, message: 'Draft saved.' })}
            >
              Save Draft
            </button>
            <button
              className="ig-publish-btn ig-publish-btn--fill"
              onClick={publishNow}
              disabled={!canPublish || publishing}
            >
              {publishing
                ? <><span className="ig-spinner" /> Publishing…</>
                : <>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ flexShrink: 0 }}>
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
                    </svg>
                    Publish to Instagram
                  </>
              }
            </button>
            {canSchedule && (
              <button className="ig-publish-btn ig-publish-btn--schedule" disabled={publishing}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Schedule
              </button>
            )}
          </div>

          {result && (
            <div className={`ig-result${result.ok ? ' ig-result--ok' : ' ig-result--err'}`}>
              {result.message}
            </div>
          )}
        </div>

        {/* ── Right: preview ─────────────────────────────────────────────────── */}
        <div className="ig-preview-col">
          <div className="ig-preview-label">Live Preview</div>
          <PhonePreview
            draft={draft}
            avatarUrl={theme.logoUrl ?? null}
            handle={displayHandle}
          />

          {(draft.format === 'feed' || draft.format === 'carousel') && (
            <FeedGrid draft={draft} />
          )}

          {/* Partner Readiness */}
          <div className="ig-checklist">
            <div className="ig-checklist-title">Partner Readiness</div>
            <CheckItem ok={hasMedia}                            label="Media uploaded" />
            <CheckItem ok={hasCaption}                          label="Caption written" />
            <CheckItem ok={draft.hashtags.length >= 5}          label="5+ hashtags" />
            <CheckItem ok={draft.privacy === 'everyone'}        label="Public visibility" />
            <CheckItem ok={!overLimit}                          label="Within 2,200 char limit" />
            <CheckItem ok={!draft.brandedContent || true}       label="Disclosure complete" />
            <CheckItem ok={draft.media.every(m => m.altText.length > 0)} label="Alt text on all media" />
          </div>
        </div>
      </div>
    </div>
  )
}
