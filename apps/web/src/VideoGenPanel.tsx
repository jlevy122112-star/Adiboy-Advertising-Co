import { useState, useRef, useCallback } from 'react'

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
  const [jobId, setJobId] = useState<string | null>(null)
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
    setJobId(null)
    stopPolling()

    try {
      const res = await fetch(`${apiOrigin}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
        body: JSON.stringify({
          brief: makeBrief(title, body),
          network: platform,
          voiceover,
        }),
      })
      const data = await res.json() as { ok: boolean; scriptId?: string; jobId?: string; error?: string }

      if (!data.ok || !data.jobId) {
        setError(data.error ?? 'Generation failed')
        setLoading(false)
        return
      }

      setScriptId(data.scriptId ?? null)
      setJobId(data.jobId)
      setJob({ id: data.jobId, status: 'queued', url: null, thumbnail_url: null, duration_s: null, error: null })
      setLoading(false)
      pollJob(data.jobId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setLoading(false)
    }
  }, [apiOrigin, tenantId, platform, title, body, voiceover, pollJob, stopPolling])

  const statusLabel: Record<JobStatus, string> = {
    queued: 'Queued — waiting for worker…',
    rendering: 'Rendering scenes…',
    uploading: 'Uploading to S3…',
    done: 'Ready',
    failed: 'Failed',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Platform</label>
        <select
          value={platform}
          onChange={e => setPlatform(e.target.value as VideoPlatform)}
          style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13 }}
        >
          {(Object.keys(PLATFORM_LABELS) as VideoPlatform[]).map(p => (
            <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Video title / hook</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. 3 ways to grow on social"
          style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13 }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Brief / context (optional)</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={3}
          placeholder="Extra context for the AI script…"
          style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13, resize: 'vertical' }}
        />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
        <input type="checkbox" checked={voiceover} onChange={e => setVoiceover(e.target.checked)} />
        Include AI voiceover (TTS)
      </label>

      <button
        onClick={handleGenerate}
        disabled={loading || !title.trim()}
        style={{
          padding: '6px 14px', borderRadius: 4, border: 'none',
          background: loading ? '#aaa' : '#2563eb', color: '#fff',
          fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Generating script…' : 'Generate Video'}
      </button>

      {error && (
        <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{error}</p>
      )}

      {job && (
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 12, margin: 0, color: job.status === 'failed' ? '#dc2626' : '#374151' }}>
            <strong>Status:</strong> {statusLabel[job.status]}
            {job.duration_s ? ` · ${job.duration_s}s` : ''}
          </p>

          {scriptId && (
            <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
              Script: {scriptId.slice(0, 8)}… · Job: {job.id.slice(0, 8)}…
            </p>
          )}

          {job.status === 'done' && job.thumbnail_url && (
            <img
              src={job.thumbnail_url}
              alt="Video thumbnail"
              style={{ width: '100%', borderRadius: 4, border: '1px solid #e5e7eb' }}
            />
          )}

          {job.status === 'done' && job.url && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <video
                controls
                src={job.url}
                style={{ width: '100%', borderRadius: 4, background: '#000' }}
              />
              <a
                href={job.url}
                download
                style={{ fontSize: 12, color: '#2563eb', textDecoration: 'underline' }}
              >
                Download MP4
              </a>
            </div>
          )}

          {job.status === 'failed' && job.error && (
            <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{job.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
