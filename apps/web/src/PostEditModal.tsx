import { useCallback, useEffect, useRef, useState } from 'react'
import type { CalendarApiConfig } from './calendar/calendarApi.js'
import { updateScheduleEntry, deleteScheduleEntry } from './calendar/calendarApi.js'
import type { DayKey, PlannedPost } from './calendar/calendarTypes.js'

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
const VIDEO_EFFECTS = ['fade_in', 'fade_out', 'grain', 'sharpen', 'glow'] as const
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
  return { filterPreset: 'none', textTitle: '', textCaption: '', textHashtags: '', textEmoji: '', effects: [] }
}

function loadVideoOptions(postId: string, fromDb?: Record<string, unknown> | null): VideoOptions {
  if (fromDb != null) return { ...defaultVideoOptions(), ...(fromDb as Partial<VideoOptions>) }
  try {
    const raw = sessionStorage.getItem(`video-opts:${postId}`)
    return raw ? { ...defaultVideoOptions(), ...(JSON.parse(raw) as Partial<VideoOptions>) } : defaultVideoOptions()
  } catch { return defaultVideoOptions() }
}

function saveVideoOptions(postId: string, opts: VideoOptions) {
  try { sessionStorage.setItem(`video-opts:${postId}`, JSON.stringify(opts)) } catch { /* storage unavailable */ }
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

// ─── Shared input style ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text-h)',
  fontSize: 13, width: '100%', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={labelStyle}>{label}</span>
      {chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {chips.map((chip) => (
            <span
              key={chip}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 999,
                background: 'var(--brand-primary, #7c3aed)',
                color: '#fff', fontSize: 12, fontWeight: 500,
              }}
            >
              {chip}
              <button
                type="button"
                onClick={() => onChange(chips.filter((c) => c !== chip))}
                aria-label={`Remove ${chip}`}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.8)', padding: 0, fontSize: 14, lineHeight: 1,
                }}
              >×</button>
            </span>
          ))}
        </div>
      )}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addChip() }
          else if (e.key === 'Backspace' && !input && chips.length > 0) {
            onChange(chips.slice(0, -1))
          }
        }}
        placeholder={placeholder ?? `Type and press Enter`}
        style={inputStyle}
      />
      <span style={{ fontSize: '0.72rem', color: 'var(--text)' }}>
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
  const [body, setBody]       = useState(post.title)
  const [network, setNetwork] = useState<PlannedPost['network']>(post.network)
  const [videoOpts, setVideoOpts] = useState<VideoOptions>(
    () => loadVideoOptions(post.id, post.videoOptions as Record<string, unknown> | null)
  )
  const [meta, setMeta] = useState<PostMetadata>(
    () => loadMetadata(post.metadata as Record<string, unknown> | null)
  )
  const [showVideoOpts, setShowVideoOpts] = useState(post.network === 'youtube' || post.network === 'tiktok')
  const [saving, setSaving]   = useState(false)
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
        apiConfig,
        post.id,
        body.trim(),
        network ?? null,
        null,
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
  const hasAltText = network === 'instagram' || network === 'facebook' || network === 'linkedin' || network === 'x' || network === 'youtube'

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Edit post"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '24px',
        width: '100%',
        maxWidth: 680,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: 'var(--shadow)',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-h)' }}>Edit post</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text)', lineHeight: 1, padding: 4 }}
          >×</button>
        </div>

        {/* Content body */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-h)' }}>Content</span>
          <textarea
            ref={firstInputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            style={{
              width: '100%', boxSizing: 'border-box',
              fontFamily: 'var(--sans)', fontSize: 14,
              padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--text-h)',
              resize: 'vertical',
            }}
            placeholder="Write your post content here…"
          />
        </label>

        {/* Platform */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-h)' }}>Platform</span>
          <select
            value={network ?? ''}
            onChange={(e) => {
              const n = e.target.value as PlannedPost['network']
              setNetwork(n)
              setShowVideoOpts(n === 'youtube' || n === 'tiktok')
            }}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)', fontSize: 14 }}
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
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Alt text (image accessibility)</span>
            <input
              value={meta.altText}
              onChange={(e) => patchMeta({ altText: e.target.value })}
              placeholder="Describe the image for screen readers…"
              maxLength={1000}
              style={inputStyle}
            />
          </label>
        )}

        {/* ── Instagram extras ── */}
        {network === 'instagram' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Location tag</span>
            <input
              value={meta.location}
              onChange={(e) => patchMeta({ location: e.target.value })}
              placeholder="New York, NY"
              maxLength={200}
              style={inputStyle}
            />
          </label>
        )}

        {/* ── LinkedIn extras ── */}
        {network === 'linkedin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-h)' }}>LinkedIn extras</span>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>Article / link title</span>
              <input
                value={meta.articleTitle}
                onChange={(e) => patchMeta({ articleTitle: e.target.value })}
                placeholder="Your article headline"
                maxLength={300}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>First comment (hashtag strategy)</span>
              <textarea
                value={meta.firstComment}
                onChange={(e) => patchMeta({ firstComment: e.target.value })}
                rows={3}
                maxLength={2200}
                placeholder="#b2b #saas #marketing — posted as first comment to keep the main post clean"
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--sans)' }}
              />
            </label>
          </div>
        )}

        {/* ── YouTube extras ── */}
        {network === 'youtube' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-h)' }}>YouTube extras</span>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>Video description</span>
              <textarea
                value={meta.youtubeDescription}
                onChange={(e) => patchMeta({ youtubeDescription: e.target.value })}
                rows={4}
                maxLength={5000}
                placeholder="Full video description with timestamps, links, etc."
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--sans)' }}
              />
            </label>
            <ChipInput
              label="Video tags (searchable keywords)"
              chips={meta.youtubeTags}
              onChange={(chips) => patchMeta({ youtubeTags: chips })}
              placeholder="ai marketing — press Enter to add"
              maxChips={500}
            />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle}>Category</span>
              <select
                value={meta.youtubeCategory}
                onChange={(e) => patchMeta({ youtubeCategory: e.target.value })}
                style={{ ...inputStyle, cursor: 'pointer' }}
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
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <button
              type="button"
              onClick={() => setShowVideoOpts((v) => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0, fontSize: '0.9rem', fontWeight: 600,
                color: 'var(--brand-primary, #7c3aed)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span>{showVideoOpts ? '▾' : '▸'}</span>
              Video options (filters, overlays, effects)
            </button>

            {showVideoOpts && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={labelStyle}>Color filter</span>
                  <select
                    value={videoOpts.filterPreset}
                    onChange={(e) => patchVideo({ filterPreset: e.target.value })}
                    style={inputStyle}
                  >
                    {VIDEO_FILTER_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={labelStyle}>Title overlay</span>
                    <input value={videoOpts.textTitle} onChange={(e) => patchVideo({ textTitle: e.target.value })}
                      placeholder="Hook text (upper third)" maxLength={80} style={inputStyle} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={labelStyle}>Hashtags overlay</span>
                    <input value={videoOpts.textHashtags} onChange={(e) => patchVideo({ textHashtags: e.target.value })}
                      placeholder="#marketing #ai" maxLength={120} style={inputStyle} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                    <span style={labelStyle}>Caption overlay</span>
                    <input value={videoOpts.textCaption} onChange={(e) => patchVideo({ textCaption: e.target.value })}
                      placeholder="Body text (lower third)" maxLength={200} style={inputStyle} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={labelStyle}>Emoji overlay</span>
                    <input value={videoOpts.textEmoji} onChange={(e) => patchVideo({ textEmoji: e.target.value })}
                      placeholder="🔥✨" maxLength={8} style={inputStyle} />
                  </label>
                </div>

                <div>
                  <span style={{ ...labelStyle, display: 'block', marginBottom: 8 }}>Effects</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {VIDEO_EFFECTS.map((eff) => (
                      <label key={eff} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                        <input type="checkbox" checked={videoOpts.effects.includes(eff)} onChange={() => toggleEffect(eff)} />
                        {eff.replace('_', ' ')}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {statusMsg && (
          <p role="alert" style={{ margin: 0, fontSize: '0.85rem', color: '#ef4444' }}>{statusMsg}</p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
          <button type="button" onClick={handleDelete} disabled={deleting}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #ef4444', background: 'none', color: '#ef4444', cursor: deleting ? 'wait' : 'pointer', fontSize: 14, fontWeight: 500 }}
          >{deleting ? 'Deleting…' : 'Delete'}</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 14 }}
            >Cancel</button>
            <button type="button" onClick={() => void handleSave()} disabled={saving}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--brand-primary, #7c3aed)', color: '#fff', cursor: saving ? 'wait' : 'pointer', fontSize: 14, fontWeight: 600 }}
            >{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>

      </div>
    </div>
  )
}
