import { useCallback, useMemo, useState } from 'react'
import {
  CampaignRecordSchema,
  ScheduleEntryRecordSchema,
  type CampaignRecord,
  type ScheduleEntryRecord,
} from '@home-link/marketer-pro-contract'
import { z } from 'zod'

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
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntryRecord[]>(
    [],
  )
  const [message, setMessage] = useState('')

  const authHeaders = useCallback((): HeadersInit => {
    const h: Record<string, string> = {}
    const t = bearer.trim()
    if (t) {
      h.Authorization = `Bearer ${t}`
    }
    return h
  }, [bearer])

  const refreshList = useCallback(async () => {
    if (!apiOrigin) {
      setMessage('Set VITE_CAMPAIGN_API_ORIGIN (e.g. http://127.0.0.1:8793) in apps/web/.env.local')
      return
    }
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
      if (!parsed.success) {
        setMessage('List response did not match expected shape.')
        return
      }
      setCampaigns(parsed.data.campaigns)
      setMessage(`Loaded ${parsed.data.campaigns.length} campaign(s).`)
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'Network error — is the campaign server running?',
      )
    }
  }, [apiOrigin, tenantId, authHeaders])

  const loadScheduleEntries = useCallback(async () => {
    if (!apiOrigin) {
      setMessage('Set VITE_CAMPAIGN_API_ORIGIN (e.g. http://127.0.0.1:8793) in apps/web/.env.local')
      return
    }
    const cid = campaignIdForEntries.trim()
    if (!cid) {
      setMessage('Enter a campaign id to load schedule rows.')
      return
    }
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
      if (!parsed.success) {
        setMessage('Schedule list response did not match expected shape.')
        return
      }
      setScheduleEntries(parsed.data.scheduleEntries)
      setMessage(
        `Loaded ${parsed.data.scheduleEntries.length} schedule row(s) for campaign.`,
      )
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'Network error — is the campaign server running?',
      )
    }
  }, [apiOrigin, tenantId, campaignIdForEntries, authHeaders])

  const createCampaign = async () => {
    if (!apiOrigin) {
      setMessage('Set VITE_CAMPAIGN_API_ORIGIN in apps/web/.env.local')
      return
    }
    const name = newName.trim()
    if (!name) {
      setMessage('Enter a campaign name.')
      return
    }
    setMessage('Creating…')
    const u = new URL(PATH_CREATE, `${apiOrigin}/`)
    const campaignId = `cmp_${crypto.randomUUID()}`
    try {
      const res = await fetch(u.toString(), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenantId.trim(),
          campaignId,
          name,
          status: 'draft',
        }),
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
      setMessage(`Created ${campaignId}. Refreshing list…`)
      await refreshList()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Network error.')
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
      <h2>Campaigns (Phase 4)</h2>
      <p style={{ fontSize: '0.9rem', color: '#444' }}>
        Optional bridge to the campaign HTTP server. Start API with{' '}
        <code>npm run api:campaign</code> from the repo root, set{' '}
        <code>MARKETER_CAMPAIGN_HTTP_CORS=*</code> (or your Vite origin) on the server, then
        set <code>VITE_CAMPAIGN_API_ORIGIN</code> for this app.
      </p>
      {!apiOrigin ? (
        <p style={{ fontSize: '0.88rem', color: '#a40' }} role="status">
          Example <code>apps/web/.env.local</code>:{' '}
          <code>VITE_CAMPAIGN_API_ORIGIN=http://127.0.0.1:8793</code>
        </p>
      ) : null}
      <div
        style={{
          display: 'grid',
          gap: 10,
          marginTop: 10,
          gridTemplateColumns: '1fr 1fr',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>Tenant id</span>
          <input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            style={{ padding: 6 }}
            autoComplete="off"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>Bearer token (optional)</span>
          <input
            value={bearer}
            onChange={(e) => setBearer(e.target.value)}
            style={{ padding: 6 }}
            placeholder="MARKETER_CAMPAIGN_HTTP_TOKEN"
            autoComplete="off"
          />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button type="button" onClick={() => void refreshList()}>
          Refresh list
        </button>
      </div>
      <div style={{ marginTop: 14 }}>
        <strong>New campaign</strong>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            style={{ flex: 1, minWidth: 160, padding: 6 }}
          />
          <button type="button" onClick={() => void createCampaign()}>
            Create draft
          </button>
        </div>
      </div>
      {message ? (
        <p style={{ marginTop: 10, fontSize: '0.85rem' }} role="status">
          {message}
        </p>
      ) : null}
      {campaigns.length ? (
        <ul style={{ marginTop: 12, paddingLeft: 18, fontSize: '0.88rem' }}>
          {campaigns.map((c) => (
            <li key={c.campaignId}>
              <strong>{c.name}</strong> — {c.status} —{' '}
              <code style={{ fontSize: '0.8rem' }}>{c.campaignId}</code>
            </li>
          ))}
        </ul>
      ) : null}
      <div style={{ marginTop: 16 }}>
        <strong>Schedule rows in campaign</strong>
        <p style={{ fontSize: '0.85rem', color: '#555', marginTop: 4 }}>
          GET <code>{PATH_SCHEDULE_ENTRIES}</code> — paste a <code>campaignId</code> from the list
          above (rows must have been attached via schedule-attach or DB).
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <input
            value={campaignIdForEntries}
            onChange={(e) => setCampaignIdForEntries(e.target.value)}
            placeholder="campaignId"
            style={{ flex: 1, minWidth: 200, padding: 6 }}
            autoComplete="off"
          />
          <button type="button" onClick={() => void loadScheduleEntries()}>
            Load schedule rows
          </button>
        </div>
      </div>
      {scheduleEntries.length ? (
        <ul style={{ marginTop: 10, paddingLeft: 18, fontSize: '0.82rem' }}>
          {scheduleEntries.map((s) => (
            <li key={s.scheduleEntryId}>
              <code>{s.scheduleEntryId}</code> — {s.status}
              {s.network ? ` — ${s.network}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
