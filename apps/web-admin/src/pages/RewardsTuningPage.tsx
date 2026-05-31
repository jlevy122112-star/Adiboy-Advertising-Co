
import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';

interface RewardConfig {
  xpMultiplier:           number;
  streakBonusPercent:     number;
  lootboxRates: {
    common:    number;
    rare:      number;
    epic:      number;
    legendary: number;
  };
  xpPerGeneration:        number;
  xpPerBrandComplete:     number;
  xpPerAudienceComplete:  number;
}

const label: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'Courier Prime, monospace',
  letterSpacing: '0.15em',
  color: '#475569',
  textTransform: 'uppercase' as const,
  display: 'block',
  marginBottom: 6,
};

const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(255,255,255,0.02)',
  color: '#e2e8f0',
  fontSize: 13,
  fontFamily: 'JetBrains Mono, monospace',
  outline: 'none',
  boxSizing: 'border-box' as const,
};

const card: React.CSSProperties = {
  padding: 20,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(255,255,255,0.02)',
};

export const RewardsTuningPage = () => {
  const [config, setConfig] = useState<RewardConfig>({
    xpMultiplier:           1.0,
    streakBonusPercent:     10,
    lootboxRates:           { common: 60, rare: 25, epic: 12, legendary: 3 },
    xpPerGeneration:        100,
    xpPerBrandComplete:     50,
    xpPerAudienceComplete:  50,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/rewards/config', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setConfig(data); });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/rewards/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const setField = (field: keyof RewardConfig, value: number) =>
    setConfig(prev => ({ ...prev, [field]: value }));

  const setLootboxRate = (rarity: keyof RewardConfig['lootboxRates'], value: number) =>
    setConfig(prev => ({ ...prev, lootboxRates: { ...prev.lootboxRates, [rarity]: value } }));

  const totalLootboxRate = Object.values(config.lootboxRates).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, letterSpacing: '0.15em', color: '#c9a84c', margin: 0 }}>
            REWARDS TUNING
          </h1>
          <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
            Adjust XP values, lootbox rates and streak bonuses
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 8, border: 'none', background: saved ? 'rgba(34,197,94,0.2)' : 'linear-gradient(135deg,#c9a84c,#9d7c2e)', color: saved ? '#22c55e' : '#050810', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}
        >
          <Save size={14} />
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* XP values */}
      <div style={card}>
        <p style={{ ...label, fontSize: 12, marginBottom: 16, color: '#c9a84c' }}>XP VALUES</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { field: 'xpMultiplier' as const,          label: 'Global XP Multiplier'     },
            { field: 'xpPerGeneration' as const,        label: 'XP per Generation'         },
            { field: 'xpPerBrandComplete' as const,     label: 'XP — Brand Chamber'        },
            { field: 'xpPerAudienceComplete' as const,  label: 'XP — Audience Arena'       },
            { field: 'streakBonusPercent' as const,     label: 'Streak Bonus %'            },
          ].map(({ field, label: l }) => (
            <div key={field}>
              <label style={label}>{l}</label>
              <input
                type="number"
                step="0.1"
                value={config[field] as number}
                onChange={e => setField(field, parseFloat(e.target.value))}
                style={input}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Lootbox rates */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ ...label, fontSize: 12, margin: 0, color: '#c9a84c' }}>LOOTBOX RATES</p>
          <span style={{ fontSize: 11, color: totalLootboxRate === 100 ? '#22c55e' : '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>
            Total: {totalLootboxRate}% {totalLootboxRate !== 100 ? '(must equal 100)' : '✓'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {(Object.entries(config.lootboxRates) as [keyof RewardConfig['lootboxRates'], number][]).map(([rarity, rate]) => {
            const colors: Record<string, string> = { common: '#64748b', rare: '#1e90ff', epic: '#a855f7', legendary: '#c9a84c' };
            return (
              <div key={rarity}>
                <label style={{ ...label, color: colors[rarity] }}>{rarity} %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={rate}
                  onChange={e => setLootboxRate(rarity, parseInt(e.target.value))}
                  style={{ ...input, borderColor: `${colors[rarity]}30` }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
