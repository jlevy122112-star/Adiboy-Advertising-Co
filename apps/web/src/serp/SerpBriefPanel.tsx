import { useState, useEffect, useCallback, useRef } from 'react'
import type { SerpBrief } from '@home-link/marketer-pro-contract'
import './serp-brief.css'
import { apiFetch } from '../hooks/useApi'

type Props = {
  apiOrigin: string
  tenantId: string
  industryVertical?: string
  /** Called when user clicks "Use this brief" — seeds a generation form */
  onUseBrief?: (brief: SerpBrief) => void
}

const STATUS_LABEL: Record<SerpBrief['status'], string> = {
  pending: 'Queued…',
  fetching: 'Fetching search results…',
  analyzing: 'AI analyzing competitors…',
  done: 'Done',
  failed: 'Failed',
}

function seoColor(score: number): string {
  if (score >= 70) return '#ef4444'
  if (score >= 40) return '#f59e0b'
  return '#22c55e'
}

export function SerpBriefPanel({ apiOrigin, industryVertical, onUseBrief }: Props) {
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeBrief, setActiveBrief] = useState<SerpBrief | null>(null)
  const [history, setHistory] = useState<SerpBrief[]>([])
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const loadHistory = useCallback(async () => {
    const r = await apiFetch<{ briefs: SerpBrief[] }>(`${apiOrigin}/serp-briefs?limit=10`)
    if (r.ok) setHistory(r.data.briefs)
  }, [apiOrigin])

  useEffect(() => { void loadHistory() }, [loadHistory])

  const pollBrief = useCallback((id: string) => {
    pollRef.current = setInterval(async () => {
      const r = await apiFetch<{ brief: SerpBrief }>(`${apiOrigin}/serp-briefs/${id}`)
      if (!r.ok) return
      setActiveBrief(r.data.brief)
      if (r.data.brief.status === 'done' || r.data.brief.status === 'failed') {
        stopPoll()
        setLoading(false)
        void loadHistory()
      }
    }, 2500)
  }, [apiOrigin, stopPoll, loadHistory])

  async function handleGenerate() {
    if (!keyword.trim()) return
    setError(null)
    setLoading(true)
    setActiveBrief(null)
    stopPoll()

    const r = await apiFetch<{ brief: SerpBrief }>(`${apiOrigin}/serp-briefs`, {
      method: 'POST',
      json: { keyword: keyword.trim(), industryVertical },
    })
    if (!r.ok) {
      setError(r.error ?? `Request failed`)
      setLoading(false)
      return
    }
    setActiveBrief(r.data.brief)
    pollBrief(r.data.brief.id)
  }

  return (
    <div className="sb-root">
      <div className="sb-form">
        <input
          className="sb-input"
          placeholder="Enter keyword or topic…"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleGenerate() }}
          disabled={loading}
        />
        <button
          className="sb-generate-btn"
          onClick={() => void handleGenerate()}
          disabled={loading || !keyword.trim()}
        >
          {loading ? 'Analyzing…' : 'Analyze SERP'}
        </button>
      </div>

      {error && <p className="sb-error">{error}</p>}

      {activeBrief && activeBrief.status !== 'done' && activeBrief.status !== 'failed' && (
        <p className="sb-status">{STATUS_LABEL[activeBrief.status]}</p>
      )}

      {activeBrief?.status === 'failed' && (
        <div className="sb-failed-row">
          <p className="sb-error">{activeBrief.error ?? 'Analysis failed'}</p>
          <button className="sb-retry-btn" onClick={() => void handleGenerate()}>Retry</button>
        </div>
      )}

      {activeBrief?.status === 'done' && (
        <BriefCard brief={activeBrief} onUseBrief={onUseBrief} />
      )}

      {history.length > 0 && (
        <>
          <div className="sb-section-label">Recent briefs</div>
          <div className="sb-history">
            {history.filter(b => b.id !== activeBrief?.id).slice(0, 5).map(b => (
              <div
                key={b.id}
                className="sb-history-item"
                onClick={() => setActiveBrief(b)}
              >
                <span className="sb-history-keyword">{b.keyword}</span>
                <span className="sb-history-status">
                  {b.status === 'done' && b.seoScore != null
                    ? `SEO ${b.seoScore}`
                    : STATUS_LABEL[b.status]}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function BriefCard({ brief, onUseBrief }: { brief: SerpBrief; onUseBrief?: (b: SerpBrief) => void }) {
  return (
    <div className="sb-card">
      {brief.suggestedHeadline && (
        <div className="sb-headline">{brief.suggestedHeadline}</div>
      )}

      {brief.suggestedAngle && (
        <div className="sb-angle">"{brief.suggestedAngle}"</div>
      )}

      <div className="sb-meta-row">
        {brief.intent && <span className="sb-badge">{brief.intent}</span>}
        {brief.seoScore != null && (
          <span className="sb-seo-score">
            SEO difficulty: <span style={{ color: seoColor(brief.seoScore) }}>{brief.seoScore}/100</span>
          </span>
        )}
      </div>

      {brief.seoScoreReason && (
        <div className="sb-status">{brief.seoScoreReason}</div>
      )}

      {brief.suggestedOutline && brief.suggestedOutline.length > 0 && (
        <>
          <div className="sb-section-label">Suggested outline</div>
          <ul className="sb-list">
            {brief.suggestedOutline.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </>
      )}

      {brief.competitorAngles && brief.competitorAngles.length > 0 && (
        <>
          <div className="sb-section-label">Competitor angles</div>
          <ul className="sb-list">
            {brief.competitorAngles.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </>
      )}

      {brief.contentGaps && brief.contentGaps.length > 0 && (
        <>
          <div className="sb-section-label">Content gaps to exploit</div>
          <ul className="sb-list">
            {brief.contentGaps.map((g, i) => (
              <li key={i}><strong>{g.topic}</strong> — {g.reason}</li>
            ))}
          </ul>
        </>
      )}

      {brief.targetKeywords && brief.targetKeywords.length > 0 && (
        <>
          <div className="sb-section-label">Target keywords</div>
          <div className="sb-keywords">
            {brief.targetKeywords.map((k, i) => (
              <span key={i} className="sb-keyword">{k}</span>
            ))}
          </div>
        </>
      )}

      {onUseBrief && (
        <button className="sb-use-btn" onClick={() => onUseBrief(brief)}>
          Use this brief →
        </button>
      )}
    </div>
  )
}
