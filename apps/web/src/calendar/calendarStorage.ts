import { emptyPersisted, type CalendarPersisted, type DayKey } from './calendarTypes.js'

const KEY = 'marketer-pro:calendar:v1'

export function newId(): string {
  return Math.random().toString(36).slice(2, 11)
}

export function loadCalendarState(): CalendarPersisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...emptyPersisted(), ...JSON.parse(raw) } as CalendarPersisted
  } catch {}
  return emptyPersisted()
}

export function saveCalendarState(state: CalendarPersisted): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {}
}

export function exportCalendarJson(state: CalendarPersisted): string {
  return JSON.stringify(state, null, 2)
}

export function importCalendarJson(json: string): CalendarPersisted {
  const parsed = JSON.parse(json) as CalendarPersisted
  if (parsed.version !== 1) throw new Error('Unsupported version')
  return { ...emptyPersisted(), ...parsed }
}

export function toDayKey(date: Date): DayKey {
  return date.toISOString().slice(0, 10)
}
