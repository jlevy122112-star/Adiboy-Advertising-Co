import { useState, useEffect, useCallback } from 'react'
import './generation-history.css'

export type Preset = {
  id: string
  name: string
  description: string | null
  gen_type: string
  platform: string | null
  headline: string | null
  body: string | null
  cta: string | null
  mood: string | null
  imagery_direction: string | null
  custom_tagline: string | null
  tone_shift: string | null
  voiceover: boolean
  quality: string | null
  use_count: number
  last_used_at: string | null
}

type Props = {
  apiOrigin: string
  tenantId: string
  genType?: string
  onLoad?: (preset: Preset) => void
  /** Current form values to save as a new preset */
  currentValues?: Record<string, unknown>
}

export function PresetSelector({ apiOrigin, tenantId, genType, onLoad, currentValues }: Props) {
  const [presets, setPresets] = useState<Preset[]>([])
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)

  const loadPresets = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (genType) params.set('type', genType)
      const r = await fetch(`${apiOrigin}/presets?${params}`, {
        headers: { 'X-Tenant-Id': tenantId },
      })
      if (r.ok) {
        const data = await r.json() as { presets: Preset[] }
        setPresets(data.presets)
      }
    } catch { /* non-critical */ }
  }, [apiOrigin, tenantId, genType])

  useEffect(() => { void loadPresets() }, [loadPresets])

  async function handleLoad() {
    if (!selected) return
    try {
      await fetch(`${apiOrigin}/presets/${selected}/use`, {
        method: 'POST',
        headers: { 'X-Tenant-Id': tenantId },
      })
    } catch { /* non-critical */ }
    const preset = presets.find(p => p.id === selected)
    if (preset && onLoad) onLoad(preset)
  }

  async function handleSave() {
    if (!saveName.trim()) return
    setSaving(true)
    try {
      const body = { name: saveName.trim(), genType, ...currentValues }
      const r = await fetch(`${apiOrigin}/presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
        body: JSON.stringify(body),
      })
      if (r.ok) {
        setSaveName('')
        setShowSaveForm(false)
        void loadPresets()
      }
    } catch { /* non-critical */ } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`${apiOrigin}/presets/${id}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId },
      })
      setPresets(p => p.filter(x => x.id !== id))
      if (selected === id) setSelected('')
    } catch { /* non-critical */ }
  }

  return (
    <div className="gp-root">
      <div className="gp-row">
        <select
          className="gp-select"
          value={selected}
          onChange={e => setSelected(e.target.value)}
        >
          <option value="">— Select preset —</option>
          {presets.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}{p.use_count > 0 ? ` (${p.use_count}×)` : ''}
            </option>
          ))}
        </select>

        <button className="gp-load-btn" disabled={!selected} onClick={() => void handleLoad()}>
          Load
        </button>

        {selected && (
          <button
            className="gp-delete-btn"
            onClick={() => void handleDelete(selected)}
            title="Delete preset"
          >
            ✕
          </button>
        )}

        <button
          className="gp-save-btn"
          onClick={() => setShowSaveForm(v => !v)}
        >
          {showSaveForm ? 'Cancel' : 'Save'}
        </button>
      </div>

      {showSaveForm && (
        <div className="gp-save-form">
          <input
            className="gp-save-input"
            placeholder="Preset name…"
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleSave() }}
          />
          <button
            className="gp-save-confirm"
            disabled={saving || !saveName.trim()}
            onClick={() => void handleSave()}
          >
            {saving ? '…' : 'Save'}
          </button>
        </div>
      )}

      {presets.length === 0 && (
        <div className="gp-hint">No presets yet — save current settings to reuse later.</div>
      )}
    </div>
  )
}
