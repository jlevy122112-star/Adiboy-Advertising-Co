import {
  ScheduleEntryRecordSchema,
  type ScheduleEntryRecord,
} from '@home-link/marketer-pro-contract'
import { z } from 'zod'
import type { DayKey, PlannedPost } from './calendarTypes.js'

const PATH_LIST_TENANT = '/api/marketer-pro/schedule-entries'
const PATH_CREATE = '/api/marketer-pro/campaigns/schedule-entries/create'
const PATH_DELETE = '/api/marketer-pro/schedule-entries/delete'
const PATH_UPDATE = '/api/marketer-pro/schedule-entries/update'

const ListResponseSchema = z.object({
  scheduleEntries: z.array(ScheduleEntryRecordSchema),
})

export type CalendarApiConfig = {
  readonly apiOrigin: string
  readonly tenantId: string
  readonly bearer?: string
}

const VALID_NETWORKS: NonNullable<PlannedPost['network']>[] = [
  'facebook',
  'instagram',
  'x',
  'linkedin',
  'youtube',
  'tiktok',
  'email',
  'generic',
]

export function toValidNetwork(
  n: string | null | undefined,
): PlannedPost['network'] {
  if (!n) return undefined
  return VALID_NETWORKS.includes(n as NonNullable<PlannedPost['network']>)
    ? (n as NonNullable<PlannedPost['network']>)
    : undefined
}

function authHeaders(bearer?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bearer?.trim()) h['Authorization'] = `Bearer ${bearer.trim()}`
  return h
}

export async function listScheduleEntriesByTenant(
  cfg: CalendarApiConfig,
): Promise<ScheduleEntryRecord[]> {
  try {
    const u = new URL(PATH_LIST_TENANT, `${cfg.apiOrigin}/`)
    u.searchParams.set('tenantId', cfg.tenantId)
    u.searchParams.set('limit', '200')
    const res = await fetch(u.toString(), { headers: authHeaders(cfg.bearer) })
    if (!res.ok) return []
    const body: unknown = await res.json().catch(() => ({}))
    const parsed = ListResponseSchema.safeParse(body)
    return parsed.success ? parsed.data.scheduleEntries : []
  } catch {
    return []
  }
}

export async function createScheduleEntry(
  cfg: CalendarApiConfig,
  scheduleEntryId: string,
  contentSummary: string,
  network: string | null,
  scheduledAt: string | null,
): Promise<boolean> {
  try {
    const u = new URL(PATH_CREATE, `${cfg.apiOrigin}/`)
    const res = await fetch(u.toString(), {
      method: 'POST',
      headers: authHeaders(cfg.bearer),
      body: JSON.stringify({
        tenantId: cfg.tenantId,
        scheduleEntryId,
        network,
        status: 'draft',
        contentSummary,
        scheduledAt,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function deleteScheduleEntry(
  cfg: CalendarApiConfig,
  scheduleEntryId: string,
): Promise<boolean> {
  try {
    const u = new URL(PATH_DELETE, `${cfg.apiOrigin}/`)
    const res = await fetch(u.toString(), {
      method: 'POST',
      headers: authHeaders(cfg.bearer),
      body: JSON.stringify({ tenantId: cfg.tenantId, scheduleEntryId }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function updateScheduleEntry(
  cfg: CalendarApiConfig,
  scheduleEntryId: string,
  contentSummary: string,
  network: string | null,
  scheduledAt: string | null,
): Promise<boolean> {
  try {
    const u = new URL(PATH_UPDATE, `${cfg.apiOrigin}/`)
    const res = await fetch(u.toString(), {
      method: 'POST',
      headers: authHeaders(cfg.bearer),
      body: JSON.stringify({
        tenantId: cfg.tenantId,
        scheduleEntryId,
        contentSummary,
        network,
        scheduledAt,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Diff prevPosts vs nextPosts for a given day and fire the appropriate
 * create/update/delete API calls. All calls are fire-and-forget — failures
 * do not affect local state.
 */
export function syncPostChanges(
  cfg: CalendarApiConfig,
  dayKey: DayKey,
  prevPosts: readonly PlannedPost[],
  nextPosts: readonly PlannedPost[],
): void {
  const scheduledAt = `${dayKey}T00:00:00.000Z`
  const prevMap = new Map(prevPosts.map((p) => [p.id, p]))
  const nextIds = new Set(nextPosts.map((p) => p.id))

  for (const post of nextPosts) {
    const prev = prevMap.get(post.id)
    if (!prev) {
      createScheduleEntry(
        cfg,
        post.id,
        post.title,
        post.network ?? null,
        scheduledAt,
      ).catch(() => {})
    } else if (prev.title !== post.title || prev.network !== post.network) {
      updateScheduleEntry(
        cfg,
        post.id,
        post.title,
        post.network ?? null,
        scheduledAt,
      ).catch(() => {})
    }
  }

  for (const post of prevPosts) {
    if (!nextIds.has(post.id)) {
      deleteScheduleEntry(cfg, post.id).catch(() => {})
    }
  }
}
