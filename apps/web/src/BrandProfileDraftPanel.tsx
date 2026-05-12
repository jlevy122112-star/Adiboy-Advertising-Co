import { useEffect, useState } from 'react'
import {
  BrandIntelligenceProfileSchema,
  BRAND_PROFILE_DRAFT_STORAGE_KEY,
  clearBrandProfileDraft,
  formatBrandGenerationContextForPrompt,
  readBrandProfileDraft,
  writeBrandProfileDraft,
  buildBrandGenerationContext,
} from '@home-link/marketer-pro-contract'

function browserStorage(): Storage | null {
  return typeof globalThis !== 'undefined' &&
    'localStorage' in globalThis &&
    globalThis.localStorage
    ? globalThis.localStorage
    : null
}

export function BrandProfileDraftPanel() {
  const [json, setJson] = useState('')
  const [preview, setPreview] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const storage = browserStorage()
    if (!storage) return
    const loaded = readBrandProfileDraft(storage)
    if (loaded) {
      setJson(JSON.stringify(loaded, null, 2))
    }
  }, [])

  const onSave = () => {
    const storage = browserStorage()
    if (!storage) {
      setMessage('localStorage is not available in this environment.')
      return
    }
    try {
      const parsed = BrandIntelligenceProfileSchema.parse(JSON.parse(json))
      writeBrandProfileDraft(storage, parsed)
      setMessage('Draft saved.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Invalid JSON or profile shape.')
    }
  }

  const onLoad = () => {
    const storage = browserStorage()
    if (!storage) {
      setMessage('localStorage is not available.')
      return
    }
    const loaded = readBrandProfileDraft(storage)
    if (!loaded) {
      setMessage('No draft found.')
      return
    }
    setJson(JSON.stringify(loaded, null, 2))
    setMessage('Draft loaded from browser storage.')
  }

  const onClear = () => {
    const storage = browserStorage()
    if (!storage) return
    clearBrandProfileDraft(storage)
    setJson('')
    setPreview('')
    setMessage('Draft cleared.')
  }

  const onPreviewPrompt = () => {
    try {
      const profile = BrandIntelligenceProfileSchema.parse(JSON.parse(json))
      const ctx = buildBrandGenerationContext({ profile })
      setPreview(formatBrandGenerationContextForPrompt(ctx))
      setMessage('Prompt preview updated.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not build preview.')
    }
  }

  return (
    <section
      style={{
        marginTop: '2rem',
        padding: '1rem',
        border: '1px solid #ccc',
        borderRadius: 8,
        maxWidth: 720,
      }}
    >
      <h2>Brand profile draft (Phase 1)</h2>
      <p style={{ fontSize: '0.9rem', color: '#444' }}>
        Paste or edit JSON matching <code>BrandIntelligenceProfile</code>. Saved under{' '}
        <code>{BRAND_PROFILE_DRAFT_STORAGE_KEY}</code> in <code>localStorage</code>.
      </p>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={12}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
        spellCheck={false}
        aria-label="Brand profile JSON"
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" onClick={onSave}>
          Save draft
        </button>
        <button type="button" onClick={onLoad}>
          Load draft
        </button>
        <button type="button" onClick={onClear}>
          Clear draft
        </button>
        <button type="button" onClick={onPreviewPrompt}>
          Preview LLM prompt block
        </button>
      </div>
      {message ? (
        <p style={{ marginTop: 8, fontSize: '0.85rem' }} role="status">
          {message}
        </p>
      ) : null}
      {preview ? (
        <>
          <h3 style={{ marginTop: 16 }}>Prompt preview</h3>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#f6f6f6',
              padding: 12,
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            {preview}
          </pre>
        </>
      ) : null}
    </section>
  )
}
