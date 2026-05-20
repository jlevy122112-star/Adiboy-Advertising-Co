/**
 * LinkedIn Creative Studio — Marketing Partner · Campaign Manager.
 *
 * Post types: post · article · document (PDF carousel) · poll
 * Features:
 *   - SVG circle char-count for posts (3,000 char limit)
 *   - Article editor with cover image + long-form body textarea
 *   - Document carousel with page count badge overlay
 *   - Poll builder: question + 2–4 options + duration + who-can-vote
 *   - Visibility: anyone / connections / group_members (grid buttons)
 *   - Custom CSS toggle interactions (comments, reactions, resharing)
 *   - Industry audience targeting chips (multi-select)
 *   - Branded content: sponsored toggle + partner tag input
 *   - LinkedIn phone mock with blue top bar + "in" logo + post card + reaction bar
 *   - ScheduleCalendar with LI peak times
 *   - Partner Readiness checklist (7 items)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useContentBrief } from '../generation/ContentBriefContext'
import { useBrandTheme } from '../BrandThemePanel'
import { MediaDropZone, type MediaItem } from '../platform-studio/MediaDropZone'
import { ScheduleCalendar, type BestTimeSlot } from '../platform-studio/ScheduleCalendar'
import { HashtagBuilder } from '../platform-studio/HashtagBuilder'
import { apiFetch } from '../hooks/useApi'
import './linkedin-studio.css'

// ── Constants ────────────────────────────────────────────────────────────────

const POST_MAX = 3000
const ARTICLE_TITLE_MAX = 150
const CAMPAIGN_API = (import.meta.env.VITE_CAMPAIGN_API_ORIGIN as string | undefined) ?? 'http://localhost:8801'

const LI_BEST_TIMES: BestTimeSlot[] = [
  { hour: 7,  score: 'good' },
  { hour: 8,  score: 'peak' },
  { hour: 9,  score: 'peak' },
  { hour: 12, score: 'peak' },
  { hour: 17, score: 'good' },
  { hour: 18, score: 'good' },
]

const INDUSTRY_CHIPS = [
  'Tech', 'Finance', 'Healthcare', 'Marketing', 'HR', 'Sales', 'Education',
]

const POLL_DURATION_OPTIONS: Array<{ value: PollDuration; label: string }> = [
  { value: '1d',  label: '1 day' },
  { value: '3d',  label: '3 days' },
  { value: '7d',  label: '7 days' },
  { value: '14d', label: '14 days' },
]

const WHO_CAN_VOTE_OPTIONS: Array<{ value: PollVoters; label: string; desc: string }> = [
  { value: 'connections', label: 'Connections', desc: '1st-degree only' },
  { value: 'followers',   label: 'Followers',   desc: 'All your followers' },
  { value: 'all',         label: 'Anyone',       desc: 'Open to all' },
]

const HASHTAG_SUGGESTIONS = [
  'linkedin', 'networking', 'leadership', 'b2b', 'growth', 'innovation',
  'marketing', 'sales', 'hiring', 'entrepreneurship', 'techtrends',
  'futureofwork', 'productivity', 'careeradvice', 'contentmarketing',
]

// ── Types ────────────────────────────────────────────────────────────────────

type PostType     = 'post' | 'article' | 'document' | 'poll'
type Visibility   = 'anyone' | 'connections' | 'group_members'
type PollDuration = '1d' | '3d' | '7d' | '14d'
type PollVoters   = 'connections' | 'followers' | 'all'

interface PollOption {
  id: string
  text: string
}

interface LiDraft {
  postType:          PostType
  // post
  body:              string
  media:             MediaItem[]
  hashtags:          string[]
  // article
  articleTitle:      string
  articleBody:       string
  articleCover:      MediaItem[]
  // document
  docTitle:          string
  docMedia:          MediaItem[]
  // poll
  pollQuestion:      string
  pollOptions:       PollOption[]
  pollDuration:      PollDuration
  pollVoters:        PollVoters
  // shared
  visibility:        Visibility
  commentsEnabled:   boolean
  reactionsEnabled:  boolean
  resharingEnabled:  boolean
  industries:        string[]
  sponsored:         boolean
  partnerTag:        string
  scheduledAt:       Date | null
}

const makePollOption = (): PollOption => ({ id: Math.random().toString(36).slice(2), text: '' })

const DEFAULT_DRAFT: LiDraft = {
  postType:         'post',
  body:             '',
  media:            [],
  hashtags:         [],
  articleTitle:     '',
  articleBody:      '',
  articleCover:     [],
  docTitle:         '',
  docMedia:         [],
  pollQuestion:     '',
  pollOptions:      [makePollOption(), makePollOption()],
  pollDuration:     '7d',
  pollVoters:       'all',
  visibility:       'anyone',
  commentsEnabled:  true,
  reactionsEnabled: true,
  resharingEnabled: true,
  industries:       [],
  sponsored:        false,
  partnerTag:       '',
  scheduledAt:      null,
}

const VISIBILITY_OPTIONS: Array<{ value: Visibility; label: string; desc: string }> = [
  { value: 'anyone',        label: 'Anyone',         desc: 'Public on LinkedIn' },
  { value: 'connections',   label: 'Connections',    desc: '1st-degree network' },
  { value: 'group_members', label: 'Group Members',  desc: 'Selected group only' },
]

// ── Sub-components ───────────────────────────────────────────────────────────

function CharCircle({ value, max }: { value: string; max: number }) {
  const len  = value.length
  const pct  = Math.min(len / max, 1)
  const r    = 16
  const circ = 2 * Math.PI * r
  const dash = circ * (1 - pct)
  const color = pct > 0.9 ? 'var(--danger)' : pct > 0.75 ? 'var(--warning)' : '#0A66C2'
  const remaining = max - len

  return (
    <div className="li-char-circle" title={`${len}/${max} characters`}>
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--border)" strokeWidth="2.5" />
        <circle
          cx="20" cy="20" r={r}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
          style={{ transition: 'stroke-dashoffset 0.2s ease, stroke 0.2s ease' }}
        />
      </svg>
      <span className="li-char-circle-num" style={{ color }}>
        {remaining < 0 ? remaining : remaining <= 100 ? remaining : ''}
      </span>
    </div>
  )
}

function Toggle({ checked, onChange, label, sub }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string
}) {
  return (
    <label className="li-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="li-toggle-input"
      />
      <span className="li-toggle-track">
        <span className="li-toggle-thumb" />
      </span>
      <span className="li-toggle-text">
        <span className="li-toggle-label">{label}</span>
        {sub && <span className="li-toggle-sub">{sub}</span>}
      </span>
    </label>
  )
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`li-check-item${ok ? ' li-check-item--ok' : ''}`}>
      <span className="li-check-icon">{ok ? '✓' : '○'}</span>
      <span className="li-check-label">{label}</span>
    </div>
  )
}

// ── Phone preview — LinkedIn chrome ─────────────────────────────────────────

function PhonePreview({ draft, avatarUrl, displayName }: {
  draft: LiDraft; avatarUrl: string | null; displayName: string
}) {
  const previewText = (() => {
    if (draft.postType === 'post')     return draft.body.slice(0, 200)
    if (draft.postType === 'article')  return draft.articleTitle || 'Untitled Article'
    if (draft.postType === 'document') return draft.docTitle || 'Document'
    return draft.pollQuestion || 'Your poll question'
  })()

  const cover = draft.postType === 'post'     ? (draft.media[0] ?? null)
              : draft.postType === 'article'  ? (draft.articleCover[0] ?? null)
              : draft.postType === 'document' ? (draft.docMedia[0] ?? null)
              : null

  return (
    <div className="li-phone">
      {/* LinkedIn top bar */}
      <div className="li-phone-topbar">
        <div className="li-phone-logo">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        </div>
        <div className="li-phone-topbar-icons">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" stroke="white" strokeWidth="2" fill="none"/></svg>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </div>
      </div>

      {/* Post card */}
      <div className="li-phone-card">
        {/* Post header */}
        <div className="li-card-head">
          <div className="li-card-avatar">
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} className="li-card-avatar-img" />
              : <div className="li-card-avatar-placeholder">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z"/></svg>
                </div>
            }
          </div>
          <div className="li-card-meta">
            <div className="li-card-name">
              {displayName || 'Your Brand'}
              <span className="li-card-degree">1st</span>
            </div>
            <div className="li-card-followers">12.4K followers</div>
            <div className="li-card-time">Just now · 🌐</div>
          </div>
          <button className="li-card-more">···</button>
        </div>

        {/* Post body */}
        <div className="li-card-body">
          {previewText
            ? <p className="li-card-text">{previewText}{draft.postType === 'post' && draft.body.length > 200 ? '… see more' : ''}</p>
            : <p className="li-card-text li-card-text--placeholder">Your post will appear here…</p>
          }
          {draft.hashtags.length > 0 && draft.postType === 'post' && (
            <p className="li-card-tags">{draft.hashtags.slice(0, 4).map(t => `#${t}`).join(' ')}</p>
          )}
        </div>

        {/* Media / poll preview */}
        {cover && (
          <div className="li-card-media">
            {cover.type === 'video'
              ? <video src={cover.url} className="li-card-img" muted />
              : <img src={cover.url} alt={cover.altText || cover.name} className="li-card-img" />
            }
            {draft.postType === 'document' && draft.docMedia.length > 0 && (
              <div className="li-card-page-badge">{draft.docMedia.length} pages</div>
            )}
          </div>
        )}

        {draft.postType === 'poll' && draft.pollQuestion && (
          <div className="li-card-poll">
            <div className="li-card-poll-q">{draft.pollQuestion.slice(0, 60)}</div>
            {draft.pollOptions.filter(o => o.text).slice(0, 3).map((opt, i) => (
              <div key={opt.id} className="li-card-poll-option">
                <div className="li-card-poll-bar" style={{ width: `${[55, 30, 15][i] ?? 10}%` }} />
                <span className="li-card-poll-label">{opt.text}</span>
              </div>
            ))}
            <div className="li-card-poll-meta">{draft.pollDuration} · 0 votes</div>
          </div>
        )}

        {draft.sponsored && draft.partnerTag && (
          <div className="li-card-sponsored">Promoted · {draft.partnerTag}</div>
        )}

        {/* Reaction bar */}
        <div className="li-card-reactions">
          <button className="li-reaction-btn">👍 Like</button>
          <button className="li-reaction-btn">💬 Comment</button>
          <button className="li-reaction-btn">🔁 Repost</button>
          <button className="li-reaction-btn">✈️ Send</button>
        </div>
      </div>

      {/* Home indicator */}
      <div className="li-phone-home" />
    </div>
  )
}

// ── Main panel ───────────────────────────────────────────────────────────────

export function LinkedInStudioPanel() {
  const { theme } = useBrandTheme()
  const [draft, setDraft]           = useState<LiDraft>(DEFAULT_DRAFT)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [result, setResult]         = useState<{ ok: boolean; message: string } | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  function update<K extends keyof LiDraft>(key: K, val: LiDraft[K]) {
    setDraft(d => ({ ...d, [key]: val }))
  }

  function patch(partial: Partial<LiDraft>) {
    setDraft(d => ({ ...d, ...partial }))
  }

  const { briefId, adaptation, isSelected } = useContentBrief('linkedin')
  useEffect(() => {
    if (!briefId || !adaptation || !isSelected) return
    const body = [adaptation.copy.headline, adaptation.copy.body, adaptation.copy.cta].filter(Boolean).join('\n\n')
    setDraft(d => ({ ...d, body: body.slice(0, 3000), hashtags: adaptation.copy.hashtags ?? d.hashtags }))
  }, [briefId, adaptation, isSelected])

  const onMediaChange        = useCallback((m: MediaItem[]) => setDraft(d => ({ ...d, media: m })),        [])
  const onArticleCoverChange = useCallback((m: MediaItem[]) => setDraft(d => ({ ...d, articleCover: m })), [])
  const onDocMediaChange     = useCallback((m: MediaItem[]) => setDraft(d => ({ ...d, docMedia: m })),     [])
  const onTagsChange         = useCallback((t: string[])    => setDraft(d => ({ ...d, hashtags: t })),     [])
  const onSchedule           = useCallback((dt: Date)        => setDraft(d => ({ ...d, scheduledAt: dt })), [])

  function toggleIndustry(ind: string) {
    setDraft(d => ({
      ...d,
      industries: d.industries.includes(ind)
        ? d.industries.filter(i => i !== ind)
        : [...d.industries, ind],
    }))
  }

  function addPollOption() {
    if (draft.pollOptions.length >= 4) return
    update('pollOptions', [...draft.pollOptions, makePollOption()])
  }

  function removePollOption(id: string) {
    if (draft.pollOptions.length <= 2) return
    update('pollOptions', draft.pollOptions.filter(o => o.id !== id))
  }

  function updatePollOption(id: string, text: string) {
    update('pollOptions', draft.pollOptions.map(o => o.id === id ? { ...o, text } : o))
  }

  async function generateCaption() {
    if (generating) return
    setGenerating(true)
    try {
      const res = await apiFetch<{ body: string; hashtags?: string[] }>(
        `${CAMPAIGN_API}/ai/linkedin-post`,
        {
          method: 'POST',
          json: {
            postType:  draft.postType,
            hashtags:  draft.hashtags,
            brandName: theme.displayName,
            industries: draft.industries,
          },
        }
      )
      if (res.data?.body)    update('body', res.data.body)
      if (res.data?.hashtags?.length) {
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
        `${CAMPAIGN_API}/linkedin/publish`,
        {
          method: 'POST',
          json: {
            postType:        draft.postType,
            body:            draft.body,
            hashtags:        draft.hashtags,
            articleTitle:    draft.articleTitle,
            articleBody:     draft.articleBody,
            docTitle:        draft.docTitle,
            pollQuestion:    draft.pollQuestion,
            pollOptions:     draft.pollOptions.map(o => o.text).filter(Boolean),
            pollDuration:    draft.pollDuration,
            pollVoters:      draft.pollVoters,
            visibility:      draft.visibility,
            commentsEnabled: draft.commentsEnabled,
            sponsored:       draft.sponsored,
            partnerTag:      draft.partnerTag || undefined,
            industries:      draft.industries,
            mediaIds:        draft.media.map(m => m.id),
          },
        }
      )
      if (res.data?.ok) {
        setResult({ ok: true, message: `Published! Post ID: ${res.data.postId ?? '—'}` })
        setDraft(DEFAULT_DRAFT)
      } else {
        setResult({ ok: false, message: res.data?.detail ?? 'Publish failed — check your LinkedIn connection.' })
      }
    } finally {
      setPublishing(false)
    }
  }

  const bodyFull    = draft.body + (draft.hashtags.length && draft.postType === 'post' ? '\n\n' + draft.hashtags.map(t => `#${t}`).join(' ') : '')
  const overLimit   = draft.postType === 'post' && bodyFull.length > POST_MAX
  const hasContent  = draft.postType === 'post'     ? draft.body.trim().length > 0
                    : draft.postType === 'article'  ? draft.articleTitle.trim().length > 0 && draft.articleBody.trim().length > 0
                    : draft.postType === 'document' ? draft.docMedia.length > 0 && draft.docTitle.trim().length > 0
                    : draft.pollQuestion.trim().length > 0 && draft.pollOptions.filter(o => o.text.trim()).length >= 2
  const canPublish  = hasContent && !overLimit
  const displayName = theme.displayName.trim() || 'Your Brand'
  const avatarUrl   = theme.logoUrl ?? null

  return (
    <div className="li-root">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="li-header">
        <div className="li-header-left">
          <div className="li-logo">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </div>
          <div>
            <div className="li-title">LinkedIn Creative Studio</div>
            <div className="li-subtitle">Marketing Partner · Campaign Manager</div>
          </div>
        </div>
        <div className="li-partner-badges">
          <span className="li-badge li-badge--marketing">Marketing Partner</span>
          <span className="li-badge li-badge--campaign">Campaign Manager</span>
        </div>
      </div>

      <div className="li-grid">

        {/* ── Left: editor ──────────────────────────────────────────────────── */}
        <div className="li-editor">

          {/* Post type selector */}
          <section className="li-section">
            <div className="li-section-title">Post Type</div>
            <div className="li-type-row">
              {(['post', 'article', 'document', 'poll'] as PostType[]).map(t => (
                <button
                  key={t}
                  className={`li-type-btn${draft.postType === t ? ' li-type-btn--active' : ''}`}
                  onClick={() => patch({ ...DEFAULT_DRAFT, postType: t })}
                >
                  {t === 'post'     && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>}
                  {t === 'article'  && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 4h16v4H4z"/><path d="M4 12h10M4 16h7"/></svg>}
                  {t === 'document' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                  {t === 'poll'     && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </section>

          {/* ── POST ─────────────────────────────────────────────────────── */}
          {draft.postType === 'post' && (
            <>
              <section className="li-section">
                <div className="li-section-header">
                  <div className="li-section-title">Post Text</div>
                  <div className="li-section-actions">
                    <CharCircle value={bodyFull} max={POST_MAX} />
                    <button className="li-ai-btn" onClick={generateCaption} disabled={generating}>
                      {generating ? <><span className="li-spinner" /> Generating…</> : <>⚡ AI Write</>}
                    </button>
                  </div>
                </div>
                <textarea
                  ref={bodyRef}
                  className={`li-textarea${overLimit ? ' li-textarea--error' : ''}`}
                  rows={6}
                  placeholder="Share your insights, news, or story — LinkedIn favors authentic, value-driven posts…"
                  value={draft.body}
                  onChange={e => update('body', e.target.value)}
                />
                {overLimit && <div className="li-field-error">Post text exceeds 3,000 character limit</div>}
              </section>

              <section className="li-section">
                <div className="li-section-title">
                  Media
                  <span className="li-section-badge">{draft.media.length}/1</span>
                </div>
                <MediaDropZone
                  items={draft.media}
                  onChange={onMediaChange}
                  maxItems={1}
                  accept="image/*,video/*"
                  aspectHint="1.91:1 landscape or 1:1 square recommended"
                />
              </section>

              <section className="li-section">
                <div className="li-section-header">
                  <div className="li-section-title">Hashtags</div>
                </div>
                <HashtagBuilder
                  tags={draft.hashtags}
                  onChange={onTagsChange}
                  maxTags={30}
                  suggestions={HASHTAG_SUGGESTIONS}
                  platform="LinkedIn"
                />
              </section>
            </>
          )}

          {/* ── ARTICLE ──────────────────────────────────────────────────── */}
          {draft.postType === 'article' && (
            <>
              <section className="li-section">
                <div className="li-section-header">
                  <div className="li-section-title">Article Title</div>
                  <span className="li-char-badge" style={{ color: draft.articleTitle.length > ARTICLE_TITLE_MAX * 0.9 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {draft.articleTitle.length}/{ARTICLE_TITLE_MAX}
                  </span>
                </div>
                <input
                  className="li-input"
                  placeholder="A compelling headline that makes people click…"
                  maxLength={ARTICLE_TITLE_MAX}
                  value={draft.articleTitle}
                  onChange={e => update('articleTitle', e.target.value)}
                />
              </section>

              <section className="li-section">
                <div className="li-section-title">Cover Image</div>
                <MediaDropZone
                  items={draft.articleCover}
                  onChange={onArticleCoverChange}
                  maxItems={1}
                  accept="image/*"
                  aspectHint="1200×627 px (1.91:1) recommended"
                />
              </section>

              <section className="li-section">
                <div className="li-section-header">
                  <div className="li-section-title">Article Body</div>
                  <button className="li-ai-btn" onClick={generateCaption} disabled={generating}>
                    {generating ? <><span className="li-spinner" /> Generating…</> : <>⚡ AI Draft</>}
                  </button>
                </div>
                <textarea
                  className="li-textarea li-textarea--long"
                  rows={12}
                  placeholder="Write your long-form article here. LinkedIn articles support rich text — structure with headers, lists, and key takeaways…"
                  value={draft.articleBody}
                  onChange={e => update('articleBody', e.target.value)}
                />
                <div className="li-field-hint">
                  Aim for 1,000–2,000 words for best organic reach.
                </div>
              </section>
            </>
          )}

          {/* ── DOCUMENT ─────────────────────────────────────────────────── */}
          {draft.postType === 'document' && (
            <>
              <section className="li-section">
                <div className="li-section-title">Document Title</div>
                <input
                  className="li-input"
                  placeholder="e.g. 2025 B2B Marketing Playbook"
                  value={draft.docTitle}
                  onChange={e => update('docTitle', e.target.value)}
                />
                <div className="li-field-hint">Shown as the carousel headline — 70 chars max recommended.</div>
              </section>

              <section className="li-section">
                <div className="li-section-header">
                  <div className="li-section-title">PDF / Slides</div>
                  <span className="li-section-badge">{draft.docMedia.length} pages</span>
                </div>
                <MediaDropZone
                  items={draft.docMedia}
                  onChange={onDocMediaChange}
                  maxItems={300}
                  accept="application/pdf,image/*"
                  aspectHint="Upload PDF or individual slide images (1:1 or 4:3)"
                />
                <div className="li-field-hint">
                  LinkedIn Document posts (carousel PDFs) drive 3× higher engagement than standard posts.
                </div>
              </section>
            </>
          )}

          {/* ── POLL ─────────────────────────────────────────────────────── */}
          {draft.postType === 'poll' && (
            <>
              <section className="li-section">
                <div className="li-section-title">Poll Question</div>
                <input
                  className="li-input"
                  placeholder="Ask your professional network a question…"
                  maxLength={140}
                  value={draft.pollQuestion}
                  onChange={e => update('pollQuestion', e.target.value)}
                />
                <span className="li-char-badge" style={{ color: draft.pollQuestion.length > 126 ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {draft.pollQuestion.length}/140
                </span>
              </section>

              <section className="li-section">
                <div className="li-section-header">
                  <div className="li-section-title">Options</div>
                  {draft.pollOptions.length < 4 && (
                    <button className="li-add-btn" onClick={addPollOption}>+ Add option</button>
                  )}
                </div>
                <div className="li-poll-options">
                  {draft.pollOptions.map((opt, idx) => (
                    <div key={opt.id} className="li-poll-option-row">
                      <div className="li-poll-bar-container">
                        <div className="li-poll-bar-fill" style={{ width: `${[55, 30, 10, 5][idx] ?? 5}%` }} />
                        <input
                          className="li-poll-input"
                          placeholder={`Option ${idx + 1}`}
                          maxLength={30}
                          value={opt.text}
                          onChange={e => updatePollOption(opt.id, e.target.value)}
                        />
                      </div>
                      {draft.pollOptions.length > 2 && (
                        <button
                          className="li-poll-remove"
                          onClick={() => removePollOption(opt.id)}
                          aria-label={`Remove option ${idx + 1}`}
                        >×</button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="li-section">
                <div className="li-section-title">Poll Duration</div>
                <div className="li-duration-chips">
                  {POLL_DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={`li-duration-chip${draft.pollDuration === opt.value ? ' li-duration-chip--active' : ''}`}
                      onClick={() => update('pollDuration', opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="li-section">
                <div className="li-section-title">Who Can Vote</div>
                <div className="li-visibility-grid">
                  {WHO_CAN_VOTE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={`li-visibility-btn${draft.pollVoters === opt.value ? ' li-visibility-btn--active' : ''}`}
                      onClick={() => update('pollVoters', opt.value)}
                    >
                      <div className="li-visibility-label">{opt.label}</div>
                      <div className="li-visibility-desc">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ── Visibility (shared) ───────────────────────────────────────── */}
          <section className="li-section">
            <div className="li-section-title">Visibility</div>
            <div className="li-visibility-grid">
              {VISIBILITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`li-visibility-btn${draft.visibility === opt.value ? ' li-visibility-btn--active' : ''}`}
                  onClick={() => update('visibility', opt.value)}
                >
                  <div className="li-visibility-label">{opt.label}</div>
                  <div className="li-visibility-desc">{opt.desc}</div>
                </button>
              ))}
            </div>
          </section>

          {/* ── Interactions ─────────────────────────────────────────────── */}
          <section className="li-section">
            <div className="li-section-title">Interactions</div>
            <div className="li-toggles">
              <Toggle
                checked={draft.commentsEnabled}
                onChange={v => update('commentsEnabled', v)}
                label="Comments enabled"
                sub="Let your network comment"
              />
              <Toggle
                checked={draft.reactionsEnabled}
                onChange={v => update('reactionsEnabled', v)}
                label="Reactions enabled"
                sub="Like, Celebrate, Support, etc."
              />
              <Toggle
                checked={draft.resharingEnabled}
                onChange={v => update('resharingEnabled', v)}
                label="Resharing enabled"
                sub="Allow network reposts"
              />
            </div>
          </section>

          {/* ── Audience targeting ────────────────────────────────────────── */}
          <section className="li-section">
            <div className="li-section-title">Industry Targeting</div>
            <div className="li-industry-chips">
              {INDUSTRY_CHIPS.map(ind => (
                <button
                  key={ind}
                  className={`li-industry-chip${draft.industries.includes(ind) ? ' li-industry-chip--active' : ''}`}
                  onClick={() => toggleIndustry(ind)}
                >
                  {ind}
                </button>
              ))}
            </div>
            <div className="li-field-hint">Select industries to narrow organic reach. Leave empty for all.</div>
          </section>

          {/* ── Branded content ──────────────────────────────────────────── */}
          <section className="li-section">
            <div className="li-section-title">Branded Content</div>
            <div className="li-branded-info">
              LinkedIn requires disclosure for sponsored or partner content per ad policy.
            </div>
            <div className="li-toggles">
              <Toggle
                checked={draft.sponsored}
                onChange={v => update('sponsored', v)}
                label="Sponsored content"
                sub="Marks post as a paid promotion"
              />
            </div>
            {draft.sponsored && (
              <div className="li-partner-input-wrap">
                <div className="li-field-label">Partner tag (@company)</div>
                <div className="li-input-icon-wrap">
                  <span className="li-input-at">@</span>
                  <input
                    className="li-input li-input--at"
                    placeholder="partnercompany"
                    value={draft.partnerTag}
                    onChange={e => update('partnerTag', e.target.value)}
                  />
                </div>
              </div>
            )}
          </section>

          {/* ── Schedule ─────────────────────────────────────────────────── */}
          <section className="li-section">
            <div className="li-section-title">Schedule</div>
            <ScheduleCalendar
              value={draft.scheduledAt}
              onChange={onSchedule}
              bestTimes={LI_BEST_TIMES}
              platform="LinkedIn"
            />
          </section>

          {/* ── Publish ──────────────────────────────────────────────────── */}
          <div className="li-publish-row">
            <button
              className="li-publish-btn li-publish-btn--outline"
              disabled={!hasContent || publishing}
              onClick={() => setResult({ ok: true, message: 'Draft saved.' })}
            >
              Save Draft
            </button>
            <button
              className="li-publish-btn li-publish-btn--fill"
              onClick={publishNow}
              disabled={!canPublish || publishing}
            >
              {publishing
                ? <><span className="li-spinner" /> Publishing…</>
                : <>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ flexShrink: 0 }}>
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z"/>
                    </svg>
                    Publish to LinkedIn
                  </>
              }
            </button>
          </div>

          {result && (
            <div className={`li-result${result.ok ? ' li-result--ok' : ' li-result--err'}`}>
              {result.message}
            </div>
          )}
        </div>

        {/* ── Right: preview + checklist ────────────────────────────────────── */}
        <div className="li-preview-col">
          <div className="li-preview-label">Live Preview</div>
          <PhonePreview draft={draft} avatarUrl={avatarUrl} displayName={displayName} />

          {/* Partner Readiness */}
          <div className="li-checklist">
            <div className="li-checklist-title">Partner Readiness</div>
            <CheckItem ok={hasContent}                         label="Content written" />
            <CheckItem ok={draft.visibility === 'anyone'}     label="Public visibility" />
            <CheckItem ok={draft.hashtags.length >= 3 || draft.postType !== 'post'} label="3+ hashtags" />
            <CheckItem ok={draft.industries.length > 0}       label="Industry targeted" />
            <CheckItem ok={!overLimit}                        label="Within character limit" />
            <CheckItem ok={draft.commentsEnabled}             label="Comments enabled" />
            <CheckItem ok={!draft.sponsored || draft.partnerTag.length > 0} label="Sponsorship disclosed" />
          </div>
        </div>
      </div>
    </div>
  )
}
