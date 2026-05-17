import { useState, useRef, useCallback } from 'react'
import './video-gen-panel.css'

type VideoPlatform = 'tiktok' | 'reels' | 'shorts' | 'generic_vertical' | 'generic_landscape'

type JobStatus = 'queued' | 'rendering' | 'uploading' | 'done' | 'failed'

type RenderJob = {
  id: string
  status: JobStatus
  url: string | null
  thumbnail_url: string | null
  duration_s: number | null
  error: string | null
}

const PLATFORM_LABELS: Record<VideoPlatform, string> = {
  tiktok: 'TikTok',
  reels: 'Instagram Reels',
  shorts: 'YouTube Shorts',
  generic_vertical: 'Vertical (generic)',
  generic_landscape: 'Landscape (generic)',
}

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: 'Queued — waiting for worker…',
  rendering: 'Rendering scenes…',
  uploading: 'Uploading to S3…',
  done: 'Ready',
  failed: 'Failed',
}

const TERMINAL: JobStatus[] = ['done', 'failed']

function makeBrief(title: string, body: string) {
  return {
    briefId: `manual-${Date.now()}`,
    workspaceId: import.meta.env.VITE_TENANT_ID ?? 'dev-tenant-001',
    formatId: 'video_short',
    status: 'draft',
    source: 'manual_user',
    copy: { headline: title, body },
    fieldSources: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function VideoGenPanel() {
  const apiOrigin = (import.meta.env.VITE_VIDEO_GEN_API_ORIGIN as string | undefined) ?? ''
  const tenantId = (import.meta.env.VITE_TENANT_ID as string | undefined) ?? 'dev-tenant-001'

  const [platform, setPlatform] = useState<VideoPlatform>('shorts')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [voiceover, setVoiceover] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scriptId, setScriptId] = useState<string | null>(null)
  const [job, setJob] = useState<RenderJob | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const pollJob = useCallback((jid: string) => {
    if (!apiOrigin) return
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${apiOrigin}/job/${jid}`, {
          headers: { 'X-Tenant-Id': tenantId },
        })
        if (!res.ok) return
        const data = await res.json() as { job: RenderJob }
        setJob(data.job)
        if (TERMINAL.includes(data.job.status)) stopPolling()
      } catch { /* network hiccup — keep polling */ }
    }, 3000)
  }, [apiOrigin, tenantId, stopPolling])

  const handleGenerate = useCallback(async () => {
    if (!apiOrigin) { setError('VITE_VIDEO_GEN_API_ORIGIN not set'); return }
    if (!title.trim()) { setError('Title is required'); return }

    setError(null)
    setLoading(true)
    setJob(null)
    setScriptId(null)
    stopPolling()

    try {
      const res = await fetch(`${apiOrigin}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
        body: JSON.stringify({ brief: makeBrief(title, body), network: platform, voiceover }),
      })
      const data = await res.json() as { ok: boolean; scriptId?: string; jobId?: string; error?: string }

      if (!data.ok || !data.jobId) {
        setError(data.error ?? 'Generation failed')
        setLoading(false)
        return
      }

      setScriptId(data.scriptId ?? null)
      setJob({ id: data.jobId, status: 'queued', url: null, thumbnail_url: null, duration_s: null, error: null })
      setLoading(false)
      pollJob(data.jobId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setLoading(false)
    }
  }, [apiOrigin, tenantId, platform, title, body, voiceover, pollJob, stopPolling])

  return (
    <div className="vgp-root">
      <div className="vgp-field">
        <label className="vgp-label" htmlFor="vgp-platform">Platform</label>
        <select
          id="vgp-platform"
          className="vgp-select"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as VideoPlatform)}
        >
          {(Object.keys(PLATFORM_LABELS) as VideoPlatform[]).map((p) => (
            <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
          ))}
        </select>
      </div>

      <div className="vgp-field">
        <label className="vgp-label" htmlFor="vgp-title">Video title / hook</label>
        <input
          id="vgp-title"
          className="vgp-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. 3 ways to grow on social"
        />
      </div>

      <div className="vgp-field">
        <label className="vgp-label" htmlFor="vgp-body">Brief / context (optional)</label>
        <textarea
          id="vgp-body"
          className="vgp-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Extra context for the AI script…"
        />
      </div>

      <label className="vgp-checkbox-label">
        <input
          type="checkbox"
          checked={voiceover}
          onChange={(e) => setVoiceover(e.target.checked)}
        />
        Include AI voiceover (TTS)
      </label>

      <button
        className="vgp-generate-btn"
        onClick={() => void handleGenerate()}
        disabled={loading || !title.trim()}
      >
        {loading ? 'Generating script…' : 'Generate Video'}
      </button>

      {error && <p className="vgp-error">{error}</p>}

      {job && (
        <div className="vgp-result">
          <p className={`vgp-status${job.status === 'failed' ? ' vgp-status--failed' : ''}`}>
            <strong>Status:</strong> {STATUS_LABEL[job.status]}
            {job.duration_s ? ` · ${job.duration_s}s` : ''}
          </p>

          {scriptId && (
            <p className="vgp-script-id">
              Script: {scriptId.slice(0, 8)}… · Job: {job.id.slice(0, 8)}…
            </p>
          )}

          {job.status === 'done' && job.thumbnail_url && (
            <img src={job.thumbnail_url} alt="Video thumbnail" className="vgp-thumbnail" />
          )}

          {job.status === 'done' && job.url && (
            <>
              <video controls src={job.url} className="vgp-video" />
              <a href={job.url} download className="vgp-download-link">Download MP4</a>
            </>
          )}

          {job.status === 'failed' && job.error && (
            <p className="vgp-error">{job.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
