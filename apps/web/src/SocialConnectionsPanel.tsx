import { useState, useEffect, useCallback } from 'react'
import { getAccessToken } from './auth/useAuth'

const SOCIAL_API = import.meta.env.VITE_SOCIAL_OAUTH_API_ORIGIN as string ?? 'http://localhost:8799'

type Connection = {
  network: string
  connectedAt: string
  expiresAt: string | null
  needsReconnect: boolean
}

type NetworkMeta = { label: string; color: string; icon: string }

const NETWORKS: Record<string, NetworkMeta> = {
  x: { label: 'X (Twitter)', color: '#000000', icon: '𝕏' },
  meta: { label: 'Facebook', color: '#1877f2', icon: 'f' },
  linkedin: { label: 'LinkedIn', color: '#0a66c2', icon: 'in' },
  youtube: { label: 'YouTube', color: '#ff0000', icon: '▶' },
}

export function SocialConnectionsPanel() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

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
    // Redirect to OAuth start — the server will redirect to the provider
    window.location.href = `${SOCIAL_API}/oauth/connect/${network}?_tok=${encodeURIComponent(tok)}`
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

  const connectedNetworks = new Set(connections.map(c => c.network))

  return (
    <div className="sc-panel">
      <p className="sc-desc">Connect your social accounts to enable live publishing.</p>

      {loading ? (
        <div className="sc-loading">Loading…</div>
      ) : (
        <ul className="sc-list">
          {Object.entries(NETWORKS).map(([net, meta]) => {
            const conn = connections.find(c => c.network === net)
            const isConnected = connectedNetworks.has(net)

            return (
              <li key={net} className={`sc-item${conn?.needsReconnect ? ' sc-item--warn' : ''}`}>
                <div className="sc-network-info">
                  <span
                    className="sc-icon"
                    style={{ background: meta.color }}
                    aria-hidden
                  >
                    {meta.icon}
                  </span>
                  <div className="sc-network-text">
                    <span className="sc-network-name">{meta.label}</span>
                    {isConnected && !conn?.needsReconnect && (
                      <span className="sc-status sc-status--ok">Connected</span>
                    )}
                    {conn?.needsReconnect && (
                      <span className="sc-status sc-status--warn">Needs reconnect</span>
                    )}
                    {!isConnected && (
                      <span className="sc-status sc-status--off">Not connected</span>
                    )}
                  </div>
                </div>

                {isConnected ? (
                  <button
                    className="sc-btn sc-btn--disconnect"
                    onClick={() => disconnect(net)}
                    disabled={disconnecting === net}
                  >
                    {disconnecting === net ? '…' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    className="sc-btn sc-btn--connect"
                    onClick={() => connect(net)}
                  >
                    Connect
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
