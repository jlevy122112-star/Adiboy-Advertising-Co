import { useState, useEffect, useCallback, useRef } from 'react'
import './autonomous.css'
import { apiFetch } from '../hooks/useApi'
import { getAccessToken } from '../auth/useAuth'

const API_ORIGIN = (import.meta.env.VITE_AUTONOMOUS_API_ORIGIN as string | undefined) ?? 'http://localhost:8805'

const ALL_NETWORKS = ['facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'reddit', 'threads']

type Scope = 'single_post' | 'full_campaign'

type RunState =
  | 'requested' | 'validating' | 'planning' | 'generating'
  | 'scheduling' | 'ready_to_publish' | 'publishing'
  | 'awaiting_user' | 'paused'
  | 'completed' | 'failed' | 'cancelled'

interface ScheduledPost {
  network: string
  scheduledAt: string
  headline: string
  slotScore: number
}

interface RunEvent {
  id: string
  type: string
  occurredAt: string
  fromState?: string
  toState?: string
}

interface Run {
  id: string
  workspaceId: string
  state: RunState
  networks: string[]
  scope: Scope
  createdAt: string
  updatedAt: string
  scheduledPosts?: ScheduledPost[]
  progress?: { stage: string; percentComplete: number }
}

interface RunDetail extends Run {
  events: RunEvent[]
}

const ACTIVE_STATES: RunState[] = [
  'requested', 'validating', 'planning', 'generating',
  'scheduling', 'ready_to_publish', 'publishing',
]

function isActive(s: RunState) { return ACTIVE_STATES.includes(s) }

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return `Today ${fmtTime(iso)}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + fmtTime(iso)
}

function stateProgress(state: RunState): number {
  const map: Record<RunState, number> = {
    requested: 5, validating: 12, planning: 25, generating: 45,
    scheduling: 65, ready_to_publish: 80, publishing: 92,
    awaiting_user: 50, paused: 50,
    completed: 100, failed: 100, cancelled: 100,
  }
  return map[state] ?? 0
}

function NetworkTag({ net }: { net: string }) {
  return <span className="au-net-tag">{net.slice(0, 2).toUpperCase()}</span>
}

function StateBadge({ state }: { state: RunState }) {
  const label = state.replace(/_/g, ' ')
  return <span className={`au-state au-state--${state}`}>{label}</span>
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="au-progress-bar">
      <div className="au-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function AutonomousAgentPanel() {
  const [networks, setNetworks] = useState<string[]>(['instagram', 'linkedin'])
  const [scope, setScope] = useState<Scope>('single_post')
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<RunDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const sseRef = useRef<EventSource | null>(null)

  const loadRuns = useCallback(async () => {
    const r = await apiFetch<{ runs: Run[] }>(`${API_ORIGIN}/runs?limit=20`)
    if (r.ok) setRuns(r.data.runs ?? [])
    setLoading(false)
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    const r = await apiFetch<{ run: Run; events: RunEvent[] }>(`${API_ORIGIN}/runs/${id}`)
    if (r.ok) setDetail({ ...r.data.run, events: r.data.events ?? [] })
    setDetailLoading(false)
  }, [])

  useEffect(() => {
    loadRuns()

    const tok = getAccessToken()
    const sseUrl = `${API_ORIGIN}/runs/events${tok ? `?_tok=${encodeURIComponent(tok)}` : ''}`
    let es: EventSource

    function connect() {
      es = new EventSource(sseUrl)
      sseRef.current = es

      es.addEventListener('run_updated', () => {
        void loadRuns()
      })

      es.onerror = () => {
        es.close()
        setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      sseRef.current?.close()
    }
  }, [loadRuns])

  // Re-fetch detail whenever selectedId changes or runs list updates
  const runsRef = useRef(runs)
  runsRef.current = runs

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
    else setDetail(null)
  }, [selectedId])

  function toggleNetwork(net: string) {
    setNetworks(prev =>
      prev.includes(net) ? prev.filter(n => n !== net) : [...prev, net]
    )
  }

  async function launch() {
    if (!networks.length || launching) return
    setLaunching(true)
    setLaunchError(null)
    const r = await apiFetch<{ runId: string }>(`${API_ORIGIN}/runs`, {
      method: 'POST',
      json: { networks, scope },
    })
    if (r.ok) {
      await loadRuns()
      setSelectedId(r.data.runId)
    } else {
      setLaunchError('Launch failed. Check your connections and try again.')
    }
    setLaunching(false)
  }

  async function doAction(id: string, action: 'cancel' | 'pause' | 'resume') {
    await apiFetch(`${API_ORIGIN}/runs/${id}/${action}`, { method: 'POST' })
    await loadRuns()
    await loadDetail(id)
  }

  const hasActive = runs.some(r => isActive(r.state))

  return (
    <div className="au-root">
      <div className="au-header">
        <h2 className="au-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Autonomous Agent
        </h2>
        <button className="au-reload-btn" onClick={loadRuns}>Refresh</button>
      </div>

      {/* Launch form */}
      <div className="au-form">
        <div className="au-form-title">New Run</div>

        <div>
          <div className="au-form-title" style={{ marginBottom: '0.3rem' }}>Platforms</div>
          <div className="au-network-grid">
            {ALL_NETWORKS.map(net => (
              <button
                key={net}
                className={`au-network-btn${networks.includes(net) ? ' au-network-btn--active' : ''}`}
                onClick={() => toggleNetwork(net)}
              >
                {net}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="au-form-title" style={{ marginBottom: '0.3rem' }}>Scope</div>
          <div className="au-scope-row">
            {(['single_post', 'full_campaign'] as Scope[]).map(s => (
              <button
                key={s}
                className={`au-scope-btn${scope === s ? ' au-scope-btn--active' : ''}`}
                onClick={() => setScope(s)}
              >
                {s === 'single_post' ? 'Single Post' : 'Full Campaign'}
              </button>
            ))}
          </div>
        </div>

        <button
          className="au-launch-btn"
          onClick={launch}
          disabled={!networks.length || launching}
        >
          {launching ? 'Launching…' : `Launch${hasActive ? ' Another' : ''} Run`}
        </button>
        {launchError && <p className="au-launch-error">{launchError}</p>}
      </div>

      {/* Run list */}
      <div>
        <div className="au-section-title">Runs</div>
        {loading ? (
          <div className="au-empty">
            <div className="au-empty-text">Loading…</div>
          </div>
        ) : runs.length === 0 ? (
          <div className="au-empty">
            <div className="au-empty-icon">⚡</div>
            <div className="au-empty-text">No runs yet. Launch one above.</div>
          </div>
        ) : (
          <div className="au-run-list">
            {runs.map(run => (
              <div
                key={run.id}
                className={`au-run${selectedId === run.id ? ' au-run--active' : ''}`}
                onClick={() => setSelectedId(selectedId === run.id ? null : run.id)}
              >
                <div className="au-run-header">
                  <StateBadge state={run.state} />
                  <span className="au-run-id">{run.id}</span>
                  <span className="au-run-meta">{fmtDate(run.createdAt)}</span>
                </div>
                <ProgressBar pct={stateProgress(run.state)} />
                <div className="au-run-networks">
                  {run.networks.map(n => <NetworkTag key={n} net={n} />)}
                  <span style={{ fontSize: '0.55rem', opacity: 0.4, marginLeft: '0.2rem', alignSelf: 'center' }}>
                    {run.scope === 'full_campaign' ? 'campaign' : 'single post'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Run detail */}
      {selectedId && (
        <RunDetailPanel
          runId={selectedId}
          detail={detail}
          loading={detailLoading}
          onAction={doAction}
        />
      )}
    </div>
  )
}

function RunDetailPanel({
  runId,
  detail,
  loading,
  onAction,
}: {
  runId: string
  detail: RunDetail | null
  loading: boolean
  onAction: (id: string, action: 'cancel' | 'pause' | 'resume') => void
}) {
  if (loading && !detail) {
    return (
      <div className="au-detail">
        <div className="au-detail-title">Run Detail</div>
        <div className="au-empty-text">Loading…</div>
      </div>
    )
  }
  if (!detail) return null

  const isBlocking = detail.state === 'awaiting_user' || detail.state === 'paused'
  const isTerminal = detail.state === 'completed' || detail.state === 'failed' || detail.state === 'cancelled'
  const canPause = isActive(detail.state)
  const canResume = isBlocking
  const canCancel = !isTerminal

  const posts = detail.scheduledPosts ?? []
  const events = detail.events ?? []

  return (
    <div className="au-detail">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="au-detail-title">Run Detail</div>
        <StateBadge state={detail.state} />
      </div>

      <div className="au-actions">
        {canResume && (
          <button className="au-action-btn" onClick={() => onAction(runId, 'resume')}>
            Resume
          </button>
        )}
        {canPause && (
          <button className="au-action-btn" onClick={() => onAction(runId, 'pause')}>
            Pause
          </button>
        )}
        {canCancel && (
          <button className="au-action-btn au-action-btn--danger" onClick={() => onAction(runId, 'cancel')}>
            Cancel
          </button>
        )}
      </div>

      {posts.length > 0 && (
        <>
          <div className="au-divider" />
          <div className="au-section-title">Scheduled Posts</div>
          <div className="au-posts">
            {posts.map((p, i) => (
              <div key={i} className="au-post">
                <span className="au-post-net">{p.network.slice(0, 2).toUpperCase()}</span>
                <span className="au-post-headline">{p.headline}</span>
                <span className="au-post-score">{Math.round(p.slotScore * 100)}%</span>
                <span className="au-post-time">{fmtDate(p.scheduledAt)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {events.length > 0 && (
        <>
          <div className="au-divider" />
          <div className="au-section-title">Agent Log</div>
          <div className="au-log">
            {[...events].reverse().map(ev => (
              <div key={ev.id} className="au-log-entry">
                <span className="au-log-time">{fmtTime(ev.occurredAt)}</span>
                <span className="au-log-event">{ev.type.replace(/_/g, ' ')}</span>
                {ev.toState && (
                  <span className="au-log-detail">→ {ev.toState.replace(/_/g, ' ')}</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
