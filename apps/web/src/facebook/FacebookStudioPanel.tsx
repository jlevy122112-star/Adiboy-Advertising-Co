/**
 * Facebook Creative Studio — Meta Business Partner · Creative Hub Partner.
 *
 * Post types: post · reel · story · event · offer
 * Features:
 *   - Engagement tip banner (posts under 80 chars get 66% more engagement)
 *   - Link preview card, media drop zone, duration chips for reels/stories
 *   - Audience: visibility grid, age range, geo targeting, interest chips
 *   - Boosting: budget, duration chips, estimated reach pill (Pro badge)
 *   - Page features: cross-post, Messenger auto-reply, pin to top, CTA button
 *   - Facebook phone mock with full FB UI chrome (blue bar, reaction row)
 *   - Best-times schedule calendar
 *   - 7-item Partner Readiness checklist
 */

import { useState, useCallback, useRef } from 'react'
import { useBrandTheme } from '../BrandThemePanel'
import { MediaDropZone, type MediaItem } from '../platform-studio/MediaDropZone'
import { ScheduleCalendar, type BestTimeSlot } from '../platform-studio/ScheduleCalendar'
import { HashtagBuilder } from '../platform-studio/HashtagBuilder'
import { apiFetch } from '../hooks/useApi'
import './facebook-studio.css'

const CAMPAIGN_API = (import.meta.env.VITE_CAMPAIGN_API_ORIGIN as string | undefined) ?? 'http://localhost:8801'

// ── Constants ────────────────────────────────────────────────────────────────

const POST_TEXT_MAX = 63206
const ENGAGEMENT_TIP_THRESHOLD = 500

const FB_BEST_TIMES: BestTimeSlot[] = [
  { hour: 9,  score: 'good' },
  { hour: 12, score: 'peak' },
  { hour: 13, score: 'peak' },
  { hour: 15, score: 'peak' },
  { hour: 19, score: 'good' },
  { hour: 20, score: 'good' },
]

const INTEREST_CHIPS = [
  'Business', 'Technology', 'Fashion', 'Health',
  'Food', 'Travel', 'Sports', 'Entertainment',
]

const CTA_OPTIONS = [
  'None', 'Book Now', 'Contact Us', 'Learn More',
  'Shop Now', 'Sign Up', 'Watch More',
] as const

type CtaOption = typeof CTA_OPTIONS[number]

const REEL_DURATIONS = [15, 30, 60, 90] as const
type ReelDuration = typeof REEL_DURATIONS[number]

// ── Types ────────────────────────────────────────────────────────────────────

type PostType    = 'post' | 'reel' | 'story' | 'event' | 'offer'
type Visibility  = 'public' | 'friends' | 'friends_of_friends' | 'only_me'
type BoostDays   = 1 | 3 | 7 | 14

interface FbDraft {
  postType:          PostType
  // post
  text:              string
  linkUrl:           string
  media:             MediaItem[]
  // reel
  reelDuration:      ReelDuration
  // story
  linkSticker:       boolean
  pollSticker:       boolean
  // event
  eventTitle:        string
  eventStart:        string
  eventEnd:          string
  locationMode:      'physical' | 'virtual' | 'both'
  eventDescription:  string
  ticketUrl:         string
  coverPhoto:        MediaItem[]
  // offer
  discountPct:       number | ''
  couponCode:        string
  offerExpiry:       string
  offerTerms:        string
  // audience
  visibility:        Visibility
  ageMin:            number
  ageMax:            number
  geoTarget:         string
  interests:         string[]
  // boost
  boostEnabled:      boolean
  boostBudget:       number | ''
  boostDays:         BoostDays
  // page features
  crossPostInstagram: boolean
  messengerAutoReply: boolean
  pinToTop:           boolean
  ctaButton:          CtaOption
  // schedule
  scheduledAt:        Date | null
}

const DEFAULT_DRAFT: FbDraft = {
  postType: 'post',
  text: '', linkUrl: '', media: [],
  reelDuration: 30,
  linkSticker: false, pollSticker: false,
  eventTitle: '', eventStart: '', eventEnd: '',
  locationMode: 'physical', eventDescription: '', ticketUrl: '', coverPhoto: [],
  discountPct: '', couponCode: '', offerExpiry: '', offerTerms: '',
  visibility: 'public',
  ageMin: 18, ageMax: 65,
  geoTarget: '', interests: [],
  boostEnabled: false, boostBudget: '', boostDays: 7,
  crossPostInstagram: false, messengerAutoReply: false, pinToTop: false, ctaButton: 'None',
  scheduledAt: null,
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CharCount({ value, max }: { value: string; max: number }) {
  const pct = value.length / max
  const color = pct > 0.9 ? 'var(--danger)' : pct > 0.75 ? 'var(--warning)' : 'var(--text-muted)'
  return <span className="fb-char-count" style={{ color }}>{value.length.toLocaleString()}/{max.toLocaleString()}</span>
}

function Toggle({ checked, onChange, label, sub }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string
}) {
  return (
    <label className="fb-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="fb-toggle-input" />
      <span className="fb-toggle-track"><span className="fb-toggle-thumb" /></span>
      <span className="fb-toggle-text">
        <span className="fb-toggle-label">{label}</span>
        {sub && <span className="fb-toggle-sub">{sub}</span>}
      </span>
    </label>
  )
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`fb-check-item${ok ? ' fb-check-item--ok' : ''}`}>
      <span className="fb-check-icon">{ok ? '✓' : '○'}</span>
      <span className="fb-check-label">{label}</span>
    </div>
  )
}

// ── Phone preview ────────────────────────────────────────────────────────────

function FbPhonePreview({ draft, avatarUrl, pageName }: {
  draft: FbDraft; avatarUrl: string | null; pageName: string
}) {
  const displayName = pageName.trim() || 'Your Brand Page'
  const cover       = draft.media[0] ?? draft.coverPhoto[0] ?? null
  const isEvent     = draft.postType === 'event'
  const isReel      = draft.postType === 'reel'

  return (
    <div className="fb-phone">
      {/* Blue top bar */}
      <div className="fb-phone-bar">
        <div className="fb-phone-bar-logo">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="white">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </div>
        <div className="fb-phone-bar-icons">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="white"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="white" strokeWidth="2"/></svg>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
      </div>

      {/* Post card */}
      <div className="fb-post-card">
        {/* Post header */}
        <div className="fb-post-head">
          <div className="fb-post-avatar">
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} className="fb-post-avatar-img" />
              : <div className="fb-post-avatar-placeholder">f</div>
            }
          </div>
          <div className="fb-post-meta">
            <div className="fb-post-name">
              {displayName}
              <span className="fb-verified-badge">✓</span>
              <span className="fb-sponsored-tag">Sponsored</span>
            </div>
            <div className="fb-post-sub">
              Just now · <span className="fb-globe-icon">🌐</span>
            </div>
          </div>
          <button className="fb-post-more">•••</button>
        </div>

        {/* Post text */}
        {draft.text && (
          <div className="fb-post-text">
            {draft.text.length > 150 ? draft.text.slice(0, 150) : draft.text}
            {draft.text.length > 150 && <span className="fb-see-more"> See more</span>}
          </div>
        )}

        {/* Event preview in card */}
        {isEvent && draft.eventTitle && (
          <div className="fb-event-preview">
            <div className="fb-event-preview-date">
              {draft.eventStart ? new Date(draft.eventStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}
            </div>
            <div className="fb-event-preview-info">
              <div className="fb-event-preview-title">{draft.eventTitle}</div>
              <div className="fb-event-preview-loc">
                {draft.locationMode === 'virtual' ? '📍 Online Event' : '📍 Physical Location'}
              </div>
            </div>
            <button className="fb-event-preview-interest">Interested</button>
          </div>
        )}

        {/* Reel overlay */}
        {isReel && (
          <div className="fb-reel-thumb">
            {cover ? (
              <img src={cover.url} alt="" className="fb-reel-img" />
            ) : (
              <div className="fb-reel-placeholder">
                <span className="fb-reel-play">▶</span>
                <span className="fb-reel-label">9:16 Reel</span>
              </div>
            )}
            <div className="fb-reel-duration">{draft.reelDuration}s</div>
          </div>
        )}

        {/* Regular media */}
        {!isReel && !isEvent && cover && (
          <div className="fb-post-media">
            {cover.type === 'video'
              ? <video src={cover.url} className="fb-post-media-img" muted />
              : <img src={cover.url} alt={cover.altText || cover.name} className="fb-post-media-img" />
            }
          </div>
        )}

        {/* Link preview card */}
        {draft.linkUrl && !cover && draft.postType === 'post' && (
          <div className="fb-link-preview">
            <div className="fb-link-favicon">🔗</div>
            <div className="fb-link-info">
              <div className="fb-link-domain">{(() => { try { return new URL(draft.linkUrl).hostname.replace('www.','') } catch { return draft.linkUrl.slice(0,30) } })()}</div>
              <div className="fb-link-title">Link Preview Title</div>
            </div>
          </div>
        )}

        {/* Reaction row */}
        <div className="fb-reaction-row">
          <div className="fb-reactions-left">
            <button className="fb-reaction-btn">👍 Like</button>
            <button className="fb-reaction-btn">❤️</button>
            <button className="fb-reaction-btn">😂</button>
            <span className="fb-reaction-sep">·</span>
            <button className="fb-reaction-btn">Comment</button>
            <span className="fb-reaction-sep">·</span>
            <button className="fb-reaction-btn">Share</button>
          </div>
        </div>

        {/* Boost button */}
        {draft.boostEnabled && (
          <div className="fb-boost-preview-btn">
            <span>Boost post</span>
          </div>
        )}
      </div>

      <div className="fb-phone-home" />
    </div>
  )
}

// ── Main panel ───────────────────────────────────────────────────────────────

export function FacebookStudioPanel() {
  const { theme } = useBrandTheme()
  const [draft, setDraft]         = useState<FbDraft>(DEFAULT_DRAFT)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [result, setResult]         = useState<{ ok: boolean; message: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function update<K extends keyof FbDraft>(key: K, val: FbDraft[K]) {
    setDraft(d => ({ ...d, [key]: val }))
  }

  function setPostType(t: PostType) {
    setDraft(d => ({ ...d, postType: t, media: [], coverPhoto: [] }))
  }

  const onMediaChange       = useCallback((m: MediaItem[]) => setDraft(d => ({ ...d, media: m })), [])
  const onCoverPhotoChange  = useCallback((m: MediaItem[]) => setDraft(d => ({ ...d, coverPhoto: m })), [])
  const onSchedule          = useCallback((dt: Date) => setDraft(d => ({ ...d, scheduledAt: dt })), [])

  const toggleInterest = useCallback((chip: string) => {
    setDraft(d => ({
      ...d,
      interests: d.interests.includes(chip)
        ? d.interests.filter(i => i !== chip)
        : [...d.interests, chip],
    }))
  }, [])

  const generateCaption = useCallback(async () => {
    if (generating) return
    setGenerating(true)
    try {
      const res = await apiFetch<{ text: string }>(
        `${CAMPAIGN_API}/ai/facebook-caption`,
        {
          method: 'POST',
          json: {
            postType: draft.postType,
            brandName: theme.displayName,
            interests: draft.interests,
          },
        }
      )
      if (res.data?.text) update('text', res.data.text)
    } finally {
      setGenerating(false)
    }
  }, [generating, draft.postType, draft.interests, theme.displayName])

  const publishNow = useCallback(async () => {
    if (publishing) return
    setPublishing(true)
    setResult(null)
    try {
      const res = await apiFetch<{ ok: boolean; postId?: string; detail?: string }>(
        `${CAMPAIGN_API}/facebook/publish`,
        {
          method: 'POST',
          json: {
            postType:   draft.postType,
            text:       draft.text,
            linkUrl:    draft.linkUrl || undefined,
            mediaIds:   draft.media.map(m => m.id),
            visibility: draft.visibility,
            ctaButton:  draft.ctaButton !== 'None' ? draft.ctaButton : undefined,
            boostEnabled: draft.boostEnabled,
            boostBudget:  draft.boostEnabled ? draft.boostBudget : undefined,
            boostDays:    draft.boostEnabled ? draft.boostDays : undefined,
            crossPost:    draft.crossPostInstagram,
          },
        }
      )
      if (res.data?.ok) {
        setResult({ ok: true, message: `Published! Post ID: ${res.data.postId ?? '—'}` })
        setDraft(DEFAULT_DRAFT)
      } else {
        setResult({ ok: false, message: res.data?.detail ?? 'Publish failed — check your Facebook Page connection.' })
      }
    } finally {
      setPublishing(false)
    }
  }, [publishing, draft])

  const showEngagementTip  = draft.postType === 'post' && draft.text.length >= ENGAGEMENT_TIP_THRESHOLD
  const overLimit          = draft.text.length > POST_TEXT_MAX
  const hasContent         = draft.postType === 'post'
    ? (draft.text.trim().length > 0 || draft.media.length > 0)
    : draft.postType === 'event'
    ? draft.eventTitle.trim().length > 0
    : draft.postType === 'offer'
    ? (draft.discountPct !== '' || draft.couponCode.trim().length > 0)
    : draft.media.length > 0
  const canPublish = hasContent && !overLimit

  const displayName = theme.displayName.trim() || 'Your Brand Page'

  return (
    <div className="fb-root">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="fb-header">
        <div className="fb-header-left">
          <div className="fb-logo">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <div>
            <div className="fb-title">Facebook Creative Studio</div>
            <div className="fb-subtitle">Meta Business Partner · Creative Hub</div>
          </div>
        </div>
        <div className="fb-partner-badges">
          <span className="fb-badge fb-badge--meta">Meta Business Partner</span>
          <span className="fb-badge fb-badge--creative">Creative Hub</span>
        </div>
      </div>

      <div className="fb-layout">

        {/* ── Left: editor ────────────────────────────────────────────────────── */}
        <div className="fb-editor">

          {/* Post type selector */}
          <section className="fb-section">
            <div className="fb-section-title">Post Type</div>
            <div className="fb-type-row">
              {(['post', 'reel', 'story', 'event', 'offer'] as PostType[]).map(t => (
                <button
                  key={t}
                  className={`fb-type-btn${draft.postType === t ? ' fb-type-btn--active' : ''}`}
                  onClick={() => setPostType(t)}
                >
                  {t === 'post'  && '📝 '}
                  {t === 'reel'  && '▶ '}
                  {t === 'story' && '📱 '}
                  {t === 'event' && '📅 '}
                  {t === 'offer' && '🏷 '}
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </section>

          {/* ── Post fields ───────────────────────────────────────────────────── */}
          {draft.postType === 'post' && (
            <>
              <section className="fb-section">
                <div className="fb-section-header">
                  <div className="fb-section-title">Text</div>
                  <div className="fb-section-actions">
                    <CharCount value={draft.text} max={POST_TEXT_MAX} />
                    <button className="fb-ai-btn" onClick={generateCaption} disabled={generating}>
                      {generating ? <><span className="fb-spinner" /> Generating…</> : <>⚡ AI Copy</>}
                    </button>
                  </div>
                </div>
                {showEngagementTip && (
                  <div className="fb-engagement-tip">
                    💡 Posts under 80 characters get 66% more engagement. Consider trimming.
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  className={`fb-textarea${overLimit ? ' fb-textarea--error' : ''}`}
                  rows={5}
                  placeholder="What's on your mind? Keep it concise for the highest reach…"
                  value={draft.text}
                  onChange={e => update('text', e.target.value)}
                />
                {overLimit && <div className="fb-field-error">Text exceeds 63,206 character limit</div>}
              </section>

              <section className="fb-section">
                <div className="fb-section-title">Link URL</div>
                <input
                  className="fb-input"
                  type="url"
                  placeholder="https://example.com/your-page"
                  value={draft.linkUrl}
                  onChange={e => update('linkUrl', e.target.value)}
                />
                <div className="fb-field-hint">Generates a link preview card with title and domain</div>
              </section>

              <section className="fb-section">
                <div className="fb-section-title">Photos / Videos</div>
                <MediaDropZone
                  items={draft.media}
                  onChange={onMediaChange}
                  maxItems={10}
                  accept="image/*,video/*"
                  aspectHint="1:1 square or 4:5 portrait recommended"
                />
              </section>

              <section className="fb-section">
                <div className="fb-section-title">Hashtags</div>
                <HashtagBuilder
                  tags={[]}
                  onChange={() => {}}
                  maxTags={30}
                  suggestions={['business', 'marketing', 'entrepreneur', 'smallbusiness', 'socialmedia']}
                  platform="Facebook"
                />
              </section>
            </>
          )}

          {/* ── Reel fields ───────────────────────────────────────────────────── */}
          {draft.postType === 'reel' && (
            <>
              <section className="fb-section">
                <div className="fb-section-title">Reel Video</div>
                <MediaDropZone
                  items={draft.media}
                  onChange={onMediaChange}
                  maxItems={1}
                  accept="video/*"
                  aspectHint="9:16 vertical · 1080×1920 · Facebook Reels"
                />
              </section>

              <section className="fb-section">
                <div className="fb-section-title">Duration Target</div>
                <div className="fb-duration-chips">
                  {REEL_DURATIONS.map(d => (
                    <button
                      key={d}
                      className={`fb-duration-chip${draft.reelDuration === d ? ' fb-duration-chip--active' : ''}`}
                      onClick={() => update('reelDuration', d)}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
                <div className="fb-field-hint">Vertical 9:16 · Up to 90 seconds</div>
              </section>

              <section className="fb-section">
                <div className="fb-section-header">
                  <div className="fb-section-title">Caption</div>
                  <div className="fb-section-actions">
                    <CharCount value={draft.text} max={POST_TEXT_MAX} />
                    <button className="fb-ai-btn" onClick={generateCaption} disabled={generating}>
                      {generating ? <><span className="fb-spinner" /> Generating…</> : <>⚡ AI Caption</>}
                    </button>
                  </div>
                </div>
                <textarea
                  className="fb-textarea"
                  rows={3}
                  placeholder="Write a reel caption…"
                  value={draft.text}
                  onChange={e => update('text', e.target.value)}
                />
              </section>
            </>
          )}

          {/* ── Story fields ──────────────────────────────────────────────────── */}
          {draft.postType === 'story' && (
            <>
              <section className="fb-section">
                <div className="fb-section-title">Story Media</div>
                <MediaDropZone
                  items={draft.media}
                  onChange={onMediaChange}
                  maxItems={1}
                  accept="image/*,video/*"
                  aspectHint="9:16 vertical · Photo or 15s video"
                />
              </section>

              <section className="fb-section">
                <div className="fb-section-title">Story Stickers</div>
                <div className="fb-toggles">
                  <Toggle
                    checked={draft.linkSticker}
                    onChange={v => update('linkSticker', v)}
                    label="Link Sticker"
                    sub="Add a swipe-up link"
                  />
                  <Toggle
                    checked={draft.pollSticker}
                    onChange={v => update('pollSticker', v)}
                    label="Poll Sticker"
                    sub="Engage your audience with a question"
                  />
                </div>
              </section>
            </>
          )}

          {/* ── Event fields ──────────────────────────────────────────────────── */}
          {draft.postType === 'event' && (
            <>
              <section className="fb-section">
                <div className="fb-section-title">Event Details</div>
                <div className="fb-field-label">Event Title</div>
                <input
                  className="fb-input"
                  type="text"
                  placeholder="Event name"
                  value={draft.eventTitle}
                  onChange={e => update('eventTitle', e.target.value)}
                />
              </section>

              <section className="fb-section">
                <div className="fb-fb-grid">
                  <div>
                    <div className="fb-field-label">Start Date &amp; Time</div>
                    <input
                      className="fb-input"
                      type="datetime-local"
                      value={draft.eventStart}
                      onChange={e => update('eventStart', e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="fb-field-label">End Date &amp; Time</div>
                    <input
                      className="fb-input"
                      type="datetime-local"
                      value={draft.eventEnd}
                      onChange={e => update('eventEnd', e.target.value)}
                    />
                  </div>
                </div>
              </section>

              <section className="fb-section">
                <div className="fb-section-title">Location</div>
                <div className="fb-location-row">
                  {(['physical', 'virtual', 'both'] as const).map(mode => (
                    <button
                      key={mode}
                      className={`fb-loc-btn${draft.locationMode === mode ? ' fb-loc-btn--active' : ''}`}
                      onClick={() => update('locationMode', mode)}
                    >
                      {mode === 'physical' ? '📍 Physical' : mode === 'virtual' ? '💻 Virtual' : '🌐 Both'}
                    </button>
                  ))}
                </div>
              </section>

              <section className="fb-section">
                <div className="fb-field-label">Description</div>
                <textarea
                  className="fb-textarea"
                  rows={3}
                  placeholder="Describe your event…"
                  value={draft.eventDescription}
                  onChange={e => update('eventDescription', e.target.value)}
                />
              </section>

              <section className="fb-section">
                <div className="fb-section-title">Cover Photo</div>
                <MediaDropZone
                  items={draft.coverPhoto}
                  onChange={onCoverPhotoChange}
                  maxItems={1}
                  accept="image/*"
                  aspectHint="16:9 — 1920×1080 recommended"
                />
              </section>

              <section className="fb-section">
                <div className="fb-field-label">Ticket URL (optional)</div>
                <input
                  className="fb-input"
                  type="url"
                  placeholder="https://tickets.example.com"
                  value={draft.ticketUrl}
                  onChange={e => update('ticketUrl', e.target.value)}
                />
              </section>
            </>
          )}

          {/* ── Offer fields ──────────────────────────────────────────────────── */}
          {draft.postType === 'offer' && (
            <>
              <section className="fb-section">
                <div className="fb-section-title">Offer Details</div>
                <div className="fb-fb-grid">
                  <div>
                    <div className="fb-field-label">Discount %</div>
                    <input
                      className="fb-input"
                      type="number"
                      min={1} max={100}
                      placeholder="e.g. 20"
                      value={draft.discountPct}
                      onChange={e => update('discountPct', e.target.value ? Number(e.target.value) : '')}
                    />
                  </div>
                  <div>
                    <div className="fb-field-label">Coupon Code</div>
                    <input
                      className="fb-input"
                      type="text"
                      placeholder="SAVE20"
                      value={draft.couponCode}
                      onChange={e => update('couponCode', e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
              </section>

              <section className="fb-section">
                <div className="fb-field-label">Expiry Date</div>
                <input
                  className="fb-input"
                  type="date"
                  value={draft.offerExpiry}
                  onChange={e => update('offerExpiry', e.target.value)}
                />
              </section>

              <section className="fb-section">
                <div className="fb-field-label">Terms &amp; Conditions</div>
                <textarea
                  className="fb-textarea"
                  rows={3}
                  placeholder="Enter offer terms and conditions…"
                  value={draft.offerTerms}
                  onChange={e => update('offerTerms', e.target.value)}
                />
              </section>
            </>
          )}

          {/* ── Audience ────────────────────────────────────────────────────────── */}
          <section className="fb-section">
            <div className="fb-section-title">Audience</div>

            <div className="fb-field-label">Visibility</div>
            <div className="fb-visibility-grid">
              {([
                { value: 'public',            label: 'Public',            desc: 'Anyone on Facebook' },
                { value: 'friends',           label: 'Friends',           desc: 'Your friends' },
                { value: 'friends_of_friends',label: 'Friends of Friends',desc: 'Extended network' },
                { value: 'only_me',           label: 'Only Me',           desc: 'Private' },
              ] as Array<{ value: Visibility; label: string; desc: string }>).map(opt => (
                <button
                  key={opt.value}
                  className={`fb-vis-btn${draft.visibility === opt.value ? ' fb-vis-btn--active' : ''}`}
                  onClick={() => update('visibility', opt.value)}
                >
                  <div className="fb-vis-label">{opt.label}</div>
                  <div className="fb-vis-desc">{opt.desc}</div>
                </button>
              ))}
            </div>

            <div className="fb-fb-grid" style={{ marginTop: '0.75rem' }}>
              <div>
                <div className="fb-field-label">Age Range</div>
                <div className="fb-age-row">
                  <input
                    className="fb-input fb-input--sm"
                    type="number"
                    min={18} max={65}
                    value={draft.ageMin}
                    onChange={e => update('ageMin', Number(e.target.value))}
                  />
                  <span className="fb-age-sep">–</span>
                  <input
                    className="fb-input fb-input--sm"
                    type="number"
                    min={18} max={65}
                    value={draft.ageMax}
                    onChange={e => update('ageMax', Number(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <div className="fb-field-label">Countries / Regions</div>
                <input
                  className="fb-input"
                  type="text"
                  placeholder="e.g. United States, Canada"
                  value={draft.geoTarget}
                  onChange={e => update('geoTarget', e.target.value)}
                />
              </div>
            </div>

            <div className="fb-field-label" style={{ marginTop: '0.75rem' }}>Interests</div>
            <div className="fb-interest-chips">
              {INTEREST_CHIPS.map(chip => (
                <button
                  key={chip}
                  className={`fb-interest-chip${draft.interests.includes(chip) ? ' fb-interest-chip--active' : ''}`}
                  onClick={() => toggleInterest(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
          </section>

          {/* ── Boosting ────────────────────────────────────────────────────────── */}
          <section className="fb-section">
            <div className="fb-section-header">
              <div className="fb-section-title">
                Boosting
                <span className="fb-pro-badge">Pro</span>
              </div>
            </div>
            <Toggle
              checked={draft.boostEnabled}
              onChange={v => update('boostEnabled', v)}
              label="Boost this post"
              sub="Amplify reach with paid promotion"
            />

            {draft.boostEnabled && (
              <div className="fb-boost-panel">
                <div className="fb-fb-grid">
                  <div>
                    <div className="fb-field-label">Daily Budget</div>
                    <div className="fb-budget-input-wrap">
                      <span className="fb-budget-prefix">$</span>
                      <input
                        className="fb-input fb-input--budget"
                        type="number"
                        min={5}
                        placeholder="10"
                        value={draft.boostBudget}
                        onChange={e => update('boostBudget', e.target.value ? Number(e.target.value) : '')}
                      />
                    </div>
                    <div className="fb-field-hint">Minimum $5/day</div>
                  </div>
                  <div>
                    <div className="fb-field-label">Duration</div>
                    <div className="fb-duration-chips">
                      {([1, 3, 7, 14] as BoostDays[]).map(d => (
                        <button
                          key={d}
                          className={`fb-duration-chip${draft.boostDays === d ? ' fb-duration-chip--active' : ''}`}
                          onClick={() => update('boostDays', d)}
                        >
                          {d}d
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="fb-reach-pill">
                  Est. 1.2K–4.8K people
                </div>
              </div>
            )}
          </section>

          {/* ── Page Features ────────────────────────────────────────────────────── */}
          <section className="fb-section">
            <div className="fb-section-title">Page Features</div>
            <div className="fb-toggles">
              <Toggle
                checked={draft.crossPostInstagram}
                onChange={v => update('crossPostInstagram', v)}
                label="Cross-post to Instagram"
                sub="Share simultaneously to your IG account"
              />
              <Toggle
                checked={draft.messengerAutoReply}
                onChange={v => update('messengerAutoReply', v)}
                label="Messenger Auto-Reply"
                sub="Auto-respond to DMs triggered by this post"
              />
              <Toggle
                checked={draft.pinToTop}
                onChange={v => update('pinToTop', v)}
                label="Pin to top of Page"
                sub="Feature this post at the top of your timeline"
              />
            </div>

            <div className="fb-field-label" style={{ marginTop: '0.75rem' }}>CTA Button</div>
            <select
              className="fb-select"
              value={draft.ctaButton}
              onChange={e => update('ctaButton', e.target.value as CtaOption)}
            >
              {CTA_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </section>

          {/* ── Schedule ────────────────────────────────────────────────────────── */}
          <section className="fb-section">
            <div className="fb-section-title">Schedule</div>
            <ScheduleCalendar
              value={draft.scheduledAt}
              onChange={onSchedule}
              bestTimes={FB_BEST_TIMES}
              platform="Facebook"
            />
          </section>

          {/* ── Publish row ─────────────────────────────────────────────────────── */}
          <div className="fb-publish-row">
            <button
              className="fb-publish-btn fb-publish-btn--outline"
              disabled={!canPublish || publishing}
              onClick={() => setResult({ ok: true, message: 'Draft saved.' })}
            >
              Save Draft
            </button>
            <button
              className="fb-publish-btn fb-publish-btn--fill"
              onClick={publishNow}
              disabled={!canPublish || publishing}
            >
              {publishing
                ? <><span className="fb-spinner" /> Publishing…</>
                : <>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ flexShrink: 0 }}>
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Publish to Facebook
                  </>
              }
            </button>
            {draft.scheduledAt && canPublish && (
              <button className="fb-publish-btn fb-publish-btn--schedule" disabled={publishing}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Schedule
              </button>
            )}
          </div>

          {result && (
            <div className={`fb-result${result.ok ? ' fb-result--ok' : ' fb-result--err'}`}>
              {result.message}
            </div>
          )}
        </div>

        {/* ── Right: preview ──────────────────────────────────────────────────── */}
        <div className="fb-preview-col">
          <div className="fb-preview-label">Live Preview</div>
          <FbPhonePreview
            draft={draft}
            avatarUrl={theme.logoUrl ?? null}
            pageName={displayName}
          />

          {/* Partner Readiness checklist */}
          <div className="fb-checklist">
            <div className="fb-checklist-title">Partner Readiness</div>
            <CheckItem ok label="Facebook Page (not personal profile)" />
            <CheckItem ok={false} label="Page verified badge" />
            <CheckItem ok={false} label="100+ Page likes" />
            <CheckItem ok label="Business Manager account" />
            <CheckItem ok={false} label="Ad account linked" />
            <CheckItem ok={false} label="Pixel installed on website" />
            <CheckItem ok label="No Community Standards violations" />
          </div>
        </div>
      </div>
    </div>
  )
}
