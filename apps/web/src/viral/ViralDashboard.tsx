import { useState, useEffect } from 'react'
import { getAccessToken } from '../auth/useAuth'
import './viral.css'

const VIRAL_API = import.meta.env.VITE_VIRAL_API_ORIGIN as string ?? 'http://localhost:8800'

type Metrics = {
  totalShares: number
  totalViews: number
  totalSignups: number
  totalClones: number
  viralCoefficient: number
  topShares: Array<{
    id: string
    share_type: string
    channel: string
    view_count: number
    signup_count: number
    share_token: string
    created_at: string
  }>
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="vd-stat">
      <span className="vd-stat-value">{value}</span>
      <span className="vd-stat-label">{label}</span>
      {sub && <span className="vd-stat-sub">{sub}</span>}
    </div>
  )
}

export function ViralDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    const tok = getAccessToken()
    if (!tok) { setLoading(false); return }

    setLoading(true)
    fetch(`${VIRAL_API}/viral/metrics?days=${days}`, {
      headers: { Authorization: `Bearer ${tok}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setMetrics((data as { metrics: Metrics }).metrics)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  const baseUrl = import.meta.env.VITE_PUBLIC_URL as string ?? window.location.origin

  return (
    <div className="vd-root">
      <div className="vd-header">
        <h2 className="vd-title">Viral Growth</h2>
        <select
          className="vd-window-select"
          value={days}
          onChange={e => setDays(Number(e.target.value))}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading ? (
        <div className="vd-loading">Loading metrics…</div>
      ) : !metrics ? (
        <p className="vd-empty">Connect your database to see viral metrics.</p>
      ) : (
        <>
          <div className="vd-stats">
            <StatCard label="Shares" value={metrics.totalShares} />
            <StatCard label="Views" value={metrics.totalViews} />
            <StatCard label="Signups" value={metrics.totalSignups} />
            <StatCard label="Clones" value={metrics.totalClones} />
            <StatCard
              label="Viral K"
              value={metrics.viralCoefficient.toFixed(2)}
              sub={metrics.viralCoefficient >= 1 ? '🔥 Viral!' : metrics.viralCoefficient >= 0.3 ? 'Growing' : 'Below threshold'}
            />
          </div>

          {metrics.topShares.length > 0 && (
            <div className="vd-top-shares">
              <h3 className="vd-section-title">Top shares</h3>
              <ul className="vd-share-list">
                {metrics.topShares.map(s => (
                  <li key={s.id} className="vd-share-row">
                    <div className="vd-share-meta">
                      <span className="vd-share-type">{s.share_type}</span>
                      <span className="vd-share-channel">{s.channel}</span>
                    </div>
                    <div className="vd-share-counts">
                      <span title="Views">{s.view_count} views</span>
                      <span title="Signups">{s.signup_count} signups</span>
                    </div>
                    <button
                      className="vd-copy-btn"
                      type="button"
                      onClick={() => navigator.clipboard.writeText(`${baseUrl}/s/${s.share_token}`)}
                    >
                      Copy link
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
