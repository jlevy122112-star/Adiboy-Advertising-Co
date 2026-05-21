import { createContext, useContext, useState, type ReactNode } from 'react'

export interface BrandTheme {
  displayName: string
  logoUrl:     string
  primaryHex:  string
  accentHex:   string
  tagline:     string
}

const DEFAULT_THEME: BrandTheme = {
  displayName: '',
  logoUrl:     '',
  primaryHex:  '#7c3aed',
  accentHex:   '#a855f7',
  tagline:     '',
}

interface BrandThemeCtx {
  theme:    BrandTheme
  setTheme: (t: BrandTheme) => void
}

const Ctx = createContext<BrandThemeCtx>({ theme: DEFAULT_THEME, setTheme: () => {} })

export function BrandThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<BrandTheme>(() => {
    try {
      const raw = localStorage.getItem('marketer-pro:brand-theme')
      return raw ? { ...DEFAULT_THEME, ...JSON.parse(raw) } : DEFAULT_THEME
    } catch { return DEFAULT_THEME }
  })

  function save(t: BrandTheme) {
    setTheme(t)
    try { localStorage.setItem('marketer-pro:brand-theme', JSON.stringify(t)) } catch {}
  }

  return <Ctx.Provider value={{ theme, setTheme: save }}>{children}</Ctx.Provider>
}

export function useBrandTheme() {
  return useContext(Ctx)
}

/* ── Inline panel UI ─────────────────────────────────────────────────────── */

export function BrandThemePanel() {
  const { theme, setTheme } = useBrandTheme()
  const [open, setOpen] = useState(false)

  function field(key: keyof BrandTheme, label: string, type = 'text') {
    return (
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: 4 }}>{label}</label>
        <input
          type={type}
          value={theme[key]}
          onChange={e => setTheme({ ...theme, [key]: e.target.value })}
          style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#e8e8f0', fontSize: 13, boxSizing: 'border-box' }}
        />
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#e8e8f0', cursor: 'pointer', fontSize: 13 }}
      >
        🎨 Brand
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', right: 0, width: 280, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, zIndex: 999, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#e8e8f0' }}>Brand Settings</div>
          {field('displayName', 'Brand Name')}
          {field('tagline', 'Tagline')}
          {field('logoUrl', 'Logo URL')}
          {field('primaryHex', 'Primary Color', 'color')}
          {field('accentHex', 'Accent Color', 'color')}
        </div>
      )}
    </div>
  )
}
