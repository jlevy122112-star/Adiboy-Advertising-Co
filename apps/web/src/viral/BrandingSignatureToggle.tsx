import { useState } from 'react'
import { getAccessToken } from '../auth/useAuth'
import './viral.css'

const BRAND_API = import.meta.env.VITE_BRAND_API_ORIGIN as string ?? 'http://localhost:8793'

type Props = {
  tenantId: string
  enabled?: boolean
  brandingText?: string
}

export function BrandingSignatureToggle({ tenantId, enabled: initialEnabled = true, brandingText: initialText = 'Made with Marketer Pro' }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [text, setText] = useState(initialText)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save(newEnabled: boolean, newText: string) {
    const tok = getAccessToken()
    if (!tok) return
    setSaving(true)

    try {
      await fetch(`${BRAND_API}/workspace/${tenantId}/branding`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ viralBrandingEnabled: newEnabled, viralBrandingText: newText }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* network error */ }
    setSaving(false)
  }

  function handleToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.checked
    setEnabled(v)
    void save(v, text)
  }

  return (
    <div className="bst-root">
      <label className="bst-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleToggle}
          disabled={saving}
        />
        <span className="bst-toggle-label">
          Show branding signature on shared content
        </span>
      </label>

      {enabled && (
        <div className="bst-text-row">
          <input
            className="bst-text-input"
            type="text"
            value={text}
            maxLength={80}
            onChange={e => setText(e.target.value)}
            onBlur={() => save(enabled, text)}
            placeholder="Made with Marketer Pro"
          />
          {saving && <span className="bst-saving">Saving…</span>}
          {saved && <span className="bst-saved">Saved ✓</span>}
        </div>
      )}

      <p className="bst-hint">
        This signature appears on your public share pages and helps grow your reach organically.
      </p>
    </div>
  )
}
