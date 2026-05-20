import { useState, useMemo } from 'react'
import './ScheduleCalendar.css'

export type BestTimeSlot = { hour: number; score: 'peak' | 'good' }

export interface ScheduleCalendarProps {
  value: Date | null
  onChange: (date: Date) => void
  bestTimes?: BestTimeSlot[]   // platform-injected best-time hints
  platform?: string
  className?: string
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7) // 7am–10pm

function fmt12(hour: number) {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

export function ScheduleCalendar({ value, onChange, bestTimes = [], platform, className = '' }: ScheduleCalendarProps) {
  const today = startOfDay(new Date())
  const [mobileDayOffset, setMobileDayOffset] = useState(0)

  const days = useMemo(() => [0, 1, 2].map(n => addDays(today, n)), [today])
  const mobileDay = addDays(today, mobileDayOffset)

  const bestMap = useMemo(() => {
    const m = new Map<number, 'peak' | 'good'>()
    for (const bt of bestTimes) m.set(bt.hour, bt.score)
    return m
  }, [bestTimes])

  function pick(day: Date, hour: number) {
    const d = new Date(day)
    d.setHours(hour, 0, 0, 0)
    onChange(d)
  }

  function isSelected(day: Date, hour: number) {
    if (!value) return false
    return sameDay(value, day) && value.getHours() === hour
  }

  function dayLabel(d: Date) {
    if (sameDay(d, today)) return 'Today'
    if (sameDay(d, addDays(today, 1))) return 'Tomorrow'
    return DAY_LABELS[d.getDay()]
  }

  function dateLabel(d: Date) {
    return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`
  }

  return (
    <div className={`sc-root ${className}`}>
      {platform && <div className="sc-platform-label">{platform} best times</div>}

      {/* Desktop / tablet: 3 columns */}
      <div className="sc-grid sc-grid--desktop">
        {days.map(day => (
          <div key={day.toISOString()} className="sc-day-col">
            <div className={`sc-day-head${sameDay(day, today) ? ' sc-day-head--today' : ''}`}>
              <span className="sc-day-name">{dayLabel(day)}</span>
              <span className="sc-day-date">{dateLabel(day)}</span>
            </div>
            <div className="sc-slots">
              {HOURS.map(hour => {
                const score = bestMap.get(hour)
                const selected = isSelected(day, hour)
                return (
                  <button
                    key={hour}
                    className={[
                      'sc-slot',
                      selected ? 'sc-slot--selected' : '',
                      score === 'peak' ? 'sc-slot--peak' : score === 'good' ? 'sc-slot--good' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => pick(day, hour)}
                    title={score ? `${score === 'peak' ? '★ Peak' : '◆ Good'} time for ${platform ?? 'this platform'}` : undefined}
                  >
                    <span className="sc-slot-time">{fmt12(hour)}</span>
                    {score && <span className="sc-slot-star">{score === 'peak' ? '★' : '◆'}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile: single day with prev/next */}
      <div className="sc-grid sc-grid--mobile">
        <div className="sc-mobile-nav">
          <button
            className="sc-mobile-arrow"
            onClick={() => setMobileDayOffset(o => Math.max(0, o - 1))}
            disabled={mobileDayOffset === 0}
          >‹</button>
          <span className="sc-mobile-title">
            <span className="sc-day-name">{dayLabel(mobileDay)}</span>
            <span className="sc-day-date">{dateLabel(mobileDay)}</span>
          </span>
          <button
            className="sc-mobile-arrow"
            onClick={() => setMobileDayOffset(o => Math.min(2, o + 1))}
            disabled={mobileDayOffset === 2}
          >›</button>
        </div>
        <div className="sc-slots sc-slots--mobile">
          {HOURS.map(hour => {
            const score = bestMap.get(hour)
            const selected = isSelected(mobileDay, hour)
            return (
              <button
                key={hour}
                className={[
                  'sc-slot',
                  selected ? 'sc-slot--selected' : '',
                  score === 'peak' ? 'sc-slot--peak' : score === 'good' ? 'sc-slot--good' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => pick(mobileDay, hour)}
              >
                <span className="sc-slot-time">{fmt12(hour)}</span>
                {score && <span className="sc-slot-star">{score === 'peak' ? '★' : '◆'}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {value && (
        <div className="sc-selected-label">
          Scheduled: <strong>{dayLabel(value)}, {dateLabel(value)} at {fmt12(value.getHours())}</strong>
        </div>
      )}
    </div>
  )
}
