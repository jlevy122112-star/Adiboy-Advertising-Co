import { CalendarPersistedSchema, emptyPersisted, type CalendarPersisted } from './calendarTypes.js'

export const MARKETER_CALENDAR_STORAGE_KEY = 'marketer_pro_calendar_v1'

export function loadCalendarState(): CalendarPersisted {
  if (typeof localStorage === 'undefined') return emptyPersisted()
  try {
    const raw = localStorage.getItem(MARKETER_CALENDAR_STORAGE_KEY)
    if (!raw) return emptyPersisted()
    const json: unknown = JSON.parse(raw)
    const parsed = CalendarPersistedSchema.safeParse(json)
    if (!parsed.success) return emptyPersisted()
    return parsed.data
  } catch {
    return emptyPersisted()
  }
}

export function saveCalendarState(state: CalendarPersisted): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(MARKETER_CALENDAR_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota / private mode */
  }
}

export function exportCalendarJson(state: CalendarPersisted): string {
  return JSON.stringify(state, null, 2)
}

export function importCalendarJson(text: string): CalendarPersisted | null {
  try {
    const json: unknown = JSON.parse(text)
    const parsed = CalendarPersistedSchema.safeParse(json)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}
