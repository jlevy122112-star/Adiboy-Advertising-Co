import type { DayKey, PlannedPost } from './calendarTypes.js'

export interface CalendarApiConfig {
  apiOrigin: string
  tenantId: string
}

interface ApiEntry {
  scheduleEntryId: string
  scheduledAt: string
  network: string
  contentSummary?: string
  videoOptions?: PlannedPost['videoOptions']
  metadata?: PlannedPost['metadata']
}

export function toValidNetwork(n: string): PlannedPost['network'] {
  const valid = ['instagram', 'facebook', 'x', 'linkedin', 'youtube', 'tiktok', 'email', 'generic'] as const
  return (valid as readonly string[]).includes(n) ? n as PlannedPost['network'] : 'generic'
}

export async function listScheduleEntriesByTenant(
  _config: CalendarApiConfig,
): Promise<ApiEntry[]> {
  return []
}

export async function syncPostChanges(
  _config: CalendarApiConfig,
  _dayKey: DayKey,
  _prevPosts: PlannedPost[],
  _nextPosts: PlannedPost[],
): Promise<void> {}

export async function updateScheduleEntry(
  _config: CalendarApiConfig,
  _id: string,
  _title: string,
  _network: PlannedPost['network'] | null,
  _scheduledAt: string,
): Promise<void> {}
