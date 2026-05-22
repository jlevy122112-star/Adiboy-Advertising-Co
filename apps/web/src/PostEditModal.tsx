import { useCallback, useEffect, useRef, useState } from 'react'
import type { CalendarApiConfig } from './calendar/calendarApi.js'
import { updateScheduleEntry, deleteScheduleEntry } from './calendar/calendarApi.js'
import type { DayKey, PlannedPost } from './calendar/calendarTypes.js'
import './PostEditModal.css'

// ─── Local types ────────────────────────────────────────────────────────────

type VideoOptions = {
  filterPreset: string
  textTitle: string
  textCaption: string
  textHashtags: string
  textEmoji: string
  effects: string[]
}

type PostMetadata = {
  hashtags: string[]
  mentions: string[]
  altText: string
  location: string
  firstComment: string
  articleTitle: string
  youtubeDescription: string
  youtubeTags: string[]
  youtubeCategory: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const VIDEO_FILTER_PRESETS = ['none', 'warm', 'cool', 'dramatic', 'faded', 'vivid', 'bw'] as const
const VIDEO_EFFECTS        = ['fade_in', 'fade_out', 'grain', 'sharpen', 'glow'] as const
const NETWORKS = [
  'facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok', 'email', 'generic',
] as const

const YOUTUBE_CATEGORIES = [
  { id: '1',  label: 'Film & Animation' },
  { id: '2',  label: 'Autos & Vehicles' },
  { id: '10', label: 'Music' },
  { id: '15', label: 'Pets & Animals' },
  { id: '17', label: 'Sports' },
  { id: '19', label: 'Travel & Events' },
  { id: '20', label: 'Gaming' },
  { id: '22', label: 'People & Blogs' },
  { id: '23', label: 'Comedy' },
  { id: '24', label: 'Entertainment' },
  { id: '25', label: 'News & Politics' },
  { id: '26', label: 'Howto & Style' },
  { id: '27', label: 'Education' },
  { id: '28', label: 'Science & Technology' },
  { id: '29', label: 'Nonprofits & Activism' },
]

// ─── Defaults & loaders ──────────────────────────────────────────────────────

function defaultVideoOptions(): VideoOptions {
  return {
    filterPreset: 'none', textTitle: '', textCaption: '',
    textHashtags: '', textEmoji: '', effects: [],
  }
}

function loadVideoOptions(postId: string, fromDb?: Record<string, unknown> | null): VideoOptions {
  if (fromDb != null) return { ...defaultVideoOptions(), ...(fromDb as Partial<VideoOptions>) }
  try {
    const raw = sessionStorage.getItem(`video-opts:${postId}`)
    return raw
      ? { ...defaultVideoOptions(), ...(JSON.parse(raw) as Partial<VideoOptions>) }
      : defaultVideoOptions()
  } catch { return defaultVideoOptions() }
}

function saveVideoOptions(postId: string, opts: VideoOptions) {
  try {
    sessionStorage.setItem(`video-opts:${postId}`, JSON.stringify(opts))
  } catch { /* storage unavailable */ }
}

function defaultMetadata(): PostMetadata {
  return {
    hashtags: [], mentions: [], altText: '',
    location: '', firstComment: '', articleTitle: '',
    youtubeDescription: '', youtubeTags: [], youtubeCategory: '',
  }
}

function loadMetadata(fromDb?: Record<string, unknown> | null): PostMetadata {
  if (fromDb != null) return { ...defaultMetadata(), ...(fromDb as Partial<PostMetadata>) }
  return defaultMetadata()
}

// ─── ChipInput ────────────────────────────────────────────────────────────────

function ChipInput({
  label, chips, onChange, prefix = '', placeholder, maxChips = 30,
}: {
  label: string
  chips: string[]
  onChange: (next: string[]) => void
  prefix?: string
  placeholder?: string
  maxChips?: number
}) {
  const [input, setInput] = useState('')

  const addChip = useCallback(() => {
    const raw = input.trim().replace(/^[#@]+/, '')
    if (!raw) return
    const chip = prefix ? `${prefix}${raw}` : raw
    if (chips.length < maxChips && !chips.includes(chip)) {
      onChange([...chips, chip])
    }
    setInput('')
  }, [input, chips, onChange, prefix, maxChips])

  return (
    <div className="pem-field">
      <span className="pem-label">{label}</span>

      {chips.length > 0 && (
        <div className="pem-chips">
          {chips.map((chip) => (
            <span key={chip} className="pem-chip">
              {chip}
              <button
                type="button"
                className="pem-chip-remove"
                onClick={() => onChange(chips.filter((c) => c !== chip))}
                aria-label={`Remove ${chip}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        className="pem-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addChip() }
          else if (e.key === 'Backspace' && !input && chips.length > 0) {
            onChange(chips.slice(0, -1))
          }
        }}
        placeholder={placeholder ?? 'Type and press Enter'}
      />

      <span className="pem-chip-hint">
        Press Enter or comma to add · Backspace to remove last · {chips.length}/{maxChips}
      </span>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  post: PlannedPost
  dayKey: DayKey
  onClose: () => void
  onSaved: (id: string, newTitle: string, network: PlannedPost['network']) => void
  onDeleted: (id: string, dayKey: DayKey) => void
  apiConfig: CalendarApiConfig | null
}

// ─── PostEditModal ────────────────────────────────────────────────────────────

export function PostEditModal({ post, dayKey, onClose, onSaved, onDeleted, apiConfig }: Props) {
  const [body, setBody]         = useState(post.title)
  const [network, setNetwork]   = useState<PlannedPost['network']>(post.network)
  const [videoOpts, setVideoOpts] = useState<VideoOptions>(
    () => loadVideoOptions(post.id, post.videoOptions as Record<string, unknown> | null)
  )
  const [meta, setMeta] = useState<PostMetadata>(
    () => loadMetadata(post.metadata as Record<string, unknown> | null)
  )
  const [showVideoOpts, setShowVideoOpts] = useState(
    post.network === 'youtube' || post.network === 'tiktok'
  )
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const backdropRef   = useRef<HTMLDivElement>(null)
  const firstInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    firstInputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const patchVideo = useCallback((patch: Partial<VideoOptions>) => {
    setVideoOpts((v) => {
      const next = { ...v, ...patch }
      saveVideoOptions(post.id, next)
      return next
    })
  }, [post.id])

  const toggleEffect = useCallback((eff: string) => {
    setVideoOpts((v) => {
      const next = v.effects.includes(eff)
        ? { ...v, effects: v.effects.filter((e) => e !== eff) }
        : { ...v, effects: [...v.effects, eff] }
      saveVideoOptions(post.id, next)
      return next
    })
  }, [post.id])

  const patchMeta = useCallback((patch: Partial<PostMetadata>) => {
    setMeta((m) => ({ ...m, ...patch }))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setStatusMsg('')
    if (apiConfig) {
      const ok = await updateScheduleEntry(
        apiConfig, post.id, body.trim(), network ?? null, null,
        videoOpts as Record<string, unknown>,
        meta as Record<string, unknown>,
      )
      if (!ok) {
        setStatusMsg('Save failed — check API connection.')
        setSaving(false)
        return
      }
    }
    onSaved(post.id, body.trim(), network)
    onClose()
  }, [apiConfig, post.id, body, network, videoOpts, meta, onSaved, onClose])

  const handleDelete = useCallback(async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    setDeleting(true)
    if (apiConfig) await deleteScheduleEntry(apiConfig, post.id)
    onDeleted(post.id, dayKey)
    onClose()
  }, [apiConfig, post.id, dayKey, onDeleted, onClose])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose()
  }, [onClose])

  const isVideo    = network === 'youtube' || network === 'tiktok' || network === 'instagram'
  const hasAltText = ['instagram', 'facebook', 'linkedin', 'x', 'youtube'].includes(network ?? '')

  return (
    <div
      ref={backdropRef}
      className="pem-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Edit post"
    >
      <div className="pem-dialog">

        {/* ── Header ── */}
        <div className="pem-header">
          <h2 className="pem-title">Edit post</h2>
          <button
            type="button"
            className="pem-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* ── Content body ── */}
        <label className="pem-field">
          <span className="pem-label">Content</span>
          <textarea
            ref={firstInputRef}
            className="pem-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Write your post content here…"
          />
        </label>

        {/* ── Platform ── */}
        <label className="pem-field">
          <span className="pem-label">Platform</span>
          <select
            className="pem-select"
            value={network ?? ''}
            onChange={(e) => {
              const n = e.target.value as PlannedPost['network']
              setNetwork(n)
              setShowVideoOpts(n === 'youtube' || n === 'tiktok')
            }}
          >
            <option value="">— no platform —</option>
            {NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        {/* ── Hashtags ── */}
        <ChipInput
          label="Hashtags"
          chips={meta.hashtags}
          onChange={(chips) => patchMeta({ hashtags: chips })}
          prefix="#"
          placeholder="#marketing — press Enter to add"
          maxChips={30}
        />

        {/* ── Mentions ── */}
        <ChipInput
          label="Mentions"
          chips={meta.mentions}
          onChange={(chips) => patchMeta({ mentions: chips })}
          prefix="@"
          placeholder="@partner — press Enter to add"
          maxChips={20}
        />

        {/* ── Alt text ── */}
        {hasAltText && (
          <label className="pem-field">
            <span className="pem-label">Alt text (image accessibility)</span>
            <input
              className="pem-input"
              value={meta.altText}
              onChange={(e) => patchMeta({ altText: e.target.value })}
              placeholder="Describe the image for screen readers…"
              maxLength={1000}
            />
          </label>
        )}

        {/* ── Instagram extras ── */}
        {network === 'instagram' && (
          <label className="pem-field">
            <span className="pem-label">Location tag</span>
            <input
              className="pem-input"
              value={meta.location}
              onChange={(e) => patchMeta({ location: e.target.value })}
              placeholder="New York, NY"
              maxLength={200}
            />
          </label>
        )}

        {/* ── LinkedIn extras ── */}
        {network === 'linkedin' && (
          <div className="pem-section">
            <p className="pem-section-title">LinkedIn extras</p>
            <label className="pem-field">
              <span className="pem-label">Article / link title</span>
              <input
                className="pem-input"
                value={meta.articleTitle}
                onChange={(e) => patchMeta({ articleTitle: e.target.value })}
                placeholder="Your article headline"
                maxLength={300}
              />
            </label>
            <label className="pem-field">
              <span className="pem-label">First comment (hashtag strategy)</span>
              <textarea
                className="pem-textarea"
                value={meta.firstComment}
                onChange={(e) => patchMeta({ firstComment: e.target.value })}
                rows={3}
                maxLength={2200}
                placeholder="#b2b #saas #marketing — posted as first comment to keep the main post clean"
              />
            </label>
          </div>
        )}

        {/* ── YouTube extras ── */}
        {network === 'youtube' && (
          <div className="pem-section">
            <p className="pem-section-title">YouTube extras</p>
            <label className="pem-field">
              <span className="pem-label">Video description</span>
              <textarea
                className="pem-textarea"
                value={meta.youtubeDescription}
                onChange={(e) => patchMeta({ youtubeDescription: e.target.value })}
                rows={4}
                maxLength={5000}
                placeholder="Full video description with timestamps, links, etc."
              />
            </label>
            <ChipInput
              label="Video tags (searchable keywords)"
              chips={meta.youtubeTags}
              onChange={(chips) => patchMeta({ youtubeTags: chips })}
              placeholder="ai marketing — press Enter to add"
              maxChips={500}
            />
            <label className="pem-field">
              <span className="pem-label">Category</span>
              <select
                className="pem-select"
                value={meta.youtubeCategory}
                onChange={(e) => patchMeta({ youtubeCategory: e.target.value })}
              >
                <option value="">— select category —</option>
                {YOUTUBE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* ── Video build options ── */}
        {isVideo && (
          <div className="pem-section">
            <button
              type="button"
              className="pem-toggle-btn"
              onClick={() => setShowVideoOpts((v) => !v)}
            >
              <span>{showVideoOpts ? '▾' : '▸'}</span>
              Video options (filters, overlays, effects)
            </button>

            {showVideoOpts && (
              <div className="pem-video-body">
                <label className="pem-field">
                  <span className="pem-label">Color filter</span>
                  <select
                    className="pem-select"
                    value={videoOpts.filterPreset}
                    onChange={(e) => patchVideo({ filterPreset: e.target.value })}
                  >
                    {VIDEO_FILTER_PRESETS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </label>

                <div className="pem-video-grid">
                  <label className="pem-field">
                    <span className="pem-label">Title overlay</span>
                    <input
                      className="pem-input"
                      value={videoOpts.textTitle}
                      onChange={(e) => patchVideo({ textTitle: e.target.value })}
                      placeholder="Hook text (upper third)"
                      maxLength={80}
                    />
                  </label>
                  <label className="pem-field">
                    <span className="pem-label">Hashtags overlay</span>
                    <input
                      className="pem-input"
                      value={videoOpts.textHashtags}
                      onChange={(e) => patchVideo({ textHashtags: e.target.value })}
                      placeholder="#marketing #ai"
                      maxLength={120}
                    />
                  </label>
                  <label className="pem-field pem-field--full">
                    <span className="pem-label">Caption overlay</span>
                    <input
                      className="pem-input"
                      value={videoOpts.textCaption}
                      onChange={(e) => patchVideo({ textCaption: e.target.value })}
                      placeholder="Body text (lower third)"
                      maxLength={200}
                    />
                  </label>
                  <label className="pem-field">
                    <span className="pem-label">Emoji overlay</span>
                    <input
                      className="pem-input"
                      value={videoOpts.textEmoji}
                      onChange={(e) => patchVideo({ textEmoji: e.target.value })}
                      placeholder="🔥✨"
                      maxLength={8}
                    />
                  </label>
                </div>

                <div className="pem-field">
                  <span className="pem-label">Effects</span>
                  <div className="pem-effects-list">
                    {VIDEO_EFFECTS.map((eff) => (
                      <label key={eff} className="pem-effect-label">
                        <input
                          type="checkbox"
                          checked={videoOpts.effects.includes(eff)}
                          onChange={() => toggleEffect(eff)}
                        />
                        {eff.replace('_', ' ')}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Status ── */}
        {statusMsg && (
          <p role="alert" className="pem-status">{statusMsg}</p>
        )}

        {/* ── Actions ── */}
        <div className="pem-actions">
          <button
            type="button"
            className="pem-btn pem-btn--delete"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <div className="pem-actions-right">
            <button
              type="button"
              className="pem-btn pem-btn--cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="pem-btn pem-btn--save"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
