import { useState, useEffect, useCallback } from 'react'
import { getAccessToken } from './auth/useAuth'
import { openPopup } from './lib/browser'
import './social-connections.css'

const SOCIAL_API = import.meta.env.VITE_SOCIAL_OAUTH_API_ORIGIN as string ?? 'http://localhost:8799'

type Connection = {
  network: string
  connectedAt: string
  expiresAt: string | null
  needsReconnect: boolean
}

type NetworkMeta = {
  label: string
  color: string
  gradient?: string
  icon: React.ReactNode
  available: boolean
  comingSoon?: boolean
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function MetaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.02a8.17 8.17 0 004.78 1.52V7.1a4.85 4.85 0 01-1.01-.41z" />
    </svg>
  )
}

function PinterestIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
    </svg>
  )
}

function RedditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  )
}

function ThreadsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.5 12.068v-.104c0-3.562.878-6.44 2.61-8.567C5.882 1.18 8.636 0 12.18 0c3.552 0 6.308 1.182 8.197 3.516a1.144 1.144 0 01-1.8 1.41C17.067 3.069 14.933 2.16 12.18 2.16c-2.697 0-4.764.846-6.144 2.515-1.348 1.63-2.036 4.064-2.036 7.289v.104c0 3.183.662 5.593 1.969 7.167 1.348 1.622 3.413 2.446 6.138 2.46h.006c2.548 0 4.482-.699 5.74-2.077.963-1.049 1.506-2.54 1.648-4.436a5.553 5.553 0 01-3.074.865c-3.18 0-5.398-2.254-5.398-5.483 0-3.221 2.218-5.476 5.398-5.476 1.744 0 3.24.645 4.222 1.818.832.994 1.274 2.352 1.274 3.928v4.764c0 2.535-.737 4.558-2.192 6.011-1.426 1.424-3.422 2.148-5.743 2.148zm5.003-11.13v-1.34c0-1.056-.282-1.909-.839-2.538-.582-.657-1.433-.99-2.528-.99-1.786 0-3.09 1.311-3.09 3.123 0 1.818 1.304 3.13 3.09 3.13a3.342 3.342 0 002.96-1.547l.407-.838z" />
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

function TwitchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  )
}

function SnapchatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12.065.001c1.579.012 6.051.461 8.048 5.158.556 1.315.43 3.515.33 5.259l-.013.22c-.002.037.02.073.056.09.302.143.76.295 1.378.295.232 0 .474-.026.72-.078a.56.56 0 01.12-.014c.433 0 .827.307.827.678.001.473-.533.854-1.364 1.01-.083.015-.174.03-.27.046-.55.088-1.38.22-1.617.879-.19.524.113 1.179.576 2.025.028.051.06.104.093.161.469.8 1.183 2.01.568 3.116-.364.657-1.094 1.079-2.17 1.255-.136.022-.217.144-.19.278.046.23.107.457.167.683.09.34.184.69.221 1.038.034.322-.156.618-.463.694a1.08 1.08 0 01-.264.033c-.266 0-.54-.095-.803-.184-.337-.114-.685-.233-1.054-.233-.185 0-.373.027-.558.082-.564.166-1.128.674-1.75 1.234-.784.71-1.671 1.516-2.898 1.516h-.013c-1.232 0-2.116-.806-2.898-1.516-.623-.56-1.186-1.068-1.75-1.234a2.058 2.058 0 00-.558-.082c-.37 0-.717.119-1.054.233-.264.09-.537.184-.803.184-.085 0-.172-.01-.256-.032-.315-.075-.507-.374-.471-.698.037-.346.131-.695.221-1.035.06-.225.12-.45.166-.679.028-.135-.054-.257-.189-.279-1.078-.176-1.808-.598-2.172-1.255-.615-1.106.099-2.316.568-3.116.033-.057.065-.11.093-.161.463-.846.766-1.501.576-2.025-.237-.659-1.066-.791-1.617-.879-.094-.016-.186-.031-.27-.046-.8-.148-1.336-.535-1.336-1.01.001-.363.375-.668.808-.668.04 0 .08.004.12.014.245.052.487.078.72.078.618 0 1.076-.152 1.376-.295.038-.018.059-.053.057-.092l-.012-.218c-.1-1.744-.227-3.945.33-5.26C5.953.461 10.485.01 11.966 0h.099z" />
    </svg>
  )
}

const NETWORKS: Record<string, NetworkMeta> = {
  x: {
    label: 'X (Twitter)',
    color: '#000000',
    icon: <XIcon />,
    available: true,
  },
  meta: {
    label: 'Facebook',
    color: '#1877f2',
    icon: <MetaIcon />,
    available: true,
  },
  instagram: {
    label: 'Instagram',
    color: '#e1306c',
    gradient: 'linear-gradient(135deg, #f58529, #dd2a7b, #8134af, #515bd4)',
    icon: <InstagramIcon />,
    available: true,
  },
  linkedin: {
    label: 'LinkedIn',
    color: '#0a66c2',
    icon: <LinkedInIcon />,
    available: true,
  },
  youtube: {
    label: 'YouTube',
    color: '#ff0000',
    icon: <YouTubeIcon />,
    available: true,
  },
  tiktok: {
    label: 'TikTok',
    color: '#010101',
    icon: <TikTokIcon />,
    available: true,
  },
  pinterest: {
    label: 'Pinterest',
    color: '#e60023',
    icon: <PinterestIcon />,
    available: false,
    comingSoon: true,
  },
  threads: {
    label: 'Threads',
    color: '#101010',
    icon: <ThreadsIcon />,
    available: false,
    comingSoon: true,
  },
  reddit: {
    label: 'Reddit',
    color: '#ff4500',
    icon: <RedditIcon />,
    available: false,
    comingSoon: true,
  },
  discord: {
    label: 'Discord',
    color: '#5865f2',
    icon: <DiscordIcon />,
    available: false,
    comingSoon: true,
  },
  snapchat: {
    label: 'Snapchat',
    color: '#fffc00',
    icon: <SnapchatIcon />,
    available: false,
    comingSoon: true,
  },
  twitch: {
    label: 'Twitch',
    color: '#9146ff',
    icon: <TwitchIcon />,
    available: false,
    comingSoon: true,
  },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export function SocialConnectionsPanel() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchConnections = useCallback(async () => {
    const tok = getAccessToken()
    if (!tok) return
    try {
      const res = await fetch(`${SOCIAL_API}/oauth/connections`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (!res.ok) return
      const { connections: c } = await res.json() as { connections: Connection[] }
      setConnections(c)
    } catch { /* network error */ }
    setLoading(false)
  }, [])

  useEffect(() => { void fetchConnections() }, [fetchConnections])

  async function connect(network: string) {
    const tok = getAccessToken()
    if (!tok) return
    setConnecting(network)
    setError(null)

    const url = `${SOCIAL_API}/oauth/connect/${network}?_tok=${encodeURIComponent(tok)}`
    const popup = openPopup(url, `oauth_${network}`)

    if (!popup) {
      setError('Popup blocked — please allow popups for this site.')
      setConnecting(null)
      return
    }

    const timer = setInterval(async () => {
      if (popup.closed) {
        clearInterval(timer)
        setConnecting(null)
        await fetchConnections()
      }
    }, 500)
  }

  async function disconnect(network: string) {
    const tok = getAccessToken()
    if (!tok) return
    setDisconnecting(network)
    try {
      await fetch(`${SOCIAL_API}/oauth/connections/${network}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tok}` },
      })
      setConnections(c => c.filter(x => x.network !== network))
    } catch { /* network error */ }
    setDisconnecting(null)
  }

  const connMap = new Map(connections.map(c => [c.network, c]))

  const available = Object.entries(NETWORKS).filter(([, m]) => m.available)
  const comingSoon = Object.entries(NETWORKS).filter(([, m]) => m.comingSoon)

  return (
    <div className="scp-root">
      <p className="scp-desc">Connect your accounts to publish across all platforms from one place.</p>

      {error && <div className="scp-error">{error}</div>}

      {loading ? (
        <div className="scp-skeleton">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="scp-skeleton-row" />
          ))}
        </div>
      ) : (
        <>
          <div className="scp-section-label">Available now</div>
          <ul className="scp-list">
            {available.map(([net, meta]) => {
              const conn = connMap.get(net)
              const isConnected = !!conn
              const needsReconnect = conn?.needsReconnect ?? false

              return (
                <li key={net} className={`scp-item${needsReconnect ? ' scp-item--warn' : isConnected ? ' scp-item--connected' : ''}`}>
                  <div className="scp-network-info">
                    <span
                      className="scp-icon"
                      style={{ background: meta.gradient ?? meta.color, color: ['snapchat'].includes(net) ? '#000' : '#fff' }}
                      aria-hidden
                    >
                      {meta.icon}
                    </span>
                    <div className="scp-network-text">
                      <span className="scp-network-name">{meta.label}</span>
                      {isConnected && !needsReconnect && conn?.connectedAt && (
                        <span className="scp-status scp-status--ok">
                          <span className="scp-status-dot" />
                          Connected {fmtDate(conn.connectedAt)}
                        </span>
                      )}
                      {needsReconnect && (
                        <span className="scp-status scp-status--warn">
                          <span className="scp-status-dot" />
                          Token expired — reconnect
                        </span>
                      )}
                      {!isConnected && (
                        <span className="scp-status scp-status--off">Not connected</span>
                      )}
                    </div>
                  </div>

                  <div className="scp-actions">
                    {isConnected && !needsReconnect ? (
                      <button
                        className="scp-btn scp-btn--disconnect"
                        onClick={() => disconnect(net)}
                        disabled={disconnecting === net}
                      >
                        {disconnecting === net ? (
                          <span className="scp-spinner" />
                        ) : 'Disconnect'}
                      </button>
                    ) : (
                      <button
                        className={`scp-btn scp-btn--connect${needsReconnect ? ' scp-btn--reconnect' : ''}`}
                        onClick={() => connect(net)}
                        disabled={connecting === net}
                      >
                        {connecting === net ? (
                          <><span className="scp-spinner" /> Connecting…</>
                        ) : needsReconnect ? 'Reconnect' : 'Connect'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="scp-section-label scp-section-label--soon">Coming soon</div>
          <ul className="scp-list scp-list--soon">
            {comingSoon.map(([net, meta]) => (
              <li key={net} className="scp-item scp-item--soon">
                <div className="scp-network-info">
                  <span
                    className="scp-icon scp-icon--soon"
                    style={{ background: meta.gradient ?? meta.color, color: ['snapchat'].includes(net) ? '#000' : '#fff' }}
                    aria-hidden
                  >
                    {meta.icon}
                  </span>
                  <div className="scp-network-text">
                    <span className="scp-network-name">{meta.label}</span>
                    <span className="scp-status scp-status--soon">Coming soon</span>
                  </div>
                </div>
                <span className="scp-soon-badge">Soon</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
