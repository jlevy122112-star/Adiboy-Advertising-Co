
import { useState, useEffect } from 'react';
import { Flag, RefreshCw } from 'lucide-react';

interface FeatureFlag {
  key: string;
  description: string;
  enabled: boolean;
  enabledForPlans: ('free' | 'pro' | 'enterprise')[];
  createdAt: string;
}

const toggle: React.CSSProperties = {
  position: 'relative' as const,
  width: 36,
  height: 20,
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background 0.2s',
};

const card: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  padding: '16px 20px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(255,255,255,0.02)',
};

const PLAN_COLOR: Record<string, string> = {
  free:       '#475569',
  pro:        '#c9a84c',
  enterprise: '#1e90ff',
};

export const FeatureFlagsPage = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlags = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/flags', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setFlags(data.flags);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFlags(); }, []);

  const handleToggle = async (flagKey: string, currentEnabled: boolean) => {
    // Optimistic update
    setFlags(prev => prev.map(f => f.key === flagKey ? { ...f, enabled: !currentEnabled } : f));
    try {
      await fetch(`/api/admin/flags/${flagKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
    } catch {
      // Rollback
      setFlags(prev => prev.map(f => f.key === flagKey ? { ...f, enabled: currentEnabled } : f));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, letterSpacing: '0.15em', color: '#c9a84c', margin: 0 }}>
            FEATURE FLAGS
          </h1>
          <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
            {flags.filter(f => f.enabled).length} of {flags.length} enabled
          </p>
        </div>
        <button
          onClick={fetchFlags}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', color: '#64748b', cursor: 'pointer', fontSize: 12 }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Flags list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ ...card, height: 64, opacity: 0.4 }} />
          ))}
        </div>
      ) : flags.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#334155', fontSize: 13 }}>
          No feature flags configured
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {flags.map(flag => (
            <div key={flag.key} style={card}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
                <Flag size={14} style={{ color: flag.enabled ? '#c9a84c' : '#334155', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: flag.enabled ? '#e2e8f0' : '#64748b', margin: 0 }}>
                    {flag.key}
                  </p>
                  <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                    {flag.description}
                  </p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' as const }}>
                    {flag.enabledForPlans.map(plan => (
                      <span
                        key={plan}
                        style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, fontFamily: 'Courier Prime, monospace', letterSpacing: '0.1em', textTransform: 'uppercase' as const, background: `${PLAN_COLOR[plan]}20`, color: PLAN_COLOR[plan] }}
                      >
                        {plan}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Toggle */}
              <button
                onClick={() => handleToggle(flag.key, flag.enabled)}
                style={{
                  ...toggle,
                  background: flag.enabled ? 'rgba(201,168,76,0.7)' : 'rgba(255,255,255,0.1)',
                }}
                aria-label={`Toggle ${flag.key}`}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: flag.enabled ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                  }}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
