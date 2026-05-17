import { useCallback, useEffect, useRef, useState } from 'react'
import './brand-theme-panel.css'

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

  useEffect(() => {
    applyBrandTheme(theme)
  }, [applyBrandTheme])

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
    // fire-and-forget
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
    <div className="btp-root">
      {local.logoUrl && (
        <img
          src={local.logoUrl}
          alt="Brand logo preview"
          className="btp-logo-preview"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}

      <div className="btp-grid">
        <label className="btp-field">
          <span className="btp-field-label">Brand name</span>
          <input
            className="btp-input"
            value={local.displayName}
            onChange={(e) => patch({ displayName: e.target.value })}
            placeholder="Acme Co."
            maxLength={120}
          />
        </label>

        <label className="btp-field">
          <span className="btp-field-label">Tagline</span>
          <input
            className="btp-input"
            value={local.tagline}
            onChange={(e) => patch({ tagline: e.target.value })}
            placeholder="Just do it"
            maxLength={280}
          />
        </label>

        <label className="btp-field btp-full-col">
          <span className="btp-field-label">Logo URL (https://)</span>
          <input
            className="btp-input"
            type="url"
            value={local.logoUrl}
            onChange={(e) => patch({ logoUrl: e.target.value })}
            placeholder="https://your-cdn.com/logo.png"
          />
          <p className="btp-hint">
            Paste a public image URL. The logo appears in the app header and is used as a
            watermark in generated video and image ads.
          </p>
        </label>

        <label className="btp-field">
          <span className="btp-field-label">Primary color</span>
          <div className="btp-color-row">
            <input
              type="color"
              className="btp-color-swatch"
              value={local.primaryHex}
              onChange={(e) => patch({ primaryHex: e.target.value })}
            />
            <input
              className="btp-input btp-input--mono"
              value={local.primaryHex}
              onChange={(e) => {
                if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) patch({ primaryHex: e.target.value })
              }}
              maxLength={7}
              placeholder="#7c3aed"
            />
          </div>
        </label>

        <label className="btp-field">
          <span className="btp-field-label">Accent color</span>
          <div className="btp-color-row">
            <input
              type="color"
              className="btp-color-swatch"
              value={local.accentHex}
              onChange={(e) => patch({ accentHex: e.target.value })}
            />
            <input
              className="btp-input btp-input--mono"
              value={local.accentHex}
              onChange={(e) => {
                if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) patch({ accentHex: e.target.value })
              }}
              maxLength={7}
              placeholder="#a78bfa"
            />
          </div>
        </label>
      </div>

      <div className="btp-swatches">
        <div className="btp-swatch" style={{ background: local.primaryHex }} title="Primary" />
        <div className="btp-swatch" style={{ background: local.accentHex }} title="Accent" />
        <span className="btp-swatch-label">Theme preview</span>
      </div>

      <div className="btp-actions">
        <button type="button" className="btp-apply-btn" onClick={handleApply}>
          Apply theme
        </button>
        {saved && <span className="btp-saved">Theme applied ✓</span>}
      </div>
    </div>
  )
}
