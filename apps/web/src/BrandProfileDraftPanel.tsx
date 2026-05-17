import { useCallback, useMemo, useState } from 'react'
import {
  BrandIntelligenceProfileSchema,
  BRAND_PROFILE_DRAFT_STORAGE_KEY,
  clearBrandProfileDraft,
  DEFAULT_BRAND_PROFILE_HTTP_PATH_GET,
  DEFAULT_BRAND_PROFILE_HTTP_PATH_UPSERT,
  formatBrandGenerationContextForPrompt,
  lexicalRetrievalSnippetsFromProfile,
  readBrandProfileDraft,
  writeBrandProfileDraft,
  buildBrandGenerationContext,
} from '@home-link/marketer-pro-contract'
import { z } from 'zod'
import './panel-shared.css'

function browserStorage(): Storage | null {
  return typeof globalThis !== 'undefined' &&
    'localStorage' in globalThis &&
    globalThis.localStorage
    ? globalThis.localStorage
    : null
}

function initialJsonFromStorage(): string {
  const storage = browserStorage()
  if (!storage) return ''
  const loaded = readBrandProfileDraft(storage)
  return loaded ? JSON.stringify(loaded, null, 2) : ''
}

const GetProfileBodySchema = z.object({
  profile: BrandIntelligenceProfileSchema,
})

export function BrandProfileDraftPanel() {
  const [json, setJson] = useState(initialJsonFromStorage)
  const [preview, setPreview] = useState('')
  const [message, setMessage] = useState('')
  const [retrievalQuery, setRetrievalQuery] = useState('')
  const [tenantId, setTenantId] = useState(
    () =>
      (import.meta.env.VITE_DEFAULT_TENANT_ID as string | undefined)?.trim() ||
      'local-demo-tenant',
  )
  const [profileIdForApi, setProfileIdForApi] = useState('')
  const [bearer, setBearer] = useState('')

  const apiOrigin = useMemo(() => {
    const v = import.meta.env.VITE_BRAND_PROFILE_API_ORIGIN
    return typeof v === 'string' && v.trim() ? v.trim().replace(/\/$/, '') : ''
  }, [])

  const authHeaders = useCallback((): HeadersInit => {
    const h: Record<string, string> = {}
    const t = bearer.trim()
    if (t) h.Authorization = `Bearer ${t}`
    return h
  }, [bearer])

  const onSave = () => {
    const storage = browserStorage()
    if (!storage) { setMessage('localStorage is not available.'); return }
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
    if (!storage) { setMessage('localStorage is not available.'); return }
    const loaded = readBrandProfileDraft(storage)
    if (!loaded) { setMessage('No draft found.'); return }
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

  const onPreviewWithLexicalRetrieval = () => {
    try {
      const profile = BrandIntelligenceProfileSchema.parse(JSON.parse(json))
      const snippets = lexicalRetrievalSnippetsFromProfile(profile, retrievalQuery, { limit: 8 })
      const ctx = buildBrandGenerationContext({ profile, retrievalSnippets: snippets })
      setPreview(formatBrandGenerationContextForPrompt(ctx))
      setMessage(
        snippets.length > 0
          ? `Prompt preview with ${snippets.length} lexical snippet(s).`
          : 'No lexical matches — try different keywords.',
      )
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not build preview.')
    }
  }

  const onFetchFromApi = async () => {
    if (!apiOrigin) { setMessage('Set VITE_BRAND_PROFILE_API_ORIGIN in apps/web/.env.local'); return }
    const pid = profileIdForApi.trim()
    if (!pid) { setMessage('Enter a profile id for API fetch.'); return }
    setMessage('Loading from API…')
    const u = new URL(DEFAULT_BRAND_PROFILE_HTTP_PATH_GET, `${apiOrigin}/`)
    u.searchParams.set('tenantId', tenantId.trim())
    u.searchParams.set('profileId', pid)
    try {
      const res = await fetch(u.toString(), { headers: authHeaders() })
      const body: unknown = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(
          typeof body === 'object' && body && 'error' in body
            ? `Fetch failed (${res.status}): ${String((body as { error: unknown }).error)}`
            : `Fetch failed: HTTP ${res.status}`,
        )
        return
      }
      const parsed = GetProfileBodySchema.safeParse(body)
      if (!parsed.success) { setMessage('GET response did not match expected { profile } shape.'); return }
      setJson(JSON.stringify(parsed.data.profile, null, 2))
      setMessage('Profile loaded from API.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Network error — is the brand profile server running?')
    }
  }

  const onPushToApi = async () => {
    if (!apiOrigin) { setMessage('Set VITE_BRAND_PROFILE_API_ORIGIN in apps/web/.env.local'); return }
    let profile
    try {
      profile = BrandIntelligenceProfileSchema.parse(JSON.parse(json))
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Invalid JSON or profile shape.')
      return
    }
    if (tenantId.trim() !== profile.workspaceId) {
      setMessage('tenantId must equal profile.workspaceId before pushing.')
      return
    }
    setMessage('Saving to API…')
    const u = new URL(DEFAULT_BRAND_PROFILE_HTTP_PATH_UPSERT, `${apiOrigin}/`)
    try {
      const res = await fetch(u.toString(), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenantId.trim(), profile }),
      })
      const body: unknown = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(
          typeof body === 'object' && body && 'error' in body
            ? `Upsert failed (${res.status}): ${String((body as { error: unknown }).error)}`
            : `Upsert failed: HTTP ${res.status}`,
        )
        return
      }
      const parsed = GetProfileBodySchema.safeParse(body)
      if (!parsed.success) { setMessage('Upsert response did not match expected { profile } shape.'); return }
      setJson(JSON.stringify(parsed.data.profile, null, 2))
      setMessage('Profile saved to API (round-trip validated).')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Network error — is the brand profile server running?')
    }
  }

  return (
    <div className="panel-root">
      <p className="panel-desc">
        Paste or edit JSON matching <code>BrandIntelligenceProfile</code>. Saved under{' '}
        <code>{BRAND_PROFILE_DRAFT_STORAGE_KEY}</code>.
      </p>

      <textarea
        className="panel-textarea"
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={10}
        spellCheck={false}
        aria-label="Brand profile JSON"
      />

      <div className="panel-btn-row">
        <button className="panel-btn panel-btn--primary" type="button" onClick={onSave}>Save draft</button>
        <button className="panel-btn" type="button" onClick={onLoad}>Load draft</button>
        <button className="panel-btn panel-btn--danger" type="button" onClick={onClear}>Clear</button>
        <button className="panel-btn" type="button" onClick={onPreviewPrompt}>Preview prompt</button>
      </div>

      <div className="panel-divider" />

      <p className="panel-section-title">Lexical retrieval</p>

      <div className="panel-field">
        <label className="panel-field-label" htmlFor="bpdp-query">Retrieval query</label>
        <input
          id="bpdp-query"
          className="panel-input"
          type="text"
          value={retrievalQuery}
          onChange={(e) => setRetrievalQuery(e.target.value)}
          placeholder="e.g. pricing, onboarding, compliance"
        />
      </div>

      <div className="panel-btn-row">
        <button className="panel-btn" type="button" onClick={onPreviewWithLexicalRetrieval}>
          Preview with snippets
        </button>
      </div>

      <div className="panel-divider" />

      <p className="panel-section-title">API sync (Postgres)</p>

      <div className="panel-grid-2">
        <div className="panel-field">
          <label className="panel-field-label" htmlFor="bpdp-tenant">Tenant / workspace ID</label>
          <input
            id="bpdp-tenant"
            className="panel-input"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          />
        </div>
        <div className="panel-field">
          <label className="panel-field-label" htmlFor="bpdp-profile-id">Profile ID (for GET)</label>
          <input
            id="bpdp-profile-id"
            className="panel-input"
            value={profileIdForApi}
            onChange={(e) => setProfileIdForApi(e.target.value)}
            placeholder="profile.profileId"
          />
        </div>
      </div>

      <div className="panel-field">
        <label className="panel-field-label" htmlFor="bpdp-bearer">Bearer token (optional)</label>
        <input
          id="bpdp-bearer"
          className="panel-input"
          type="password"
          value={bearer}
          onChange={(e) => setBearer(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="panel-btn-row">
        <button className="panel-btn" type="button" onClick={() => void onFetchFromApi()}>Load from API</button>
        <button className="panel-btn panel-btn--primary" type="button" onClick={() => void onPushToApi()}>Push to API</button>
      </div>

      {message && (
        <p className="panel-status" role="status">{message}</p>
      )}

      {preview && (
        <>
          <p className="panel-section-title">Prompt preview</p>
          <pre className="panel-pre">{preview}</pre>
        </>
      )}
    </div>
  )
}
