export interface BestTimeSlot {
  hour: number
  score: 'peak' | 'good' | 'fair'
}

interface Props {
  value?: Date | string | null
  selectedTime?: string
  onChange?: (dt: Date) => void
  onSelect?: (isoTime: string) => void
  bestTimes?: BestTimeSlot[]
  platform?: string
}

const SCORE_COLOR: Record<BestTimeSlot['score'], string> = {
  peak: '#7c3aed',
  good: '#0ea5e9',
  fair: '#64748b',
}

export function ScheduleCalendar({ value, onChange, bestTimes = [], platform: _platform, selectedTime, onSelect }: Props) {
  const now = new Date()
  const hours = bestTimes.length > 0 ? bestTimes.map(b => b.hour) : [9, 12, 15, 18, 20]
  const scoreMap = new Map(bestTimes.map(b => [b.hour, b.score]))

  const slots: Date[] = []
  for (let d = 0; d < 3; d++) {
    for (const h of hours) {
      const dt = new Date(now)
      dt.setDate(dt.getDate() + d)
      dt.setHours(h, 0, 0, 0)
      slots.push(dt)
    }
  }

  const activeTime = value instanceof Date ? value.toISOString() : (value ?? selectedTime ?? null)
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {slots.map(dt => {
        const iso = dt.toISOString()
        const label = `${DAYS[dt.getDay()]} ${dt.getHours()}:00`
        const score = scoreMap.get(dt.getHours())
        const active = activeTime === iso
        return (
          <button
            key={iso}
            type="button"
            onClick={() => {
              onChange?.(dt)
              onSelect?.(iso)
            }}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 12,
              border: active ? `1px solid ${score ? SCORE_COLOR[score] : '#7c3aed'}` : '1px solid rgba(255,255,255,0.1)',
              background: active ? `${score ? SCORE_COLOR[score] : '#7c3aed'}22` : 'transparent',
              color: active ? (score ? SCORE_COLOR[score] : '#c084fc') : '#888',
              cursor: 'pointer',
            }}
          >
            {label}
            {score === 'peak' && <span style={{ marginLeft: 4, fontSize: 10 }}>🔥</span>}
          </button>
        )
      })}
    </div>
  )
}
