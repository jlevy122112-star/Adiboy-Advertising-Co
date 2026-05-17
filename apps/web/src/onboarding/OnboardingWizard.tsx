/**
 * Brand onboarding wizard — shown once after first login.
 * Captures: business name, industry, logo, colors, tagline, slogans, themes.
 * Saves to workspace branding API. On complete, sets localStorage flag.
 */

import { useState, useRef } from 'react'
import { getAccessToken } from '../auth/useAuth'
import './onboarding.css'

const BRAND_API = import.meta.env.VITE_BRAND_API_ORIGIN as string ?? 'http://localhost:8794'
export const ONBOARDING_DONE_KEY = 'mp_onboarding_done'

const INDUSTRIES = [
  '', // placeholder
  'Fashion & Apparel', 'Retail & E-Commerce', 'Food & Beverage', 'Restaurant & Dining',
  'Health & Wellness', 'Fitness', 'Beauty & Cosmetics', 'Healthcare',
  'Technology & Software', 'SaaS', 'Fintech', 'Finance',
  'Real Estate', 'Education & EdTech', 'B2B & Consulting',
  'Entertainment & Media', 'Travel & Hospitality', 'Non-Profit',
  'Sports & Recreation', 'Home & Lifestyle', 'Legal Services', 'Other',
] as const

type Step = 1 | 2 | 3 | 4

type BrandData = {
  businessName: string
  industryVertical: string
  websiteUrl: string
  logoUrl: string
  primaryHex: string
  accentHex: string
  tagline: string
  slogans: string[]
  themes: string[]
}

function defaultData(): BrandData {
  return {
    businessName: '',
    industryVertical: '',
    websiteUrl: '',
    logoUrl: '',
    primaryHex: '#6366f1',
    accentHex: '#8b5cf6',
    tagline: '',
    slogans: [],
    themes: [],
  }
}

type Props = {
  tenantId: string
  onComplete: () => void
}

export function OnboardingWizard({ tenantId, onComplete }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [data, setData] = useState<BrandData>(defaultData)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tag input state
  const [sloganInput, setSloganInput] = useState('')
  const [themeInput, setThemeInput] = useState('')

  // Logo mode: 'url' | 'upload'
  const [logoMode, setLogoMode] = useState<'url' | 'upload'>('url')
  const fileRef = useRef<HTMLInputElement>(null)

  const patch = (p: Partial<BrandData>) => setData((d) => ({ ...d, ...p }))

  function addSlogan() {
    const s = sloganInput.trim()
    if (!s || data.slogans.length >= 5) return
    patch({ slogans: [...data.slogans, s] })
    setSloganInput('')
  }

  function removeSlogan(i: number) {
    patch({ slogans: data.slogans.filter((_, idx) => idx !== i) })
  }

  function addTheme() {
    const t = themeInput.trim()
    if (!t || data.themes.length >= 10) return
    patch({ themes: [...data.themes, t] })
    setThemeInput('')
  }

  function removeTheme(i: number) {
    patch({ themes: data.themes.filter((_, idx) => idx !== i) })
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Upload via brand API
    const tok = getAccessToken()
    const fd = new FormData()
    fd.append('file', file)
    fd.append('tenantId', tenantId)
    try {
      const res = await fetch(`${BRAND_API}/workspace/${tenantId}/logo-upload`, {
        method: 'POST',
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
        body: fd,
      })
      if (res.ok) {
        const d = await res.json() as { url?: string }
        if (d.url) patch({ logoUrl: d.url })
      }
    } catch {
      // Fall back to local preview via object URL
      patch({ logoUrl: URL.createObjectURL(file) })
    }
  }

  async function saveAndComplete() {
    setSaving(true)
    setError(null)
    const tok = getAccessToken()

    try {
      const res = await fetch(`${BRAND_API}/api/marketer-pro/branding`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        body: JSON.stringify({
          tenantId,
          branding: {
            displayName: data.businessName || undefined,
            industryVertical: data.industryVertical || undefined,
            websiteUrl: data.websiteUrl || undefined,
            logoUrl: data.logoUrl || undefined,
            primaryHex: data.primaryHex || undefined,
            accentHex: data.accentHex || undefined,
            tagline: data.tagline || undefined,
            slogans: data.slogans.length > 0 ? data.slogans : undefined,
            themes: data.themes.length > 0 ? data.themes : undefined,
          },
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setError(body.error ?? `Save failed (${res.status})`)
        setSaving(false)
        return
      }
    } catch {
      // Non-blocking — allow onboarding to complete even if API is down
    }

    localStorage.setItem(ONBOARDING_DONE_KEY, '1')
    setSaving(false)
    onComplete()
  }

  function skip() {
    localStorage.setItem(ONBOARDING_DONE_KEY, '1')
    onComplete()
  }

  const progress = (step / 4) * 100

  return (
    <div className="ob-root">
      <div className="ob-card">
        <div className="ob-progress">
          <div className="ob-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {step === 1 && (
          <Step1
            data={data}
            patch={patch}
            onNext={() => setStep(2)}
            onSkip={skip}
          />
        )}

        {step === 2 && (
          <Step2
            data={data}
            patch={patch}
            logoMode={logoMode}
            setLogoMode={setLogoMode}
            fileRef={fileRef}
            onFileChange={handleLogoFile}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <Step3
            data={data}
            patch={patch}
            sloganInput={sloganInput}
            setSloganInput={setSloganInput}
            addSlogan={addSlogan}
            removeSlogan={removeSlogan}
            themeInput={themeInput}
            setThemeInput={setThemeInput}
            addTheme={addTheme}
            removeTheme={removeTheme}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && (
          <Step4
            data={data}
            saving={saving}
            error={error}
            onBack={() => setStep(3)}
            onComplete={() => void saveAndComplete()}
            onSkip={skip}
          />
        )}
      </div>
    </div>
  )
}

// ── Step 1: Business basics ────────────────────────────────────────────────

function Step1({ data, patch, onNext, onSkip }: {
  data: BrandData
  patch: (p: Partial<BrandData>) => void
  onNext: () => void
  onSkip: () => void
}) {
  return (
    <>
      <div className="ob-header">
        <p className="ob-step-indicator">Step 1 of 4</p>
        <h1 className="ob-title">Tell us about your business</h1>
        <p className="ob-subtitle">This helps us personalize every ad to your brand — automatically.</p>
      </div>

      <div className="ob-fields">
        <label className="ob-field">
          <span className="ob-label">Business name *</span>
          <input
            className="ob-input"
            type="text"
            value={data.businessName}
            onChange={(e) => patch({ businessName: e.target.value })}
            placeholder="e.g. Apex Fitness Co."
            maxLength={120}
            autoFocus
          />
        </label>

        <label className="ob-field">
          <span className="ob-label">Industry / category</span>
          <select
            className="ob-select"
            value={data.industryVertical}
            onChange={(e) => patch({ industryVertical: e.target.value })}
          >
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>{ind || 'Select your industry…'}</option>
            ))}
          </select>
        </label>

        <label className="ob-field">
          <span className="ob-label">Website URL <span className="ob-label-hint">(optional)</span></span>
          <input
            className="ob-input"
            type="url"
            value={data.websiteUrl}
            onChange={(e) => patch({ websiteUrl: e.target.value })}
            placeholder="https://yoursite.com"
          />
        </label>
      </div>

      <div className="ob-nav">
        <button
          className="ob-btn ob-btn--primary"
          type="button"
          disabled={!data.businessName.trim()}
          onClick={onNext}
        >
          Next →
        </button>
        <button className="ob-skip" type="button" onClick={onSkip}>Skip setup</button>
      </div>
    </>
  )
}

// ── Step 2: Visual identity ────────────────────────────────────────────────

function Step2({ data, patch, logoMode, setLogoMode, fileRef, onFileChange, onBack, onNext }: {
  data: BrandData
  patch: (p: Partial<BrandData>) => void
  logoMode: 'url' | 'upload'
  setLogoMode: (m: 'url' | 'upload') => void
  fileRef: React.RefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <>
      <div className="ob-header">
        <p className="ob-step-indicator">Step 2 of 4</p>
        <h1 className="ob-title">Your visual identity</h1>
        <p className="ob-subtitle">Brand colors and logo applied to every ad we generate.</p>
      </div>

      <div className="ob-fields">
        <div className="ob-field">
          <span className="ob-label">Logo</span>
          <div className="ob-logo-mode-toggle">
            <button
              className={`ob-logo-mode-btn${logoMode === 'url' ? ' ob-logo-mode-btn--active' : ''}`}
              type="button"
              onClick={() => setLogoMode('url')}
            >URL</button>
            <button
              className={`ob-logo-mode-btn${logoMode === 'upload' ? ' ob-logo-mode-btn--active' : ''}`}
              type="button"
              onClick={() => setLogoMode('upload')}
            >Upload file</button>
          </div>

          {logoMode === 'url' ? (
            <input
              className="ob-input"
              type="url"
              value={data.logoUrl}
              onChange={(e) => patch({ logoUrl: e.target.value })}
              placeholder="https://your-cdn.com/logo.png"
            />
          ) : (
            <label className="ob-logo-zone" onClick={() => fileRef.current?.click()}>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={onFileChange}
              />
              {data.logoUrl ? (
                <img src={data.logoUrl} alt="Logo preview" className="ob-logo-preview" />
              ) : (
                <>
                  <span style={{ fontSize: '2rem' }}>🖼</span>
                  <p className="ob-logo-hint">Click to upload PNG, JPG, SVG, or WebP</p>
                </>
              )}
              <button className="ob-logo-btn" type="button">Browse files</button>
            </label>
          )}

          {data.logoUrl && logoMode === 'url' && (
            <img
              src={data.logoUrl}
              alt="Logo preview"
              className="ob-logo-preview"
              style={{ marginTop: '0.5rem' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
        </div>

        <div className="ob-color-row">
          <div className="ob-color-field">
            <span className="ob-label">Primary brand color</span>
            <div className="ob-color-input-row">
              <input
                type="color"
                className="ob-color-swatch"
                value={data.primaryHex}
                onChange={(e) => patch({ primaryHex: e.target.value })}
              />
              <input
                className="ob-input"
                value={data.primaryHex}
                onChange={(e) => {
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) patch({ primaryHex: e.target.value })
                }}
                maxLength={7}
                placeholder="#6366f1"
                style={{ fontFamily: 'var(--mono)' }}
              />
            </div>
          </div>

          <div className="ob-color-field">
            <span className="ob-label">Accent color</span>
            <div className="ob-color-input-row">
              <input
                type="color"
                className="ob-color-swatch"
                value={data.accentHex}
                onChange={(e) => patch({ accentHex: e.target.value })}
              />
              <input
                className="ob-input"
                value={data.accentHex}
                onChange={(e) => {
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) patch({ accentHex: e.target.value })
                }}
                maxLength={7}
                placeholder="#8b5cf6"
                style={{ fontFamily: 'var(--mono)' }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="ob-nav">
        <button className="ob-btn ob-btn--secondary" type="button" onClick={onBack}>← Back</button>
        <button className="ob-btn ob-btn--primary" type="button" onClick={onNext}>Next →</button>
      </div>
    </>
  )
}

// ── Step 3: Voice & messaging ──────────────────────────────────────────────

function Step3({
  data, patch, sloganInput, setSloganInput, addSlogan, removeSlogan,
  themeInput, setThemeInput, addTheme, removeTheme, onBack, onNext,
}: {
  data: BrandData
  patch: (p: Partial<BrandData>) => void
  sloganInput: string
  setSloganInput: (s: string) => void
  addSlogan: () => void
  removeSlogan: (i: number) => void
  themeInput: string
  setThemeInput: (s: string) => void
  addTheme: () => void
  removeTheme: (i: number) => void
  onBack: () => void
  onNext: () => void
}) {
  function handleSloganKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addSlogan() }
  }
  function handleThemeKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addTheme() }
  }

  return (
    <>
      <div className="ob-header">
        <p className="ob-step-indicator">Step 3 of 4</p>
        <h1 className="ob-title">Your voice & messaging</h1>
        <p className="ob-subtitle">AI uses your taglines, slogans, and themes in every ad it generates.</p>
      </div>

      <div className="ob-fields">
        <label className="ob-field">
          <span className="ob-label">Primary tagline</span>
          <input
            className="ob-input"
            type="text"
            value={data.tagline}
            onChange={(e) => patch({ tagline: e.target.value })}
            placeholder="e.g. Built for champions."
            maxLength={280}
          />
        </label>

        <div className="ob-field">
          <span className="ob-label">Slogans / ad phrases <span className="ob-label-hint">(up to 5 — press Enter to add)</span></span>
          <div className="ob-tag-input-row">
            <input
              className="ob-input"
              type="text"
              value={sloganInput}
              onChange={(e) => setSloganInput(e.target.value)}
              onKeyDown={handleSloganKey}
              placeholder="e.g. No limits. Just results."
              maxLength={280}
              disabled={data.slogans.length >= 5}
            />
            <button
              className="ob-tag-add-btn"
              type="button"
              onClick={addSlogan}
              disabled={data.slogans.length >= 5}
            >Add</button>
          </div>
          {data.slogans.length > 0 && (
            <div className="ob-tags">
              {data.slogans.map((s, i) => (
                <span key={i} className="ob-tag">
                  {s}
                  <button className="ob-tag-remove" type="button" onClick={() => removeSlogan(i)}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="ob-field">
          <span className="ob-label">Brand themes / values <span className="ob-label-hint">(keywords — press Enter to add)</span></span>
          <div className="ob-tag-input-row">
            <input
              className="ob-input"
              type="text"
              value={themeInput}
              onChange={(e) => setThemeInput(e.target.value)}
              onKeyDown={handleThemeKey}
              placeholder="e.g. innovation, trust, bold"
              maxLength={80}
              disabled={data.themes.length >= 10}
            />
            <button
              className="ob-tag-add-btn"
              type="button"
              onClick={addTheme}
              disabled={data.themes.length >= 10}
            >Add</button>
          </div>
          {data.themes.length > 0 && (
            <div className="ob-tags">
              {data.themes.map((t, i) => (
                <span key={i} className="ob-tag">
                  {t}
                  <button className="ob-tag-remove" type="button" onClick={() => removeTheme(i)}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="ob-nav">
        <button className="ob-btn ob-btn--secondary" type="button" onClick={onBack}>← Back</button>
        <button className="ob-btn ob-btn--primary" type="button" onClick={onNext}>Next →</button>
      </div>
    </>
  )
}

// ── Step 4: Review & finish ────────────────────────────────────────────────

function Step4({ data, saving, error, onBack, onComplete, onSkip }: {
  data: BrandData
  saving: boolean
  error: string | null
  onBack: () => void
  onComplete: () => void
  onSkip: () => void
}) {
  return (
    <>
      <div className="ob-header">
        <p className="ob-step-indicator">Step 4 of 4</p>
        <h1 className="ob-title">Ready to generate ads</h1>
        <p className="ob-subtitle">Here's what we'll use for every piece of content we create.</p>
      </div>

      <div className="ob-fields">
        <ReviewRow label="Business" value={data.businessName} />
        <ReviewRow label="Industry" value={data.industryVertical} />
        <ReviewRow label="Website" value={data.websiteUrl} />
        {data.tagline && <ReviewRow label="Tagline" value={`"${data.tagline}"`} />}
        {data.slogans.length > 0 && (
          <ReviewRow label="Slogans" value={data.slogans.map((s) => `"${s}"`).join(' · ')} />
        )}
        {data.themes.length > 0 && (
          <ReviewRow label="Themes" value={data.themes.join(', ')} />
        )}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.25rem' }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: data.primaryHex, border: '1px solid #334155', flexShrink: 0 }} />
          <div style={{ width: 28, height: 28, borderRadius: 6, background: data.accentHex, border: '1px solid #334155', flexShrink: 0 }} />
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Brand colors</span>
        </div>
      </div>

      {error && <p className="ob-error">{error}</p>}
      {saving && <p className="ob-saving">Saving your brand profile…</p>}

      <div className="ob-nav">
        <button className="ob-btn ob-btn--secondary" type="button" onClick={onBack} disabled={saving}>← Back</button>
        <button className="ob-btn ob-btn--primary" type="button" onClick={onComplete} disabled={saving}>
          {saving ? 'Saving…' : 'Launch Marketer Pro 🚀'}
        </button>
      </div>

      <button className="ob-skip" type="button" onClick={onSkip} style={{ textAlign: 'center' }}>
        I'll set this up later
      </button>
    </>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem' }}>
      <span style={{ color: '#64748b', minWidth: 70, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#e2e8f0', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}
