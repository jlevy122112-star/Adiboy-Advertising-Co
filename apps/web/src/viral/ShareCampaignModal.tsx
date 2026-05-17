import { useState } from 'react'
import { getAccessToken } from '../auth/useAuth'
import './viral.css'

const VIRAL_API = import.meta.env.VITE_VIRAL_API_ORIGIN as string ?? 'http://localhost:8800'
const PUBLIC_URL = import.meta.env.VITE_PUBLIC_URL as string ?? window.location.origin

type ShareType = 'campaign' | 'post' | 'template' | 'competitor_report'
type Channel = 'link' | 'twitter' | 'linkedin' | 'facebook' | 'email' | 'whatsapp'

type Props = {
  shareType: ShareType
  entityId: string
  entityLabel?: string
  onClose: () => void
}

const CHANNELS: { value: Channel; label: string }[] = [
  { value: 'link', label: 'Copy link' },
  { value: 'twitter', label: 'X (Twitter)' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

const CHANNEL_URLS: Record<Channel, (url: string, label?: string) => string> = {
  link: (url) => url,
  twitter: (url, label) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this campaign: ${label ?? ''} ${url}`)}`,
  linkedin: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  facebook: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  email: (url, label) => `mailto:?subject=${encodeURIComponent(label ?? 'Check this out')}&body=${encodeURIComponent(url)}`,
  whatsapp: (url) => `https://wa.me/?text=${encodeURIComponent(url)}`,
}

export function ShareCampaignModal({ shareType, entityId, entityLabel, onClose }: Props) {
  const [channel, setChannel] = useState<Channel>('link')
  const [brandingVisible, setBrandingVisible] = useState(true)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function createShare() {
    const tok = getAccessToken()
    if (!tok) return
    setLoading(true)

    const body: Record<string, unknown> = { shareType, channel, brandingVisible }
    if (shareType === 'campaign') body['campaignId'] = entityId
    if (shareType === 'post') body['postId'] = entityId
    if (shareType === 'template') body['templateId'] = entityId
    if (shareType === 'competitor_report') body['reportId'] = entityId

    try {
      const res = await fetch(`${VIRAL_API}/viral/track-share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const { shareToken } = await res.json() as { shareToken: string }
        const baseShareUrl = `${PUBLIC_URL}/s/${shareToken}`
        setShareUrl(CHANNEL_URLS[channel](baseShareUrl, entityLabel))
      }
    } catch { /* network error */ }
    setLoading(false)
  }

  function openOrCopy() {
    if (!shareUrl) return
    if (channel === 'link') {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch(() => {})
    } else {
      window.open(shareUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="scm-overlay" role="dialog" aria-modal>
      <div className="scm-card">
        <div className="scm-header">
          <h2 className="scm-title">Share {shareType.replace('_', ' ')}</h2>
          <button className="scm-close" type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {entityLabel && <p className="scm-entity">{entityLabel}</p>}

        <div className="scm-channels">
          {CHANNELS.map(c => (
            <button
              key={c.value}
              type="button"
              className={`scm-channel-btn${channel === c.value ? ' scm-channel-btn--active' : ''}`}
              onClick={() => { setChannel(c.value); setShareUrl(null); }}
            >
              {c.label}
            </button>
          ))}
        </div>

        <label className="scm-branding-toggle">
          <input
            type="checkbox"
            checked={brandingVisible}
            onChange={e => setBrandingVisible(e.target.checked)}
          />
          <span>Show "Made with Marketer Pro" branding</span>
        </label>

        <div className="scm-actions">
          {!shareUrl ? (
            <button className="scm-btn scm-btn--primary" onClick={createShare} disabled={loading}>
              {loading ? 'Generating…' : 'Create share link'}
            </button>
          ) : (
            <>
              <input className="scm-url-input" readOnly value={shareUrl} onClick={e => (e.target as HTMLInputElement).select()} />
              <button className="scm-btn scm-btn--primary" onClick={openOrCopy}>
                {channel === 'link' ? (copied ? '✓ Copied!' : 'Copy') : 'Open'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
