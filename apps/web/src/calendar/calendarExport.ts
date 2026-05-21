import type { CalendarPersisted } from './calendarTypes.js'

export function downloadCSV(state: CalendarPersisted): void {
  const rows: string[] = ['Date,Title,Network,Status']
  for (const [day, data] of Object.entries(state.days)) {
    for (const post of data.posts) {
      rows.push([day, post.title, post.network ?? '', post.status ?? ''].join(','))
    }
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `calendar-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
