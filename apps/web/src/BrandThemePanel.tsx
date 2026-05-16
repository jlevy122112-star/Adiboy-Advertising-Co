import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'marketer-brand-theme'

export type BrandTheme = {
  displayName: string
  logoUrl: string
  primaryHex: string
  accentHex: string
  tagline: string
}

function defaultTheme(): BrandTheme {
  return {
    displayName: '',
    logoUrl: '',
    primaryHex: '#7c3aed',
    accentHex: '#a78bfa',
    tagline: '',
  }
}

function loadTheme(): BrandTheme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...defaultTheme(), ...(JSON.parse(raw) as Partial<BrandTheme>) } : defaultTheme()
  } catch {
    return defaultTheme()
  }
}

function saveTheme(t: BrandTheme) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
  } catch { /* storage unavailable */ }
}

export function applyBrandTheme(t: BrandTheme) {
  const root = document.documentElement
  if (/^#[0-9A-Fa-f]{6}$/.test(t.primaryHex)) {
    root.style.setProperty('--brand-primary', t.primaryHex)
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(t.accentHex)) {
    root.style.setProperty('--brand-accent', t.accentHex)
  }
}

export function useBrandTheme() {
  const [theme, setThemeState] = useState<BrandTheme>(loadTheme)

  const setTheme = useCallback((t: BrandTheme) => {
    saveTheme(t)
    applyBrandTheme(t)
    setThemeState(t)
  }, [])

  // Apply on mount
  useEffect(() => {
    applyBrandTheme(theme)
  }, []) // eslint-disable-line

  return { theme, setTheme }
}

export type BrandingApiConfig = {
  readonly apiOrigin: string
  readonly tenantId: string
  readonly bearer?: string
}

type Props = {
  theme: BrandTheme
  onThemeChange: (t: BrandTheme) => void
  apiConfig?: BrandingApiConfig | null
}

async function persistBrandingToApi(
  cfg: BrandingApiConfig,
  branding: Partial<BrandTheme>,
): Promise<void> {
  try {
    await fetch(`${cfg.apiOrigin}/api/marketer-pro/branding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.bearer?.trim() ? { Authorization: `Bearer ${cfg.bearer.trim()}` } : {}),
      },
      body: JSON.stringify({ tenantId: cfg.tenantId, branding }),
    })
  } catch {
    // fire-and-forget; local state already updated
  }
}

export function BrandThemePanel({ theme, onThemeChange, apiConfig }: Props) {
  const [local, setLocal] = useState<BrandTheme>(theme)
  const [saved, setSaved] = useState(false)
  const apiConfigRef = useRef(apiConfig)
  apiConfigRef.current = apiConfig

  const patch = (p: Partial<BrandTheme>) => {
    setLocal((prev) => ({ ...prev, ...p }))
    setSaved(false)
  }

  const handleApply = () => {
    onThemeChange(local)
    setSaved(true)
    if (apiConfigRef.current) {
      void persistBrandingToApi(apiConfigRef.current, local)
    }
  }

  return (
    <section style={{
      marginTop: '2rem',
      padding: '1.5rem',
      border: '1px solid var(--border)',
      borderRadius: 12,
      maxWidth: 720,
    }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '1.15rem', color: 'var(--text-h)' }}>
        Brand theme
      </h2>
      <p style={{ margin: '0 0 1.5rem', fontSize: '0.85rem', color: 'var(--text)' }}>
        Set your brand colors and logo. These apply across the app and are used as
        defaults when building video ads.
      </p>

      {/* Logo preview */}
      {local.logoUrl && (
        <div style={{ marginBottom: 16 }}>
          <img
            src={local.logoUrl}
            alt="Brand logo preview"
            style={{ maxHeight: 80, maxWidth: 240, objectFit: 'contain', borderRadius: 6 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Display name */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)' }}>
            Brand name
          </span>
          <input
            value={local.displayName}
            onChange={(e) => patch({ displayName: e.target.value })}
            placeholder="Acme Co."
            maxLength={120}
            style={inputStyle}
          />
        </label>

        {/* Tagline */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)' }}>
            Tagline
          </span>
          <input
            value={local.tagline}
            onChange={(e) => patch({ tagline: e.target.value })}
            placeholder="Just do it"
            maxLength={280}
            style={inputStyle}
          />
        </label>

        {/* Logo URL */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)' }}>
            Logo URL (https://)
          </span>
          <input
            type="url"
            value={local.logoUrl}
            onChange={(e) => patch({ logoUrl: e.target.value })}
            placeholder="https://your-cdn.com/logo.png"
            style={inputStyle}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>
            Paste a public image URL. The logo appears in the app header and can be used
            as a watermark in generated video ads.
          </span>
        </label>

        {/* Primary color */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)' }}>
            Primary color
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={local.primaryHex}
              onChange={(e) => patch({ primaryHex: e.target.value })}
              style={{ width: 40, height: 36, padding: 2, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: 'none' }}
            />
            <input
              value={local.primaryHex}
              onChange={(e) => {
                if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) patch({ primaryHex: e.target.value })
              }}
              maxLength={7}
              style={{ ...inputStyle, flex: 1, fontFamily: 'var(--mono)' }}
              placeholder="#7c3aed"
            />
          </div>
        </label>

        {/* Accent color */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)' }}>
            Accent color
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={local.accentHex}
              onChange={(e) => patch({ accentHex: e.target.value })}
              style={{ width: 40, height: 36, padding: 2, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: 'none' }}
            />
            <input
              value={local.accentHex}
              onChange={(e) => {
                if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) patch({ accentHex: e.target.value })
              }}
              maxLength={7}
              style={{ ...inputStyle, flex: 1, fontFamily: 'var(--mono)' }}
              placeholder="#a78bfa"
            />
          </div>
        </label>
      </div>

      {/* Color swatches preview */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: local.primaryHex,
            border: '1px solid var(--border)',
          }}
          title="Primary"
        />
        <div
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: local.accentHex,
            border: '1px solid var(--border)',
          }}
          title="Accent"
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text)' }}>Theme preview</span>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleApply}
          style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: local.primaryHex, color: '#fff',
            cursor: 'pointer', fontWeight: 600, fontSize: 14,
          }}
        >
          Apply theme
        </button>
        {saved && (
          <span style={{ fontSize: '0.85rem', color: '#22c55e' }}>
            Theme applied and saved.
          </span>
        )}
      </div>
    </section>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-h)',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
}
