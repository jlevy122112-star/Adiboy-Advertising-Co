import { useCallback, useEffect, useRef, useState } from 'react'
import type { CalendarApiConfig } from './calendar/calendarApi.js'
import { updateScheduleEntry, deleteScheduleEntry } from './calendar/calendarApi.js'
import type { DayKey, PlannedPost } from './calendar/calendarTypes.js'

type VideoOptions = {
  filterPreset: string
  textTitle: string
  textCaption: string
  textHashtags: string
  textEmoji: string
  effects: string[]
}

const VIDEO_FILTER_PRESETS = ['none', 'warm', 'cool', 'dramatic', 'faded', 'vivid', 'bw'] as const
const VIDEO_EFFECTS = ['fade_in', 'fade_out', 'grain', 'sharpen', 'glow'] as const
const NETWORKS = [
  'facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok', 'email', 'generic',
] as const

type Props = {
  post: PlannedPost
  dayKey: DayKey
  onClose: () => void
  onSaved: (id: string, newTitle: string, network: PlannedPost['network']) => void
  onDeleted: (id: string, dayKey: DayKey) => void
  apiConfig: CalendarApiConfig | null
}

function defaultVideoOptions(): VideoOptions {
  return {
    filterPreset: 'none',
    textTitle: '',
    textCaption: '',
    textHashtags: '',
    textEmoji: '',
    effects: [],
  }
}

function loadVideoOptions(postId: string): VideoOptions {
  try {
    const raw = sessionStorage.getItem(`video-opts:${postId}`)
    return raw ? { ...defaultVideoOptions(), ...(JSON.parse(raw) as Partial<VideoOptions>) } : defaultVideoOptions()
  } catch {
    return defaultVideoOptions()
  }
}

function saveVideoOptions(postId: string, opts: VideoOptions) {
  try {
    sessionStorage.setItem(`video-opts:${postId}`, JSON.stringify(opts))
  } catch {}
}

export function PostEditModal({ post, dayKey, onClose, onSaved, onDeleted, apiConfig }: Props) {
  const [body, setBody] = useState(post.title)
  const [network, setNetwork] = useState<PlannedPost['network']>(post.network)
  const [videoOpts, setVideoOpts] = useState<VideoOptions>(() => loadVideoOptions(post.id))
  const [showVideoOpts, setShowVideoOpts] = useState(post.network === 'youtube' || post.network === 'tiktok')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [status, setStatus] = useState('')
  const backdropRef = useRef<HTMLDivElement>(null)
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

  const handleSave = useCallback(async () => {
    setSaving(true)
    setStatus('')
    if (apiConfig) {
      const ok = await updateScheduleEntry(apiConfig, post.id, body.trim(), network ?? null, null)
      if (!ok) {
        setStatus('Save failed — check API connection.')
        setSaving(false)
        return
      }
    }
    onSaved(post.id, body.trim(), network)
    onClose()
  }, [apiConfig, post.id, body, network, onSaved, onClose])

  const handleDelete = useCallback(async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    setDeleting(true)
    if (apiConfig) {
      await deleteScheduleEntry(apiConfig, post.id)
    }
    onDeleted(post.id, dayKey)
    onClose()
  }, [apiConfig, post.id, dayKey, onDeleted, onClose])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose()
  }, [onClose])

  const isVideo = network === 'youtube' || network === 'tiktok' || network === 'instagram'

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
        maxWidth: 640,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: 'var(--shadow)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-h)' }}>Edit post</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, color: 'var(--text)', lineHeight: 1, padding: 4,
            }}
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

        {/* Network selector */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-h)' }}>Platform</span>
            <select
              value={network ?? ''}
              onChange={(e) => {
                const n = e.target.value as PlannedPost['network']
                setNetwork(n)
                setShowVideoOpts(n === 'youtube' || n === 'tiktok')
              }}
              style={{
                padding: '8px 10px', borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text-h)',
                fontSize: 14,
              }}
            >
              <option value="">— no platform —</option>
              {NETWORKS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Platform-specific: video options */}
        {isVideo && (
          <div style={{
            border: '1px solid var(--border)', borderRadius: 10, padding: 16,
          }}>
            <button
              type="button"
              onClick={() => setShowVideoOpts((v) => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0, fontSize: '0.9rem', fontWeight: 600,
                color: 'var(--brand-primary, var(--mc-accent, #7c3aed))',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span>{showVideoOpts ? '▾' : '▸'}</span>
              Video options (filters, overlays, effects)
            </button>

            {showVideoOpts && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Filter preset */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)' }}>Color filter</span>
                  <select
                    value={videoOpts.filterPreset}
                    onChange={(e) => patchVideo({ filterPreset: e.target.value })}
                    style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)', fontSize: 13 }}
                  >
                    {VIDEO_FILTER_PRESETS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </label>

                {/* Text overlays */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)' }}>Title overlay</span>
                    <input
                      value={videoOpts.textTitle}
                      onChange={(e) => patchVideo({ textTitle: e.target.value })}
                      placeholder="Hook text (upper third)"
                      maxLength={80}
                      style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)', fontSize: 13 }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)' }}>Hashtags overlay</span>
                    <input
                      value={videoOpts.textHashtags}
                      onChange={(e) => patchVideo({ textHashtags: e.target.value })}
                      placeholder="#marketing #ai"
                      maxLength={120}
                      style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)', fontSize: 13 }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)' }}>Caption overlay</span>
                    <input
                      value={videoOpts.textCaption}
                      onChange={(e) => patchVideo({ textCaption: e.target.value })}
                      placeholder="Body text (lower third)"
                      maxLength={200}
                      style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)', fontSize: 13 }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)' }}>Emoji overlay</span>
                    <input
                      value={videoOpts.textEmoji}
                      onChange={(e) => patchVideo({ textEmoji: e.target.value })}
                      placeholder="🔥✨"
                      maxLength={8}
                      style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)', fontSize: 13 }}
                    />
                  </label>
                </div>

                {/* Effects */}
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)', display: 'block', marginBottom: 8 }}>Effects</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {VIDEO_EFFECTS.map((eff) => (
                      <label key={eff} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
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

        {/* Instagram: image URL */}
        {network === 'instagram' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-h)' }}>Image URL (Instagram requires a photo)</span>
            <input
              type="url"
              placeholder="https://…"
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)', fontSize: 14 }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>Set this in your social credentials metadata for publishing.</span>
          </label>
        )}

        {status && (
          <p role="alert" style={{ margin: 0, fontSize: '0.85rem', color: '#ef4444' }}>{status}</p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #ef4444',
              background: 'none', color: '#ef4444', cursor: deleting ? 'wait' : 'pointer',
              fontSize: 14, fontWeight: 500,
            }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px', borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'none', color: 'var(--text)',
                cursor: 'pointer', fontSize: 14,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              style={{
                padding: '8px 20px', borderRadius: 8,
                border: 'none',
                background: 'var(--brand-primary, var(--mc-accent, #7c3aed))',
                color: '#fff', cursor: saving ? 'wait' : 'pointer',
                fontSize: 14, fontWeight: 600,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
