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
    if (t) {
      h.Authorization = `Bearer ${t}`
    }
    return h
  }, [bearer])

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

  const onPreviewWithLexicalRetrieval = () => {
    try {
      const profile = BrandIntelligenceProfileSchema.parse(JSON.parse(json))
      const snippets = lexicalRetrievalSnippetsFromProfile(
        profile,
        retrievalQuery,
        { limit: 8 },
      )
      const ctx = buildBrandGenerationContext({
        profile,
        retrievalSnippets: snippets,
      })
      setPreview(formatBrandGenerationContextForPrompt(ctx))
      setMessage(
        snippets.length > 0
          ? `Prompt preview with ${snippets.length} lexical snippet(s).`
          : 'No lexical matches — try different keywords or add trusted sources with summaries/tags.',
      )
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not build preview.')
    }
  }

  const onFetchFromApi = async () => {
    if (!apiOrigin) {
      setMessage(
        'Set VITE_BRAND_PROFILE_API_ORIGIN (e.g. http://127.0.0.1:8794) in apps/web/.env.local',
      )
      return
    }
    const pid = profileIdForApi.trim()
    if (!pid) {
      setMessage('Enter a profile id for API fetch (must match profile.profileId in DB).')
      return
    }
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
      if (!parsed.success) {
        setMessage('GET response did not match expected { profile } shape.')
        return
      }
      setJson(JSON.stringify(parsed.data.profile, null, 2))
      setMessage('Profile loaded from API.')
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'Network error — is the brand profile server running?',
      )
    }
  }

  const onPushToApi = async () => {
    if (!apiOrigin) {
      setMessage(
        'Set VITE_BRAND_PROFILE_API_ORIGIN (e.g. http://127.0.0.1:8794) in apps/web/.env.local',
      )
      return
    }
    let profile
    try {
      profile = BrandIntelligenceProfileSchema.parse(JSON.parse(json))
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Invalid JSON or profile shape.')
      return
    }
    if (tenantId.trim() !== profile.workspaceId) {
      setMessage(
        'tenantId field must equal profile.workspaceId before pushing (tenant-scoped row key).',
      )
      return
    }
    setMessage('Saving to API…')
    const u = new URL(DEFAULT_BRAND_PROFILE_HTTP_PATH_UPSERT, `${apiOrigin}/`)
    try {
      const res = await fetch(u.toString(), {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
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
      if (!parsed.success) {
        setMessage('Upsert response did not match expected { profile } shape.')
        return
      }
      setJson(JSON.stringify(parsed.data.profile, null, 2))
      setMessage('Profile saved to API (round-trip validated).')
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'Network error — is the brand profile server running?',
      )
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

      <h3 style={{ marginTop: 20, fontSize: '1rem' }}>Lexical retrieval (Phase 1)</h3>
      <p style={{ fontSize: '0.85rem', color: '#444' }}>
        Matches the retrieval query against trusted knowledge source titles, summaries, and tags.
      </p>
      <label style={{ display: 'block', marginTop: 6 }}>
        <span style={{ fontSize: '0.85rem' }}>Retrieval query</span>
        <input
          type="text"
          value={retrievalQuery}
          onChange={(e) => setRetrievalQuery(e.target.value)}
          placeholder="e.g. pricing, onboarding, compliance"
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
        />
      </label>
      <div style={{ marginTop: 8 }}>
        <button type="button" onClick={onPreviewWithLexicalRetrieval}>
          Preview prompt with lexical snippets
        </button>
      </div>

      <h3 style={{ marginTop: 20, fontSize: '1rem' }}>API sync (Postgres)</h3>
      <p style={{ fontSize: '0.85rem', color: '#444' }}>
        Run <code>npm run api:brand</code> from the repo root (with <code>DATABASE_URL</code> and
        migration <code>005_brand_profiles.sql</code>). Set <code>VITE_BRAND_PROFILE_API_ORIGIN</code>{' '}
        and optional bearer token here. <code>tenantId</code> must match <code>workspaceId</code> on
        the profile for upsert.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginTop: 8,
        }}
      >
        <label style={{ fontSize: '0.85rem' }}>
          tenantId / workspaceId
          <input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
          />
        </label>
        <label style={{ fontSize: '0.85rem' }}>
          profileId (for GET)
          <input
            value={profileIdForApi}
            onChange={(e) => setProfileIdForApi(e.target.value)}
            placeholder="profile.profileId"
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
          />
        </label>
      </div>
      <label style={{ display: 'block', marginTop: 8, fontSize: '0.85rem' }}>
        Bearer token (optional)
        <input
          type="password"
          value={bearer}
          onChange={(e) => setBearer(e.target.value)}
          autoComplete="off"
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
        />
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" onClick={() => void onFetchFromApi()}>
          Load from API
        </button>
        <button type="button" onClick={() => void onPushToApi()}>
          Push to API
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
