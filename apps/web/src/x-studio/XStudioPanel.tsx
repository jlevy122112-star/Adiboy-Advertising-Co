/**
 * X (Twitter) Creative Studio — Ads Partner · Media Studio.
 *
 * Modes: Tweet · Thread (drag-to-reorder) · Poll
 * Features:
 *   - Tweet composer with 280-char real-time counter
 *   - Thread builder: multiple cards, HTML5 DnD reorder, per-card media
 *   - Poll builder: 2–4 options, duration picker (1 d / 3 d / 7 d)
 *   - MediaDropZone per tweet card (up to 4 images or 1 video)
 *   - Hashtag + mention builder
 *   - Audience selector (Everyone / Followers you follow / Verified)
 *   - Reply filter, Quote tweet, Community post options
 *   - Brand logo as avatar in preview thread connector line
 *   - Pixel-accurate X phone mock with sidebar engagement chrome
 *   - 3-day schedule calendar with X peak-time highlights
 *   - Partner Readiness checklist
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useContentBrief } from '../generation/ContentBriefContext'
import { useBrandTheme } from '../BrandThemePanel'
import { MediaDropZone, type MediaItem } from '../platform-studio/MediaDropZone'
import { ScheduleCalendar, type BestTimeSlot } from '../platform-studio/ScheduleCalendar'
import { HashtagBuilder } from '../platform-studio/HashtagBuilder'
import { apiFetch } from '../hooks/useApi'
import './x-studio.css'

// ── Constants ────────────────────────────────────────────────────────────────

const TWEET_MAX   = 280
const CAMPAIGN_API = (import.meta.env.VITE_CAMPAIGN_API_ORIGIN as string | undefined) ?? 'http://localhost:8801'

const X_BEST_TIMES: BestTimeSlot[] = [
  { hour: 8,  score: 'good' },
  { hour: 9,  score: 'peak' },
  { hour: 12, score: 'peak' },
  { hour: 13, score: 'good' },
  { hour: 17, score: 'good' },
  { hour: 20, score: 'peak' },
  { hour: 21, score: 'good' },
]

const TRENDING_TAGS = [
  'breaking','news','trending','viral','marketing','startup',
  'tech','ai','business','growth','entrepreneur','socialmedia',
  'digitalmarketing','contentmarketing','brandstrategy',
]

// ── Types ────────────────────────────────────────────────────────────────────

type ContentType = 'tweet' | 'thread' | 'poll'
type Audience    = 'everyone' | 'followers' | 'verified'
type ReplyFilter = 'everyone' | 'followers' | 'mentioned'
type PollDuration = 1 | 3 | 7

interface TweetCard {
  id: string
  text: string
  media: MediaItem[]
}

interface PollOption { id: string; text: string }

interface XDraft {
  type:         ContentType
  // Tweet / Thread
  cards:        TweetCard[]
  hashtags:     string[]
  // Poll
  pollQuestion: string
  pollOptions:  PollOption[]
  pollDuration: PollDuration
  // Settings
  audience:     Audience
  replyFilter:  ReplyFilter
  sensitive:    boolean
  scheduledAt:  Date | null
}

function mkId() { return Math.random().toString(36).slice(2, 9) }
function mkCard(): TweetCard { return { id: mkId(), text: '', media: [] } }
function mkOption(): PollOption { return { id: mkId(), text: '' } }

const DEFAULT_DRAFT: XDraft = {
  type: 'tweet',
  cards: [mkCard()],
  hashtags: [],
  pollQuestion: '',
  pollOptions: [mkOption(), mkOption()],
  pollDuration: 1,
  audience: 'everyone',
  replyFilter: 'everyone',
  sensitive: false,
  scheduledAt: null,
}

const AUDIENCE_OPTIONS: Array<{ value: Audience; label: string; desc: string }> = [
  { value: 'everyone',  label: 'Everyone',  desc: 'Public · all X users' },
  { value: 'followers', label: 'Followers', desc: 'Only your followers' },
  { value: 'verified',  label: 'Verified',  desc: 'Verified accounts only' },
]

const REPLY_OPTIONS: Array<{ value: ReplyFilter; label: string }> = [
  { value: 'everyone',  label: 'Everyone can reply' },
  { value: 'followers', label: 'Followers you follow' },
  { value: 'mentioned', label: 'Only mentioned' },
]

const POLL_DURATIONS: Array<{ value: PollDuration; label: string }> = [
  { value: 1, label: '1 day' },
  { value: 3, label: '3 days' },
  { value: 7, label: '7 days' },
]

// ── Sub-components ───────────────────────────────────────────────────────────

function CharCount({ text, max }: { text: string; max: number }) {
  const remaining = max - text.length
  const pct = text.length / max
  const color = pct > 0.9 ? 'var(--danger)' : pct > 0.75 ? 'var(--warning)' : 'var(--text-muted)'

  // SVG progress circle (like the real X)
  const r = 8, circ = 2 * Math.PI * r
  const dash = circ * Math.min(pct, 1)

  return (
    <span className="x-char-count" aria-label={`${remaining} characters remaining`}>
      <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r={r} fill="none" stroke="var(--border)" strokeWidth="2" />
        <circle
          cx="10" cy="10" r={r}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 10 10)"
          style={{ transition: 'stroke-dasharray 0.15s' }}
        />
      </svg>
      {remaining <= 20 && (
        <span style={{ color, fontSize: '0.75rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {remaining}
        </span>
      )}
    </span>
  )
}

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <label className="x-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="x-toggle-input" />
      <span className="x-toggle-track"><span className="x-toggle-thumb" /></span>
      <span className="x-toggle-text">
        <span className="x-toggle-label">{label}</span>
        {sub && <span className="x-toggle-sub">{sub}</span>}
      </span>
    </label>
  )
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`x-check-item${ok ? ' x-check-item--ok' : ''}`}>
      <span className="x-check-icon">{ok ? '✓' : '○'}</span>
      <span className="x-check-label">{label}</span>
    </div>
  )
}

// ── Tweet card editor ────────────────────────────────────────────────────────

function TweetCardEditor({
  card, index, total, isThread,
  onChange, onRemove, onDragStart, onDragOver, onDrop, onDragEnd,
  dragging, overIdx,
}: {
  card: TweetCard
  index: number
  total: number
  isThread: boolean
  onChange: (c: TweetCard) => void
  onRemove: () => void
  onDragStart: (e: React.DragEvent, i: number) => void
  onDragOver:  (e: React.DragEvent, i: number) => void
  onDrop:      (e: React.DragEvent, i: number) => void
  onDragEnd:   () => void
  dragging: number | null
  overIdx:  number | null
}) {
  const mediaChange = useCallback((m: MediaItem[]) => onChange({ ...card, media: m }), [card, onChange])
  const over = overIdx === index && dragging !== null && dragging !== index

  return (
    <div
      className={`x-card${dragging === index ? ' x-card--dragging' : ''}${over ? ' x-card--over' : ''}`}
      draggable={isThread && total > 1}
      onDragStart={e => onDragStart(e, index)}
      onDragOver={e => onDragOver(e, index)}
      onDrop={e => onDrop(e, index)}
      onDragEnd={onDragEnd}
    >
      {isThread && total > 1 && (
        <div className="x-card-drag-handle" title="Drag to reorder">⠿</div>
      )}

      {/* Thread line */}
      {isThread && index < total - 1 && <div className="x-thread-line" />}

      <div className="x-card-body">
        <div className="x-card-top">
          <textarea
            className={`x-tweet-input${card.text.length > TWEET_MAX ? ' x-tweet-input--over' : ''}`}
            placeholder={
              index === 0
                ? isThread ? 'Start your thread…' : 'What\'s happening?'
                : `Tweet ${index + 1}…`
            }
            value={card.text}
            onChange={e => onChange({ ...card, text: e.target.value })}
            rows={3}
          />
          <CharCount text={card.text} max={TWEET_MAX} />
        </div>

        <MediaDropZone
          items={card.media}
          onChange={mediaChange}
          maxItems={4}
          accept="image/*,video/*"
          aspectHint="16:9 landscape or 1:1 square"
        />

        {isThread && total > 1 && (
          <div className="x-card-actions">
            <button className="x-card-remove" onClick={onRemove} title="Remove this tweet">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Phone preview ────────────────────────────────────────────────────────────

function PhonePreview({ draft, avatarUrl, handle }: {
  draft: XDraft; avatarUrl: string | null; handle: string
}) {
  const displayHandle = handle.trim() || 'your_brand'
  const mainCard = draft.cards[0]

  const Avatar = ({ size = 32 }: { size?: number }) => (
    <div className="x-av" style={{ width: size, height: size, flexShrink: 0 }}>
      {avatarUrl
        ? <img src={avatarUrl} alt={handle} className="x-av-img" />
        : <div className="x-av-placeholder" style={{ fontSize: size * 0.35 }}>{displayHandle.slice(0,1).toUpperCase()}</div>
      }
    </div>
  )

  return (
    <div className="x-phone">
      {/* Notch */}
      <div className="x-phone-notch" />

      {/* Status */}
      <div className="x-status">
        <span className="x-status-time">9:41</span>
        <div className="x-status-icons">
          <svg width="11" height="10" viewBox="0 0 20 18" fill="currentColor"><path d="M1 1a16 16 0 0 1 18 0M4.5 5.5a11 11 0 0 1 11 0M8 10a6 6 0 0 1 4 0M10 14.5h.01"/></svg>
          <svg width="14" height="10" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x=".7" y=".7" width="16.6" height="14.6" rx="2"/><rect x="18" y="5.5" width="3" height="5" rx="1.5" fill="currentColor" stroke="none"/><rect x="2" y="2.5" width="13" height="11" rx="1.2" fill="currentColor" stroke="none"/></svg>
        </div>
      </div>

      {/* X app bar */}
      <div className="x-app-bar">
        <button className="x-app-back">←</button>
        <span className="x-app-bar-title">
          {draft.type === 'thread' ? 'Thread' : 'Post'}
        </span>
        <button className="x-app-follow">Follow</button>
      </div>

      {/* Content area */}
      <div className="x-preview-scroll">

        {/* Main tweet */}
        <div className="x-tweet-preview">
          <div className="x-tweet-left">
            <Avatar size={32} />
            {/* Thread connector */}
            {draft.type === 'thread' && draft.cards.length > 1 && (
              <div className="x-preview-thread-line" />
            )}
          </div>
          <div className="x-tweet-right">
            <div className="x-tweet-meta">
              <span className="x-tweet-name">{displayHandle}</span>
              <span className="x-tweet-at">@{displayHandle.toLowerCase().replace(/\s+/g, '_')}</span>
              <span className="x-tweet-dot">·</span>
              <span className="x-tweet-time">now</span>
            </div>

            {draft.type === 'poll' ? (
              <div className="x-poll-preview">
                <p className="x-poll-question">
                  {draft.pollQuestion || 'Your poll question…'}
                </p>
                <div className="x-poll-options">
                  {draft.pollOptions.map((opt, i) => (
                    <div key={opt.id} className="x-poll-option">
                      <div className="x-poll-bar" style={{ width: `${[60, 25, 10, 5][i] ?? 5}%` }} />
                      <span className="x-poll-opt-text">{opt.text || `Option ${i + 1}`}</span>
                      <span className="x-poll-pct">{[60, 25, 10, 5][i] ?? 5}%</span>
                    </div>
                  ))}
                </div>
                <div className="x-poll-meta">
                  <span>{draft.pollDuration} {draft.pollDuration === 1 ? 'day' : 'days'} left</span>
                  <span>· 0 votes</span>
                </div>
              </div>
            ) : (
              <>
                <p className="x-tweet-text">
                  {mainCard?.text
                    ? (mainCard.text.length > 200 ? mainCard.text.slice(0, 200) + '…' : mainCard.text)
                    : <span className="x-tweet-placeholder">What's happening?</span>
                  }
                </p>
                {!draft.hashtags.length && draft.type !== 'thread' && null}

                {/* Media grid */}
                {mainCard?.media && mainCard.media.length > 0 && (
                  <div className={`x-media-grid x-media-grid--${Math.min(mainCard.media.length, 4)}`}>
                    {mainCard.media.slice(0, 4).map(m => (
                      <div key={m.id} className="x-media-cell">
                        {m.type === 'video'
                          ? <video src={m.url} className="x-media-img" muted />
                          : <img src={m.url} alt={m.altText || m.name} className="x-media-img" />
                        }
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Engagement bar */}
            <div className="x-engage-bar">
              <button className="x-engage-btn" aria-label="Reply">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </button>
              <button className="x-engage-btn" aria-label="Repost">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 1 21 5l-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 23-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              </button>
              <button className="x-engage-btn" aria-label="Like">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
              <button className="x-engage-btn" aria-label="Bookmark">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              </button>
              <button className="x-engage-btn" aria-label="Share">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Thread continuation cards (preview) */}
        {draft.type === 'thread' && draft.cards.slice(1, 3).map((card, idx) => (
          <div key={card.id} className="x-tweet-preview x-tweet-preview--cont">
            <div className="x-tweet-left">
              <Avatar size={28} />
              {idx === 0 && draft.cards.length > 2 && <div className="x-preview-thread-line" />}
            </div>
            <div className="x-tweet-right">
              <div className="x-tweet-meta">
                <span className="x-tweet-name">{displayHandle}</span>
                <span className="x-tweet-at">@{displayHandle.toLowerCase().replace(/\s+/g, '_')}</span>
              </div>
              <p className="x-tweet-text x-tweet-text--small">
                {card.text || <span className="x-tweet-placeholder">Continue thread…</span>}
              </p>
              {card.media.length > 0 && (
                <div className={`x-media-grid x-media-grid--${Math.min(card.media.length, 4)}`}>
                  {card.media.slice(0, 4).map(m => (
                    <div key={m.id} className="x-media-cell">
                      {m.type === 'video'
                        ? <video src={m.url} className="x-media-img" muted />
                        : <img src={m.url} alt={m.altText} className="x-media-img" />
                      }
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {draft.type === 'thread' && draft.cards.length > 3 && (
          <div className="x-thread-more">+{draft.cards.length - 3} more tweets in thread</div>
        )}
      </div>

      {/* Home indicator */}
      <div className="x-phone-home" />
    </div>
  )
}

// ── Main panel ───────────────────────────────────────────────────────────────

export function XStudioPanel() {
  const { theme } = useBrandTheme()
  const [draft, setDraft] = useState<XDraft>(DEFAULT_DRAFT)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Thread DnD
  const dragIdx = useRef<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)

  function setType(t: ContentType) {
    setDraft(d => ({ ...d, type: t, cards: [mkCard()], pollOptions: [mkOption(), mkOption()] }))
  }

  function patchCard(i: number, card: TweetCard) {
    setDraft(d => {
      const cards = [...d.cards]
      cards[i] = card
      return { ...d, cards }
    })
  }

  function addTweet() {
    if (draft.cards.length >= 25) return
    setDraft(d => ({ ...d, cards: [...d.cards, mkCard()] }))
  }

  function removeCard(i: number) {
    setDraft(d => ({ ...d, cards: d.cards.filter((_, idx) => idx !== i) }))
  }

  // DnD reorder for thread
  function onCardDragStart(_e: React.DragEvent, i: number) {
    dragIdx.current = i
    setDraggingIdx(i)
  }

  function onCardDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    e.stopPropagation()
    if (i !== overIdx) setOverIdx(i)
  }

  function onCardDrop(e: React.DragEvent, targetIdx: number) {
    e.stopPropagation()
    const from = dragIdx.current
    if (from === null || from === targetIdx) { dragIdx.current = null; setDraggingIdx(null); setOverIdx(null); return }
    setDraft(d => {
      const cards = [...d.cards]
      const [moved] = cards.splice(from, 1)
      cards.splice(targetIdx, 0, moved)
      return { ...d, cards }
    })
    dragIdx.current = null
    setDraggingIdx(null)
    setOverIdx(null)
  }

  function onCardDragEnd() { dragIdx.current = null; setDraggingIdx(null); setOverIdx(null) }

  function patchPollOption(i: number, text: string) {
    setDraft(d => {
      const opts = [...d.pollOptions]
      opts[i] = { ...opts[i], text }
      return { ...d, pollOptions: opts }
    })
  }

  function addPollOption() {
    if (draft.pollOptions.length >= 4) return
    setDraft(d => ({ ...d, pollOptions: [...d.pollOptions, mkOption()] }))
  }

  function removePollOption(i: number) {
    if (draft.pollOptions.length <= 2) return
    setDraft(d => ({ ...d, pollOptions: d.pollOptions.filter((_, idx) => idx !== i) }))
  }

  const { briefId, adaptation, isSelected } = useContentBrief('x')
  useEffect(() => {
    if (!briefId || !adaptation || !isSelected) return
    const body = [adaptation.copy.headline, adaptation.copy.body].filter(Boolean).join(' ')
    setDraft(d => ({
      ...d,
      cards: [{ ...d.cards[0], text: body.slice(0, TWEET_MAX) }],
      hashtags: adaptation.copy.hashtags ?? d.hashtags,
    }))
  }, [briefId, adaptation, isSelected])

  const onTagsChange = useCallback((t: string[]) => setDraft(d => ({ ...d, hashtags: t })), [])
  const onSchedule   = useCallback((dt: Date)    => setDraft(d => ({ ...d, scheduledAt: dt })), [])

  async function generateTweet() {
    if (generating) return
    setGenerating(true)
    try {
      const res = await apiFetch<{ text: string; hashtags?: string[] }>(
        `${CAMPAIGN_API}/ai/tweet`,
        {
          method: 'POST',
          json: {
            type: draft.type,
            existingText: draft.cards[0]?.text,
            hashtags: draft.hashtags,
            brandName: theme.displayName,
          },
        }
      )
      if (res.data?.text) patchCard(0, { ...draft.cards[0], text: res.data.text })
      if (res.data?.hashtags?.length) {
        const merged = [...new Set([...draft.hashtags, ...res.data.hashtags])].slice(0, 10)
        setDraft(d => ({ ...d, hashtags: merged }))
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
      const res = await apiFetch<{ ok: boolean; tweetId?: string; detail?: string }>(
        `${CAMPAIGN_API}/x/publish`,
        {
          method: 'POST',
          json: {
            type: draft.type,
            cards: draft.cards.map(c => ({ text: c.text, mediaIds: c.media.map(m => m.id) })),
            hashtags: draft.hashtags,
            pollQuestion: draft.pollQuestion,
            pollOptions: draft.pollOptions.map(o => o.text),
            pollDurationDays: draft.pollDuration,
            audience: draft.audience,
            replyFilter: draft.replyFilter,
            sensitive: draft.sensitive,
          }),
        }
      )
      if (res.data?.ok) {
        setResult({ ok: true, message: `Published! Tweet ID: ${res.data.tweetId ?? '—'}` })
        setDraft(DEFAULT_DRAFT)
      } else {
        setResult({ ok: false, message: res.data?.detail ?? 'Publish failed — check your X connection.' })
      }
    } finally {
      setPublishing(false)
    }
  }

  const firstCard     = draft.cards[0]
  const hasContent    = draft.type === 'poll'
    ? draft.pollQuestion.trim().length > 0 && draft.pollOptions.every(o => o.text.trim().length > 0)
    : firstCard?.text.trim().length > 0
  const anyOver       = draft.cards.some(c => c.text.length > TWEET_MAX)
  const canPublish    = hasContent && !anyOver
  const canSchedule   = canPublish && draft.scheduledAt !== null
  const displayHandle = theme.displayName.trim() || 'your_brand'

  return (
    <div className="x-root">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="x-header">
        <div className="x-header-left">
          <div className="x-logo">
            {/* X (Twitter) logo */}
            <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </div>
          <div>
            <div className="x-title">X Creative Studio</div>
            <div className="x-subtitle">Ads Partner · Media Studio</div>
          </div>
        </div>
        <div className="x-partner-badges">
          <span className="x-badge x-badge--ads">Ads</span>
          <span className="x-badge x-badge--media">Media Studio</span>
        </div>
      </div>

      <div className="x-layout">

        {/* ── Left: editor ──────────────────────────────────────────────────── */}
        <div className="x-editor">

          {/* Content type */}
          <section className="x-section">
            <div className="x-section-title">Content Type</div>
            <div className="x-type-row">
              {(['tweet', 'thread', 'poll'] as ContentType[]).map(t => (
                <button
                  key={t}
                  className={`x-type-btn${draft.type === t ? ' x-type-btn--active' : ''}`}
                  onClick={() => setType(t)}
                >
                  {t === 'tweet'  && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
                  {t === 'thread' && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
                  {t === 'poll'   && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </section>

          {/* ── TWEET / THREAD composer ─────────────────────────────────── */}
          {draft.type !== 'poll' && (
            <>
              <section className="x-section">
                <div className="x-section-header">
                  <div className="x-section-title">
                    {draft.type === 'thread'
                      ? `Thread (${draft.cards.length} tweet${draft.cards.length > 1 ? 's' : ''}) — drag to reorder`
                      : 'Compose'}
                  </div>
                  <div className="x-section-actions">
                    <button className="x-ai-btn" onClick={generateTweet} disabled={generating}>
                      {generating
                        ? <><span className="x-spinner" /> Writing…</>
                        : <>⚡ AI Draft</>
                      }
                    </button>
                  </div>
                </div>

                <div className="x-cards">
                  {draft.cards.map((card, i) => (
                    <TweetCardEditor
                      key={card.id}
                      card={card}
                      index={i}
                      total={draft.cards.length}
                      isThread={draft.type === 'thread'}
                      onChange={c => patchCard(i, c)}
                      onRemove={() => removeCard(i)}
                      onDragStart={onCardDragStart}
                      onDragOver={onCardDragOver}
                      onDrop={onCardDrop}
                      onDragEnd={onCardDragEnd}
                      dragging={draggingIdx}
                      overIdx={overIdx}
                    />
                  ))}
                </div>

                {draft.type === 'thread' && draft.cards.length < 25 && (
                  <button className="x-add-tweet-btn" onClick={addTweet}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    Add tweet to thread
                  </button>
                )}
              </section>

              {/* Hashtags */}
              <section className="x-section">
                <div className="x-section-title">Hashtags &amp; Topics</div>
                <HashtagBuilder
                  tags={draft.hashtags}
                  onChange={onTagsChange}
                  maxTags={10}
                  suggestions={TRENDING_TAGS}
                  platform="X"
                />
                <div className="x-field-hint">X recommends ≤ 2 hashtags for best reach</div>
              </section>
            </>
          )}

          {/* ── POLL builder ──────────────────────────────────────────── */}
          {draft.type === 'poll' && (
            <>
              <section className="x-section">
                <div className="x-section-title">Poll Question</div>
                <div className="x-input-wrapper">
                  <textarea
                    className={`x-tweet-input${draft.pollQuestion.length > TWEET_MAX ? ' x-tweet-input--over' : ''}`}
                    placeholder="Ask your question…"
                    value={draft.pollQuestion}
                    onChange={e => setDraft(d => ({ ...d, pollQuestion: e.target.value }))}
                    rows={2}
                  />
                  <CharCount text={draft.pollQuestion} max={TWEET_MAX} />
                </div>
              </section>

              <section className="x-section">
                <div className="x-section-header">
                  <div className="x-section-title">Options ({draft.pollOptions.length}/4)</div>
                  {draft.pollOptions.length < 4 && (
                    <button className="x-link-btn" onClick={addPollOption}>+ Add option</button>
                  )}
                </div>
                <div className="x-poll-inputs">
                  {draft.pollOptions.map((opt, i) => (
                    <div key={opt.id} className="x-poll-input-row">
                      <div className="x-poll-input-num">{i + 1}</div>
                      <input
                        className="x-input"
                        placeholder={`Choice ${i + 1}…`}
                        value={opt.text}
                        onChange={e => patchPollOption(i, e.target.value)}
                        maxLength={25}
                      />
                      <span className="x-poll-char-hint">{opt.text.length}/25</span>
                      {draft.pollOptions.length > 2 && (
                        <button className="x-poll-remove" onClick={() => removePollOption(i)} aria-label="Remove option">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="x-section">
                <div className="x-section-title">Duration</div>
                <div className="x-chips">
                  {POLL_DURATIONS.map(d => (
                    <button
                      key={d.value}
                      className={`x-chip${draft.pollDuration === d.value ? ' x-chip--active' : ''}`}
                      onClick={() => setDraft(dr => ({ ...dr, pollDuration: d.value }))}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Audience */}
          <section className="x-section">
            <div className="x-section-title">Audience</div>
            <div className="x-audience-grid">
              {AUDIENCE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`x-audience-btn${draft.audience === opt.value ? ' x-audience-btn--active' : ''}`}
                  onClick={() => setDraft(d => ({ ...d, audience: opt.value }))}
                >
                  <div className="x-audience-label">{opt.label}</div>
                  <div className="x-audience-desc">{opt.desc}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Reply filter */}
          <section className="x-section">
            <div className="x-section-title">Who can reply</div>
            <div className="x-chips">
              {REPLY_OPTIONS.map(r => (
                <button
                  key={r.value}
                  className={`x-chip${draft.replyFilter === r.value ? ' x-chip--active' : ''}`}
                  onClick={() => setDraft(d => ({ ...d, replyFilter: r.value }))}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </section>

          {/* Settings toggles */}
          <section className="x-section">
            <div className="x-section-title">Content Settings</div>
            <div className="x-toggles">
              <Toggle
                checked={draft.sensitive}
                onChange={v => setDraft(d => ({ ...d, sensitive: v }))}
                label="Sensitive / Mature content"
                sub="Adds content warning — required for adult content"
              />
            </div>
          </section>

          {/* Schedule */}
          <section className="x-section">
            <div className="x-section-title">Schedule</div>
            <ScheduleCalendar
              value={draft.scheduledAt}
              onChange={onSchedule}
              bestTimes={X_BEST_TIMES}
              platform="X"
            />
          </section>

          {/* Publish bar */}
          <div className="x-publish-row">
            <button
              className="x-publish-btn x-publish-btn--outline"
              disabled={!canPublish || publishing}
            >
              Save Draft
            </button>
            <button
              className="x-publish-btn x-publish-btn--fill"
              onClick={publishNow}
              disabled={!canPublish || publishing}
            >
              {publishing
                ? <><span className="x-spinner" /> Publishing…</>
                : <>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ flexShrink: 0 }}>
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    Post to X
                  </>
              }
            </button>
            {canSchedule && (
              <button className="x-publish-btn x-publish-btn--schedule" disabled={publishing}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Schedule
              </button>
            )}
          </div>

          {result && (
            <div className={`x-result${result.ok ? ' x-result--ok' : ' x-result--err'}`}>
              {result.message}
            </div>
          )}
        </div>

        {/* ── Right: preview ─────────────────────────────────────────────────── */}
        <div className="x-preview-col">
          <div className="x-preview-label">Live Preview</div>
          <PhonePreview
            draft={draft}
            avatarUrl={theme.logoUrl ?? null}
            handle={displayHandle}
          />

          {/* Partner Readiness */}
          <div className="x-checklist">
            <div className="x-checklist-title">Partner Readiness</div>
            {draft.type === 'poll' ? (
              <>
                <CheckItem ok={draft.pollQuestion.trim().length > 0}                    label="Poll question written" />
                <CheckItem ok={draft.pollOptions.every(o => o.text.trim().length > 0)}  label="All options filled" />
                <CheckItem ok={draft.pollOptions.length >= 2}                            label="2+ options" />
              </>
            ) : (
              <>
                <CheckItem ok={firstCard?.text.trim().length > 0}                        label="Tweet text written" />
                <CheckItem ok={!anyOver}                                                 label="All tweets ≤ 280 chars" />
                <CheckItem ok={draft.type === 'thread' ? draft.cards.length >= 2 : true} label={draft.type === 'thread' ? '2+ tweets in thread' : 'Single tweet'} />
                <CheckItem ok={draft.cards.some(c => c.media.length > 0)}                label="Media attached" />
              </>
            )}
            <CheckItem ok={draft.audience === 'everyone'}   label="Public audience" />
            <CheckItem ok={draft.scheduledAt !== null}       label="Time scheduled" />
            <CheckItem ok={!draft.sensitive}                 label="No sensitive content flag" />
          </div>
        </div>
      </div>
    </div>
  )
}
