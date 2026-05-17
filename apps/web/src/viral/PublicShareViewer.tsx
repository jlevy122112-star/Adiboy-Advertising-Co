/**
 * Public share viewer — rendered at /s/:shareToken.
 * Fetches share metadata, increments view count, shows content.
 */
import { useState, useEffect } from 'react'
import './viral.css'

const VIRAL_API = import.meta.env.VITE_VIRAL_API_ORIGIN as string ?? 'http://localhost:8800'

type ShareMeta = {
  shareType: string
  campaignId: string | null
  postId: string | null
  templateId: string | null
  reportId: string | null
  brandingVisible: boolean
}

type Props = { shareToken: string }

export function PublicShareViewer({ shareToken }: Props) {
  const [meta, setMeta] = useState<ShareMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`${VIRAL_API}/viral/share/${shareToken}`)
      .then(async r => {
        if (r.status === 404) { setNotFound(true); return }
        if (r.ok) setMeta(await r.json() as ShareMeta)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [shareToken])

  if (loading) return <div className="psv-loading">Loading…</div>
  if (notFound || !meta) return <div className="psv-notfound">Share link not found or expired.</div>

  return (
    <div className="psv-root">
      <div className="psv-card">
        <div className="psv-badge">{meta.shareType.replace('_', ' ')}</div>

        {meta.shareType === 'campaign' && meta.campaignId && (
          <PublicCampaignView campaignId={meta.campaignId} />
        )}
        {meta.shareType === 'template' && meta.templateId && (
          <PublicTemplateView templateId={meta.templateId} shareToken={shareToken} />
        )}
        {meta.shareType === 'competitor_report' && meta.reportId && (
          <PublicReportView reportId={meta.reportId} />
        )}
        {meta.shareType === 'post' && (
          <div className="psv-content">
            <p className="psv-content-text">Post preview</p>
          </div>
        )}

        {meta.brandingVisible && (
          <div className="psv-branding">
            <span>Made with </span>
            <a href="https://marketerpro.io" target="_blank" rel="noopener noreferrer" className="psv-branding-link">
              Marketer Pro
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function PublicCampaignView({ campaignId }: { campaignId: string }) {
  return (
    <div className="psv-content">
      <h2 className="psv-content-title">Campaign</h2>
      <p className="psv-content-id">ID: {campaignId}</p>
      <p className="psv-content-text">This campaign was shared with you via Marketer Pro.</p>
    </div>
  )
}

function PublicTemplateView({ templateId, shareToken }: { templateId: string; shareToken: string }) {
  function cloneTemplate() {
    const tok = typeof window !== 'undefined' ? localStorage.getItem('mp_access_token') : null
    if (!tok) {
      window.location.href = `/?clone=${templateId}&ref=${shareToken}`
      return
    }
    fetch(`${VIRAL_API}/viral/track-clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ templateId, sourceToken: shareToken }),
    }).catch(() => {})
    window.location.href = `/templates/${templateId}/clone`
  }

  return (
    <div className="psv-content">
      <h2 className="psv-content-title">Template</h2>
      <p className="psv-content-id">ID: {templateId}</p>
      <button className="psv-clone-btn" type="button" onClick={cloneTemplate}>
        Use this template →
      </button>
    </div>
  )
}

function PublicReportView({ reportId }: { reportId: string }) {
  return (
    <div className="psv-content">
      <h2 className="psv-content-title">Competitor Report</h2>
      <p className="psv-content-id">ID: {reportId}</p>
      <p className="psv-content-text">This competitor analysis was shared with you.</p>
    </div>
  )
}
