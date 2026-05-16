import type { CalendarPersisted, PlannedPost } from './calendarTypes.js'

function csvCell(val: string | undefined | null): string {
  const s = val ?? ''
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function postRow(dayKey: string, post: PlannedPost): string {
  const meta = post.metadata as Record<string, unknown> | null | undefined
  const hashtags = Array.isArray(meta?.hashtags) ? (meta!.hashtags as string[]).join(' ') : ''
  const mentions = Array.isArray(meta?.mentions) ? (meta!.mentions as string[]).join(' ') : ''
  const altText = typeof meta?.altText === 'string' ? meta.altText : ''

  return [
    csvCell(dayKey),
    csvCell(post.scheduledTime ?? ''),
    csvCell(post.network ?? ''),
    csvCell(post.title),
    csvCell(post.status ?? 'draft'),
    csvCell(hashtags),
    csvCell(mentions),
    csvCell(altText),
    csvCell(post.campaignId ?? ''),
  ].join(',')
}

export function exportToCSV(state: CalendarPersisted): string {
  const BOM = '﻿'
  const header = 'Date,Time,Platform,Title,Status,Hashtags,Mentions,Alt Text,Campaign ID'
  const rows: string[] = [header]

  const sortedDays = Object.keys(state.days).sort()
  for (const dayKey of sortedDays) {
    const day = state.days[dayKey]
    if (!day) continue
    for (const post of day.posts) {
      if (post.title.trim()) rows.push(postRow(dayKey, post))
    }
  }

  return BOM + rows.join('\r\n')
}

export function downloadCSV(state: CalendarPersisted, filename = 'marketer-pro-calendar.csv'): void {
  const csv = exportToCSV(state)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
