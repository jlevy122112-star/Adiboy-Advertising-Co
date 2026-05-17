import { useCallback, useMemo, useState } from 'react'
import {
  CampaignRecordSchema,
  ScheduleEntryRecordSchema,
  type CampaignRecord,
  type ScheduleEntryRecord,
} from '@home-link/marketer-pro-contract'
import { z } from 'zod'
import './panel-shared.css'

const PATH_LIST = '/api/marketer-pro/campaigns/list'
const PATH_CREATE = '/api/marketer-pro/campaigns/create'
const PATH_SCHEDULE_ENTRIES = '/api/marketer-pro/campaigns/schedule-entries'

const ListBodySchema = z.object({
  campaigns: z.array(CampaignRecordSchema),
})

const ScheduleEntriesBodySchema = z.object({
  scheduleEntries: z.array(ScheduleEntryRecordSchema),
})

export function CampaignSyncPanel() {
  const apiOrigin = useMemo(() => {
    const v = import.meta.env.VITE_CAMPAIGN_API_ORIGIN
    return typeof v === 'string' && v.trim() ? v.trim().replace(/\/$/, '') : ''
  }, [])

  const [tenantId, setTenantId] = useState('local-demo-tenant')
  const [bearer, setBearer] = useState('')
  const [newName, setNewName] = useState('')
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([])
  const [campaignIdForEntries, setCampaignIdForEntries] = useState('')
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntryRecord[]>([])
  const [message, setMessage] = useState('')

  const authHeaders = useCallback((): HeadersInit => {
    const h: Record<string, string> = {}
    const t = bearer.trim()
    if (t) h.Authorization = `Bearer ${t}`
    return h
  }, [bearer])

  const refreshList = useCallback(async () => {
    if (!apiOrigin) { setMessage('Set VITE_CAMPAIGN_API_ORIGIN in apps/web/.env.local'); return }
    setMessage('Loading…')
    const u = new URL(PATH_LIST, `${apiOrigin}/`)
    u.searchParams.set('tenantId', tenantId.trim())
    u.searchParams.set('limit', '50')
    try {
      const res = await fetch(u.toString(), { headers: authHeaders() })
      const body: unknown = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(
          typeof body === 'object' && body && 'error' in body
            ? `List failed (${res.status}): ${String((body as { error: unknown }).error)}`
            : `List failed: HTTP ${res.status}`,
        )
        return
      }
      const parsed = ListBodySchema.safeParse(body)
      if (!parsed.success) { setMessage('List response did not match expected shape.'); return }
      setCampaigns(parsed.data.campaigns)
      setMessage(`Loaded ${parsed.data.campaigns.length} campaign(s).`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Network error — is the campaign server running?')
    }
  }, [apiOrigin, tenantId, authHeaders])

  const loadScheduleEntries = useCallback(async () => {
    if (!apiOrigin) { setMessage('Set VITE_CAMPAIGN_API_ORIGIN in apps/web/.env.local'); return }
    const cid = campaignIdForEntries.trim()
    if (!cid) { setMessage('Enter a campaign id.'); return }
    setMessage('Loading schedule rows…')
    const u = new URL(PATH_SCHEDULE_ENTRIES, `${apiOrigin}/`)
    u.searchParams.set('tenantId', tenantId.trim())
    u.searchParams.set('campaignId', cid)
    u.searchParams.set('limit', '50')
    try {
      const res = await fetch(u.toString(), { headers: authHeaders() })
      const body: unknown = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(
          typeof body === 'object' && body && 'error' in body
            ? `Schedule list failed (${res.status}): ${String((body as { error: unknown }).error)}`
            : `Schedule list failed: HTTP ${res.status}`,
        )
        return
      }
      const parsed = ScheduleEntriesBodySchema.safeParse(body)
      if (!parsed.success) { setMessage('Response shape mismatch.'); return }
      setScheduleEntries(parsed.data.scheduleEntries)
      setMessage(`Loaded ${parsed.data.scheduleEntries.length} schedule row(s).`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Network error — is the campaign server running?')
    }
  }, [apiOrigin, tenantId, campaignIdForEntries, authHeaders])

  const createCampaign = async () => {
    if (!apiOrigin) { setMessage('Set VITE_CAMPAIGN_API_ORIGIN in apps/web/.env.local'); return }
    const name = newName.trim()
    if (!name) { setMessage('Enter a campaign name.'); return }
    setMessage('Creating…')
    const u = new URL(PATH_CREATE, `${apiOrigin}/`)
    const campaignId = `cmp_${crypto.randomUUID()}`
    try {
      const res = await fetch(u.toString(), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenantId.trim(), campaignId, name, status: 'draft' }),
      })
      const body: unknown = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(
          typeof body === 'object' && body && 'error' in body
            ? `Create failed (${res.status}): ${String((body as { error: unknown }).error)}`
            : `Create failed: HTTP ${res.status}`,
        )
        return
      }
      setNewName('')
      setMessage(`Created ${campaignId}. Refreshing…`)
      await refreshList()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Network error.')
    }
  }

  return (
    <div className="panel-root">
      {!apiOrigin && (
        <p className="panel-status panel-status--error" role="status">
          Set <code>VITE_CAMPAIGN_API_ORIGIN=http://127.0.0.1:8793</code> in{' '}
          <code>apps/web/.env.local</code> and run <code>npm run api:campaign</code>.
        </p>
      )}

      <div className="panel-grid-2">
        <div className="panel-field">
          <label className="panel-field-label" htmlFor="csp-tenant">Tenant ID</label>
          <input
            id="csp-tenant"
            className="panel-input"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="panel-field">
          <label className="panel-field-label" htmlFor="csp-bearer">Bearer token (optional)</label>
          <input
            id="csp-bearer"
            className="panel-input"
            value={bearer}
            onChange={(e) => setBearer(e.target.value)}
            placeholder="MARKETER_CAMPAIGN_HTTP_TOKEN"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="panel-btn-row">
        <button className="panel-btn" type="button" onClick={() => void refreshList()}>Refresh list</button>
      </div>

      <div className="panel-divider" />

      <p className="panel-section-title">New campaign</p>

      <div className="panel-inline-input-row">
        <input
          className="panel-input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Campaign name"
          onKeyDown={(e) => { if (e.key === 'Enter') void createCampaign() }}
        />
        <button className="panel-btn panel-btn--primary" type="button" onClick={() => void createCampaign()}>
          Create
        </button>
      </div>

      {message && (
        <p className="panel-status" role="status">{message}</p>
      )}

      {campaigns.length > 0 && (
        <ul className="panel-list">
          {campaigns.map((c) => (
            <li key={c.campaignId} className="panel-list-item">
              <strong>{c.name}</strong>
              <span style={{ opacity: 0.5 }}>·</span>
              <span style={{ opacity: 0.6 }}>{c.status}</span>
              <code>{c.campaignId.slice(0, 12)}…</code>
            </li>
          ))}
        </ul>
      )}

      <div className="panel-divider" />

      <p className="panel-section-title">Schedule rows</p>

      <div className="panel-inline-input-row">
        <input
          className="panel-input"
          value={campaignIdForEntries}
          onChange={(e) => setCampaignIdForEntries(e.target.value)}
          placeholder="campaignId"
          autoComplete="off"
          onKeyDown={(e) => { if (e.key === 'Enter') void loadScheduleEntries() }}
        />
        <button className="panel-btn" type="button" onClick={() => void loadScheduleEntries()}>
          Load
        </button>
      </div>

      {scheduleEntries.length > 0 && (
        <ul className="panel-list">
          {scheduleEntries.map((s) => (
            <li key={s.scheduleEntryId} className="panel-list-item">
              <code>{s.scheduleEntryId.slice(0, 12)}…</code>
              <span style={{ opacity: 0.5 }}>·</span>
              <span style={{ opacity: 0.6 }}>{s.status}</span>
              {s.network && <span style={{ opacity: 0.5 }}>· {s.network}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
