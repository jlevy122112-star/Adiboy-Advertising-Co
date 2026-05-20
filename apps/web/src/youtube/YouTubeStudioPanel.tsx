/**
 * YouTube Creative Studio — YouTube Partner Program + Content ID Partner.
 *
 * Video types: Long Form · Shorts · Live · Premiere
 * Features:
 *   - Title (100 char) + Description (5,000 char) with real-time CharCount
 *   - Shorts: vertical 9:16 phone mock, ≤60s duration warning
 *   - Live: latency chips, DVR toggle, scheduled start time
 *   - Premiere: upload now + schedule premiere date/time
 *   - Thumbnail drop zone (1280×720 recommended)
 *   - Category selector, recording date, video language
 *   - Audience: Made for Kids (COPPA) + 18+ restriction + visibility grid
 *   - Monetization toggle (Pro), ad type checkboxes, paid promo disclosure
 *   - End Screen chips + Cards chips
 *   - HashtagBuilder max 15 tags
 *   - Schedule calendar with YT peak times
 *   - Partner Readiness checklist (7 items)
 *   - Long-form 16:9 phone preview with action bar
 */

import { useState, useCallback, useRef } from 'react'
import { useBrandTheme } from '../BrandThemePanel'
import { MediaDropZone, type MediaItem } from '../platform-studio/MediaDropZone'
import { ScheduleCalendar, type BestTimeSlot } from '../platform-studio/ScheduleCalendar'
import { HashtagBuilder } from '../platform-studio/HashtagBuilder'
import { apiFetch } from '../hooks/useApi'
import './youtube-studio.css'

const CAMPAIGN_API = (import.meta.env.VITE_CAMPAIGN_API_ORIGIN as string | undefined) ?? 'http://localhost:8801'

// ── Constants ─────────────────────────────────────────────────────────────────

const TITLE_MAX = 100
const DESC_MAX  = 5000

const YT_BEST_TIMES: BestTimeSlot[] = [
  { hour: 14, score: 'good' },
  { hour: 15, score: 'peak' },
  { hour: 16, score: 'peak' },
  { hour: 17, score: 'peak' },
  { hour: 20, score: 'good' },
  { hour: 21, score: 'good' },
]

const YT_CATEGORIES = [
  'Education',
  'Entertainment',
  'How-to & Style',
  'Science & Technology',
  'People & Blogs',
  'Music',
  'Gaming',
  'News & Politics',
  'Sports',
  'Travel & Events',
] as const

const YT_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese (Simplified)' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
] as const

const END_SCREEN_ELEMENTS = ['Subscribe button', 'Suggested video', 'Channel', 'External link'] as const
const CARD_ELEMENTS        = ['Poll', 'Video', 'Playlist', 'Channel'] as const
const LATENCY_OPTIONS      = ['Normal', 'Low', 'Ultra-low'] as const

const AD_TYPES = [
  { key: 'skippableInstream',    label: 'Skippable in-stream' },
  { key: 'nonSkippable',         label: 'Non-skippable' },
  { key: 'bumperAds',            label: 'Bumper ads' },
  { key: 'overlayAds',           label: 'Overlay ads' },
] as const

const TRENDING_TAGS = [
  'youtube', 'viral', 'trending', 'howto', 'tutorial',
  'review', 'vlog', 'shorts', 'gaming', 'education',
  'technology', 'diy', 'cooking', 'fitness', 'motivation',
]

// ── Types ──────────────────────────────────────────────────────────────────────

type VideoType  = 'long_form' | 'shorts' | 'live' | 'premiere'
type Visibility = 'public' | 'unlisted' | 'private' | 'scheduled'
type LatencyMode = typeof LATENCY_OPTIONS[number]

interface AdSettings {
  skippableInstream: boolean
  nonSkippable: boolean
  bumperAds: boolean
  overlayAds: boolean
}

interface YtDraft {
  videoType:        VideoType
  title:            string
  description:      string
  thumbnail:        MediaItem[]
  category:         string
  recordingDate:    string
  language:         string
  madeForKids:      boolean
  ageRestricted:    boolean
  visibility:       Visibility
  scheduledAt:      Date | null
  monetized:        boolean
  adSettings:       AdSettings
  paidPromo:        boolean
  endScreenElements: string[]
  cardElements:      string[]
  hashtags:          string[]
  // Live-specific
  latencyMode:      LatencyMode
  dvrEnabled:       boolean
  liveScheduledAt:  string
  // Premiere-specific
  premiereDate:     string
  premiereTime:     string
}

const DEFAULT_AD_SETTINGS: AdSettings = {
  skippableInstream: true,
  nonSkippable: false,
  bumperAds: false,
  overlayAds: false,
}

const DEFAULT_DRAFT: YtDraft = {
  videoType: 'long_form',
  title: '',
  description: '',
  thumbnail: [],
  category: 'Education',
  recordingDate: '',
  language: 'en',
  madeForKids: false,
  ageRestricted: false,
  visibility: 'public',
  scheduledAt: null,
  monetized: false,
  adSettings: DEFAULT_AD_SETTINGS,
  paidPromo: false,
  endScreenElements: [],
  cardElements: [],
  hashtags: [],
  latencyMode: 'Normal',
  dvrEnabled: true,
  liveScheduledAt: '',
  premiereDate: '',
  premiereTime: '',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CharCount({ value, max }: { value: string; max: number }) {
  const pct   = value.length / max
  const color = pct > 0.9 ? 'var(--danger)' : pct > 0.75 ? 'var(--warning)' : 'var(--text-muted)'
  return <span className="yt-char-count" style={{ color }}>{value.length}/{max}</span>
}

function Toggle({ checked, onChange, label, sub }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string
}) {
  return (
    <label className="yt-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="yt-toggle-input"
      />
      <span className="yt-toggle-track"><span className="yt-toggle-thumb" /></span>
      <span className="yt-toggle-text">
        <span className="yt-toggle-label">{label}</span>
        {sub && <span className="yt-toggle-sub">{sub}</span>}
      </span>
    </label>
  )
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`yt-check-item${ok ? ' yt-check-item--ok' : ''}`}>
      <span className="yt-check-icon">{ok ? '✓' : '○'}</span>
      <span className="yt-check-label">{label}</span>
    </div>
  )
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={`yt-chip${active ? ' yt-chip--active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

// ── Phone Preview: Shorts (9:16) ──────────────────────────────────────────────

function ShortsPreview({ draft }: { draft: YtDraft }) {
  const title = draft.title || 'Your Shorts title'
  return (
    <div className="yt-preview-shorts">
      <div className="yt-shorts-phone">
        <div className="yt-shorts-screen">
          {/* Progress bar */}
          <div className="yt-shorts-progress">
            <div className="yt-shorts-progress-fill" style={{ width: '40%' }} />
          </div>

          {/* Video area */}
          <div className="yt-shorts-video-area">
            {draft.thumbnail[0] ? (
              <img src={draft.thumbnail[0].url} alt="" className="yt-shorts-thumb-img" />
            ) : (
              <div className="yt-shorts-placeholder">
                <span className="yt-shorts-placeholder-icon">▶</span>
                <span className="yt-shorts-placeholder-text">9:16 Short</span>
              </div>
            )}

            {/* Right sidebar */}
            <div className="yt-shorts-sidebar">
              <div className="yt-shorts-action">
                <span className="yt-shorts-action-icon">❤</span>
                <span className="yt-shorts-action-count">12K</span>
              </div>
              <div className="yt-shorts-action">
                <span className="yt-shorts-action-icon">💬</span>
                <span className="yt-shorts-action-count">348</span>
              </div>
              <div className="yt-shorts-action">
                <span className="yt-shorts-action-icon">➤</span>
                <span className="yt-shorts-action-count">Share</span>
              </div>
              <div className="yt-shorts-action">
                <span className="yt-shorts-action-icon">⊕</span>
                <span className="yt-shorts-action-count">Subscribe</span>
              </div>
              <div className="yt-shorts-action">
                <span className="yt-shorts-action-icon yt-spinning">♪</span>
              </div>
            </div>

            {/* Bottom info */}
            <div className="yt-shorts-bottom">
              <div className="yt-shorts-username">@marketer_pro</div>
              <div className="yt-shorts-title">{title.slice(0, 60)}{title.length > 60 ? '…' : ''}</div>
            </div>
          </div>
        </div>
        <div className="yt-shorts-home-bar" />
      </div>
    </div>
  )
}

// ── Phone Preview: Long Form (16:9) ──────────────────────────────────────────

function LongFormPreview({ draft }: { draft: YtDraft }) {
  const title = draft.title || 'Your video title goes here'
  return (
    <div className="yt-preview-longform">
      <div className="yt-lf-phone">
        {/* 16:9 player */}
        <div className="yt-lf-player">
          {draft.thumbnail[0] ? (
            <img src={draft.thumbnail[0].url} alt="" className="yt-lf-thumb-img" />
          ) : (
            <div className="yt-lf-placeholder">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)">
                <path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.2 2.7 12 2.7 12 2.7s-4.2 0-6.8.2c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.3v2c0 2.1.3 4.3.3 4.3s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.3 21.8 12 21.8 12 21.8s4.2 0 6.8-.2c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.3-2.1.3-4.3v-2C23.3 9.1 23 7 23 7zm-13.5 8.7V8.3l8 3.7-8 3.7z"/>
              </svg>
            </div>
          )}
          {/* Playback bar */}
          <div className="yt-lf-playbar">
            <div className="yt-lf-playbar-fill" style={{ width: '35%' }} />
          </div>
        </div>

        {/* Title + channel */}
        <div className="yt-lf-meta">
          <div className="yt-lf-title">{title.slice(0, 70)}{title.length > 70 ? '…' : ''}</div>
          <div className="yt-lf-channel-row">
            <div className="yt-lf-avatar">M</div>
            <div className="yt-lf-channel-name">marketer_pro</div>
            <button className="yt-lf-subscribe">Subscribe</button>
          </div>
          {/* Action row */}
          <div className="yt-lf-actions">
            <div className="yt-lf-action-pill">
              <span>👍</span>
              <span className="yt-lf-action-count">1.2K</span>
            </div>
            <div className="yt-lf-action-pill">
              <span>👎</span>
            </div>
            <div className="yt-lf-action-pill">Share</div>
            <div className="yt-lf-action-pill">Save</div>
            <div className="yt-lf-action-pill">⋯</div>
          </div>
        </div>

        {/* Up next */}
        <div className="yt-lf-upnext-label">Up next</div>
        {[1, 2].map(i => (
          <div key={i} className="yt-lf-upnext-item">
            <div className="yt-lf-upnext-thumb" />
            <div className="yt-lf-upnext-info">
              <div className="yt-lf-upnext-title">Suggested video {i}</div>
              <div className="yt-lf-upnext-channel">Channel name · 100K views</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function YouTubeStudioPanel() {
  const { theme } = useBrandTheme()
  const [draft, setDraft]         = useState<YtDraft>(DEFAULT_DRAFT)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [result, setResult]         = useState<{ ok: boolean; message: string } | null>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)

  function update<K extends keyof YtDraft>(key: K, val: YtDraft[K]) {
    setDraft(d => ({ ...d, [key]: val }))
  }

  function setVideoType(vt: VideoType) {
    setDraft(d => ({ ...d, videoType: vt }))
  }

  function toggleAdType(key: keyof AdSettings) {
    setDraft(d => ({
      ...d,
      adSettings: { ...d.adSettings, [key]: !d.adSettings[key] },
    }))
  }

  function toggleEndScreen(el: string) {
    setDraft(d => {
      const has = d.endScreenElements.includes(el)
      return {
        ...d,
        endScreenElements: has
          ? d.endScreenElements.filter(e => e !== el)
          : [...d.endScreenElements, el],
      }
    })
  }

  function toggleCard(el: string) {
    setDraft(d => {
      const has = d.cardElements.includes(el)
      return {
        ...d,
        cardElements: has
          ? d.cardElements.filter(e => e !== el)
          : [...d.cardElements, el],
      }
    })
  }

  const onThumbnailChange = useCallback((m: MediaItem[]) => setDraft(d => ({ ...d, thumbnail: m })), [])
  const onTagsChange      = useCallback((t: string[])    => setDraft(d => ({ ...d, hashtags: t })), [])
  const onSchedule        = useCallback((dt: Date)        => setDraft(d => ({ ...d, scheduledAt: dt })), [])

  const handleToggleEndScreen = useCallback((el: string) => toggleEndScreen(el), [])
  const handleToggleCard      = useCallback((el: string) => toggleCard(el), [])
  const handleToggleAdType    = useCallback((key: keyof AdSettings) => toggleAdType(key), [])

  const generateDescription = useCallback(async () => {
    if (generating) return
    setGenerating(true)
    try {
      const res = await apiFetch<{ description: string; hashtags?: string[] }>(
        `${CAMPAIGN_API}/ai/youtube-description`,
        {
          method: 'POST',
          json: {
            title: draft.title,
            videoType: draft.videoType,
            category: draft.category,
            hashtags: draft.hashtags,
            brandName: theme.displayName,
          },
        }
      )
      if (res.data?.description) update('description', res.data.description)
      if (res.data?.hashtags?.length) {
        const merged = [...new Set([...draft.hashtags, ...res.data.hashtags])].slice(0, 15)
        update('hashtags', merged)
      }
    } finally {
      setGenerating(false)
    }
  }, [draft.title, draft.videoType, draft.category, draft.hashtags, theme.displayName, generating])

  const publishNow = useCallback(async () => {
    if (publishing) return
    setPublishing(true)
    setResult(null)
    try {
      const res = await apiFetch<{ ok: boolean; videoId?: string; detail?: string }>(
        `${CAMPAIGN_API}/youtube/publish`,
        {
          method: 'POST',
          json: {
            videoType: draft.videoType,
            title: draft.title,
            description: draft.description,
            category: draft.category,
            language: draft.language,
            visibility: draft.visibility,
            madeForKids: draft.madeForKids,
            ageRestricted: draft.ageRestricted,
            monetized: draft.monetized,
            adSettings: draft.adSettings,
            paidPromo: draft.paidPromo,
            hashtags: draft.hashtags,
            scheduledAt: draft.scheduledAt?.toISOString(),
          },
        }
      )
      if (res.data?.ok) {
        setResult({ ok: true, message: `Uploaded! YouTube ID: ${res.data.videoId ?? '—'}` })
        setDraft(DEFAULT_DRAFT)
      } else {
        setResult({ ok: false, message: res.data?.detail ?? 'Upload failed — check your YouTube connection.' })
      }
    } finally {
      setPublishing(false)
    }
  }, [draft, publishing])

  const titleOver = draft.title.length > TITLE_MAX
  const descOver  = draft.description.length > DESC_MAX
  const hasTitle  = draft.title.trim().length > 0
  const canPublish = hasTitle && !titleOver && !descOver
  const isShorts   = draft.videoType === 'shorts'
  const isLive     = draft.videoType === 'live'
  const isPremiere = draft.videoType === 'premiere'

  return (
    <div className="yt-root">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="yt-header">
        <div className="yt-header-left">
          <div className="yt-logo">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
              <path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.2 2.7 12 2.7 12 2.7s-4.2 0-6.8.2c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.3v2c0 2.1.3 4.3.3 4.3s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.3 21.8 12 21.8 12 21.8s4.2 0 6.8-.2c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.3-2.1.3-4.3v-2C23.3 9.1 23 7 23 7zm-13.5 8.7V8.3l8 3.7-8 3.7z"/>
            </svg>
          </div>
          <div>
            <div className="yt-title">YouTube Creative Studio</div>
            <div className="yt-subtitle">YouTube Partner · Content ID Partner</div>
          </div>
        </div>
        <div className="yt-partner-badges">
          <span className="yt-badge yt-badge--partner">YouTube Partner</span>
          <span className="yt-badge yt-badge--contentid">Content ID</span>
        </div>
      </div>

      <div className="yt-layout">

        {/* ── Left: editor ──────────────────────────────────────────────────── */}
        <div className="yt-editor">

          {/* Video type selector */}
          <section className="yt-section">
            <div className="yt-section-title">Video Type</div>
            <div className="yt-format-row">
              {(['long_form', 'shorts', 'live', 'premiere'] as VideoType[]).map(vt => (
                <button
                  key={vt}
                  className={`yt-format-btn${draft.videoType === vt ? ' yt-format-btn--active' : ''}`}
                  onClick={() => setVideoType(vt)}
                >
                  {vt === 'long_form'  && '▶ Long Form'}
                  {vt === 'shorts'     && '⬜ Shorts'}
                  {vt === 'live'       && '⬤ Live'}
                  {vt === 'premiere'   && '★ Premiere'}
                </button>
              ))}
            </div>

            {isShorts && (
              <div className="yt-shorts-warning">
                Vertical 9:16 · Max 60 seconds. Videos over 60 s will be treated as long-form.
              </div>
            )}
          </section>

          {/* Title */}
          <section className="yt-section">
            <div className="yt-section-header">
              <div className="yt-section-title">Title</div>
              <CharCount value={draft.title} max={TITLE_MAX} />
            </div>
            <input
              className={`yt-input${titleOver ? ' yt-input--error' : ''}`}
              type="text"
              placeholder="Add a title that tells viewers what your video is about…"
              value={draft.title}
              maxLength={TITLE_MAX + 10}
              onChange={e => update('title', e.target.value)}
            />
            {titleOver && <div className="yt-field-error">Title exceeds 100 character limit</div>}
          </section>

          {/* Description */}
          <section className="yt-section">
            <div className="yt-section-header">
              <div className="yt-section-title">Description</div>
              <div className="yt-section-actions">
                <CharCount value={draft.description} max={DESC_MAX} />
                <button className="yt-ai-btn" onClick={generateDescription} disabled={generating}>
                  {generating
                    ? <><span className="yt-spinner" /> Generating…</>
                    : <>⚡ AI Description</>
                  }
                </button>
              </div>
            </div>
            <textarea
              ref={descRef}
              className={`yt-textarea${descOver ? ' yt-textarea--error' : ''}`}
              rows={6}
              placeholder="Tell viewers about your video — include keywords, links, timestamps…"
              value={draft.description}
              onChange={e => update('description', e.target.value)}
            />
            {descOver && <div className="yt-field-error">Description exceeds 5,000 character limit</div>}
          </section>

          {/* Live-specific options */}
          {isLive && (
            <section className="yt-section">
              <div className="yt-section-title">Live Settings</div>
              <div className="yt-field-label">Latency</div>
              <div className="yt-chips-row">
                {LATENCY_OPTIONS.map(opt => (
                  <Chip
                    key={opt}
                    label={opt}
                    active={draft.latencyMode === opt}
                    onClick={() => update('latencyMode', opt)}
                  />
                ))}
              </div>
              <div className="yt-toggles" style={{ marginTop: '0.5rem' }}>
                <Toggle
                  checked={draft.dvrEnabled}
                  onChange={v => update('dvrEnabled', v)}
                  label="Enable DVR"
                  sub="Viewers can pause, rewind, and fast-forward"
                />
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <div className="yt-field-label">Scheduled start time</div>
                <input
                  className="yt-input"
                  type="datetime-local"
                  value={draft.liveScheduledAt}
                  onChange={e => update('liveScheduledAt', e.target.value)}
                />
              </div>
            </section>
          )}

          {/* Premiere-specific options */}
          {isPremiere && (
            <section className="yt-section">
              <div className="yt-section-title">Premiere Settings</div>
              <div className="yt-grid">
                <div>
                  <div className="yt-field-label">Premiere date</div>
                  <input
                    className="yt-input"
                    type="date"
                    value={draft.premiereDate}
                    onChange={e => update('premiereDate', e.target.value)}
                  />
                </div>
                <div>
                  <div className="yt-field-label">Premiere time</div>
                  <input
                    className="yt-input"
                    type="time"
                    value={draft.premiereTime}
                    onChange={e => update('premiereTime', e.target.value)}
                  />
                </div>
              </div>
              <div className="yt-field-hint">
                Upload now and schedule the premiere moment — viewers can set a reminder.
              </div>
            </section>
          )}

          {/* Video details */}
          <section className="yt-section">
            <div className="yt-section-title">Video Details</div>

            {/* Thumbnail */}
            <div className="yt-field-label">Thumbnail <span className="yt-field-hint-inline">1280×720 recommended</span></div>
            <MediaDropZone
              items={draft.thumbnail}
              onChange={onThumbnailChange}
              maxItems={1}
              accept="image/*"
              aspectHint="1280×720 (16:9)"
            />

            <div className="yt-grid" style={{ marginTop: '0.75rem' }}>
              <div>
                <div className="yt-field-label">Category</div>
                <select
                  className="yt-select"
                  value={draft.category}
                  onChange={e => update('category', e.target.value)}
                >
                  {YT_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="yt-field-label">Video language</div>
                <select
                  className="yt-select"
                  value={draft.language}
                  onChange={e => update('language', e.target.value)}
                >
                  {YT_LANGUAGES.map(lang => (
                    <option key={lang.value} value={lang.value}>{lang.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <div className="yt-field-label">Recording date <span className="yt-field-hint-inline">optional</span></div>
              <input
                className="yt-input"
                type="date"
                value={draft.recordingDate}
                onChange={e => update('recordingDate', e.target.value)}
              />
            </div>
          </section>

          {/* Audience */}
          <section className="yt-section">
            <div className="yt-section-title">Audience</div>
            <div className="yt-toggles">
              <Toggle
                checked={draft.madeForKids}
                onChange={v => update('madeForKids', v)}
                label="Made for Kids (COPPA)"
                sub="Required by law if content targets children"
              />
            </div>

            {draft.madeForKids && (
              <div className="yt-coppa-banner">
                <span className="yt-coppa-icon">⚠</span>
                This video is made for kids. Personalized ads and certain features will be disabled.
              </div>
            )}

            <div className="yt-toggles" style={{ marginTop: '0.5rem' }}>
              <Toggle
                checked={draft.ageRestricted}
                onChange={v => update('ageRestricted', v)}
                label="Age restriction 18+"
                sub="Restricts the video to viewers 18 and older"
              />
            </div>

            <div className="yt-field-label" style={{ marginTop: '0.75rem' }}>Visibility</div>
            <div className="yt-visibility-grid">
              {(['public', 'unlisted', 'private', 'scheduled'] as Visibility[]).map(v => (
                <button
                  key={v}
                  className={`yt-visibility-btn${draft.visibility === v ? ' yt-visibility-btn--active' : ''}`}
                  onClick={() => update('visibility', v)}
                >
                  {v === 'public'    && '🌐 Public'}
                  {v === 'unlisted'  && '🔗 Unlisted'}
                  {v === 'private'   && '🔒 Private'}
                  {v === 'scheduled' && '🕐 Scheduled'}
                </button>
              ))}
            </div>
          </section>

          {/* Monetization */}
          <section className="yt-section">
            <div className="yt-section-header">
              <div className="yt-section-title">
                Monetization
                <span className="yt-pro-badge">Pro</span>
              </div>
            </div>
            <div className="yt-toggles">
              <Toggle
                checked={draft.monetized}
                onChange={v => update('monetized', v)}
                label="Enable monetization"
                sub="Requires YouTube Partner Program membership"
              />
            </div>

            {draft.monetized && (
              <div className="yt-ad-types">
                <div className="yt-field-label" style={{ marginBottom: '0.375rem' }}>Ad formats</div>
                {AD_TYPES.map(ad => (
                  <label key={ad.key} className="yt-checkbox-row">
                    <input
                      type="checkbox"
                      checked={draft.adSettings[ad.key as keyof AdSettings]}
                      onChange={() => handleToggleAdType(ad.key as keyof AdSettings)}
                      className="yt-checkbox"
                    />
                    <span className="yt-checkbox-label">{ad.label}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="yt-toggles" style={{ marginTop: '0.5rem' }}>
              <Toggle
                checked={draft.paidPromo}
                onChange={v => update('paidPromo', v)}
                label="Contains paid promotion"
                sub="Discloses sponsorships per YouTube policy"
              />
            </div>

            {draft.paidPromo && (
              <div className="yt-paid-promo-banner">
                <span className="yt-paid-promo-icon">ℹ</span>
                This video contains a paid promotion such as a sponsorship or affiliate link.
              </div>
            )}
          </section>

          {/* End screen + Cards */}
          <section className="yt-section">
            <div className="yt-section-title">End Screen</div>
            <div className="yt-chips-row">
              {END_SCREEN_ELEMENTS.map(el => (
                <Chip
                  key={el}
                  label={el}
                  active={draft.endScreenElements.includes(el)}
                  onClick={() => handleToggleEndScreen(el)}
                />
              ))}
            </div>
            <div className="yt-field-hint">Added automatically to the last 20 seconds of your video.</div>
          </section>

          <section className="yt-section">
            <div className="yt-section-title">Cards</div>
            <div className="yt-chips-row">
              {CARD_ELEMENTS.map(el => (
                <Chip
                  key={el}
                  label={el}
                  active={draft.cardElements.includes(el)}
                  onClick={() => handleToggleCard(el)}
                />
              ))}
            </div>
            <div className="yt-field-hint">Interactive cards appear during playback — link to related content.</div>
          </section>

          {/* Hashtags */}
          <section className="yt-section">
            <div className="yt-section-title">Hashtags</div>
            <HashtagBuilder
              tags={draft.hashtags}
              onChange={onTagsChange}
              maxTags={15}
              suggestions={TRENDING_TAGS}
              platform="YouTube"
            />
            <div className="yt-field-hint">Up to 15 hashtags. First 3 appear below your video title.</div>
          </section>

          {/* Schedule */}
          <section className="yt-section">
            <div className="yt-section-title">Schedule</div>
            <ScheduleCalendar
              value={draft.scheduledAt}
              onChange={onSchedule}
              bestTimes={YT_BEST_TIMES}
              platform="YouTube"
            />
          </section>

          {/* Publish */}
          <div className="yt-publish-row">
            <button
              className="yt-publish-btn yt-publish-btn--outline"
              disabled={!hasTitle || publishing}
              onClick={() => setResult({ ok: true, message: 'Draft saved.' })}
            >
              Save Draft
            </button>
            <button
              className="yt-publish-btn yt-publish-btn--fill"
              onClick={publishNow}
              disabled={!canPublish || publishing}
            >
              {publishing
                ? <><span className="yt-spinner" /> Uploading…</>
                : <>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ flexShrink: 0 }}>
                      <path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.2 2.7 12 2.7 12 2.7s-4.2 0-6.8.2c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.3v2c0 2.1.3 4.3.3 4.3s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.3 21.8 12 21.8 12 21.8s4.2 0 6.8-.2c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.3-2.1.3-4.3v-2C23.3 9.1 23 7 23 7zm-13.5 8.7V8.3l8 3.7-8 3.7z"/>
                    </svg>
                    Upload to YouTube
                  </>
              }
            </button>
          </div>

          {result && (
            <div className={`yt-result${result.ok ? ' yt-result--ok' : ' yt-result--err'}`}>
              {result.message}
            </div>
          )}
        </div>

        {/* ── Right: preview ─────────────────────────────────────────────────── */}
        <div className="yt-preview-col">
          <div className="yt-preview-label">
            {isShorts ? 'Live Preview · 9:16 Shorts' : 'Live Preview · 16:9'}
          </div>

          {isShorts
            ? <ShortsPreview draft={draft} />
            : <LongFormPreview draft={draft} />
          }

          {/* Partner Readiness */}
          <div className="yt-checklist">
            <div className="yt-checklist-title">Partner Readiness</div>
            <CheckItem ok={true}                             label="Channel verified" />
            <CheckItem ok={true}                             label="1,000+ subscribers" />
            <CheckItem ok={true}                             label="4,000+ watch hours (last 12 months)" />
            <CheckItem ok={true}                             label="Community guidelines compliant" />
            <CheckItem ok={true}                             label="No active strikes" />
            <CheckItem ok={draft.monetized}                  label="AdSense account linked" />
            <CheckItem ok={theme.displayName.trim().length > 0} label="Brand Account configured" />
          </div>
        </div>
      </div>
    </div>
  )
}
