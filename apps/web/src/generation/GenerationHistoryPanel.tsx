import { useState, useEffect, useCallback } from 'react'
import './generation-history.css'

type HistoryItem = {
  id: string
  type: 'image' | 'video'
  platform: string
  title: string
  thumbnailUrl: string | null
  url: string | null
  status: string
  createdAt: string
  reuseHint: Record<string, unknown>
}

type Props = {
  apiOrigin: string
  tenantId: string
  onReuse?: (item: HistoryItem) => void
}

const PLATFORM_EMOJI: Record<string, string> = {
  tiktok: '🎵', instagram: '📸', facebook: '👥', youtube: '▶️',
  linkedin: '💼', twitter: '🐦', x: '🐦', pinterest: '📌',
  generic: '🌐',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function GenerationHistoryPanel({ apiOrigin, tenantId, onReuse }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '30' })
      if (filter !== 'all') params.set('type', filter)
      const r = await fetch(`${apiOrigin}/history?${params}`, {
        headers: { 'X-Tenant-Id': tenantId },
      })
      if (r.ok) {
        const data = await r.json() as { history: HistoryItem[] }
        setItems(data.history)
      }
    } catch { /* non-critical */ } finally {
      setLoading(false)
    }
  }, [apiOrigin, tenantId, filter])

  useEffect(() => { void load() }, [load])

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter)

  return (
    <div className="gh-root">
      <div className="gh-header">
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-h)' }}>
          Past Generations
        </span>
        <div className="gh-filter">
          {(['all', 'image', 'video'] as const).map(f => (
            <button
              key={f}
              className={`gh-filter-btn${filter === f ? ' gh-filter-btn--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'image' ? 'Images' : 'Videos'}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="gh-loading">Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div className="gh-empty">No past generations yet.</div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="gh-list">
          {filtered.map(item => (
            <div key={item.id} className="gh-item">
              {item.thumbnailUrl ? (
                <img className="gh-thumb" src={item.thumbnailUrl} alt={item.title} />
              ) : (
                <div className="gh-thumb-placeholder">
                  {PLATFORM_EMOJI[item.platform] ?? '🌐'}
                </div>
              )}
              <div className="gh-meta">
                <div className="gh-title" title={item.title}>{item.title}</div>
                <div className="gh-sub">
                  {item.platform} · {relativeTime(item.createdAt)}
                </div>
                <span className={`gh-badge gh-badge--${item.type}`}>
                  {item.type}
                </span>
              </div>
              {onReuse && (
                <button
                  className="gh-reuse-btn"
                  onClick={() => onReuse(item)}
                  title="Re-use settings"
                >
                  Re-use
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
