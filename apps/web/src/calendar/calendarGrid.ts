import type { DayKey } from './calendarTypes.js'

export function toDayKey(d: Date): DayKey {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Monday-based ISO week number for a date (local). */
export function isoWeekNumber(d: Date): number {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - day + 3)
  const firstThursday = date.getTime()
  date.setMonth(0, 1)
  if (date.getDay() !== 4) {
    date.setMonth(0, 1 + ((4 - date.getDay() + 7) % 7))
  }
  return 1 + Math.ceil((firstThursday - date.getTime()) / 604800000)
}

export type MonthCell = { readonly date: Date; readonly inMonth: boolean }

/**
 * 6×7 grid for `anchor` month. `weekStartsOn` 0 = Sunday, 1 = Monday.
 */
export function buildMonthGrid(anchor: Date, weekStartsOn: 0 | 1): MonthCell[] {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const first = new Date(year, month, 1)
  const dow = first.getDay()
  const offset = (dow - weekStartsOn + 7) % 7
  const start = new Date(year, month, 1 - offset)
  const cells: MonthCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    cells.push({ date: d, inMonth: d.getMonth() === month })
  }
  return cells
}

export function isToday(d: Date): boolean {
  const t = new Date()
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  )
}

export function monthLabel(anchor: Date): string {
  return anchor.toLocaleString(undefined, { month: 'long', year: 'numeric' })
}
