export type DayKey = string // 'YYYY-MM-DD'
export type OversightMode = 'hands_off' | 'nudges' | 'checkpoints'

export interface PlannedPost {
  id: string
  title: string
  network?: 'instagram' | 'facebook' | 'x' | 'linkedin' | 'youtube' | 'tiktok' | 'email' | 'generic'
  status?: 'draft' | 'scheduled' | 'published' | 'failed'
  scheduledTime?: string
  campaignId?: string
  campaignColor?: string
  videoOptions?: { duration?: number; format?: string } | null
  metadata?: Record<string, unknown> | null
}

export interface TaskItem {
  id: string
  text: string
  done: boolean
}

export interface PinItem {
  id: string
  text: string
  createdAt: string
  dayKey?: DayKey
}

export interface DayData {
  posts: PlannedPost[]
  notes: string
  pins: PinItem[]
  tasks: TaskItem[]
}

export interface CalendarPreferences {
  viewMode: 'month' | 'week' | 'day'
  backgroundPreset: string
  showWeekNumbers: boolean
  weekStartsOn: 0 | 1
  oversightMode: OversightMode
  density: 'compact' | 'comfortable'
  bgMode: 'gradient' | 'image' | 'none'
  gradientPreset: string
  imageUrl: string
  overlayOpacity: number
  accentHex: string
  highlightWeekends: boolean
}

export interface CalendarPersisted {
  version: 1
  preferences: CalendarPreferences
  pins: PinItem[]
  days: Record<DayKey, DayData>
}

export function defaultDayData(): DayData {
  return { posts: [], notes: '', pins: [], tasks: [] }
}

export function emptyPersisted(): CalendarPersisted {
  return {
    version: 1,
    preferences: {
      viewMode: 'month',
      backgroundPreset: 'aurora',
      showWeekNumbers: false,
      weekStartsOn: 0,
      oversightMode: 'nudges',
      density: 'comfortable',
      bgMode: 'gradient',
      gradientPreset: 'aurora',
      imageUrl: '',
      overlayOpacity: 0.4,
      accentHex: '#7c3aed',
      highlightWeekends: true,
    },
    pins: [],
    days: {},
  }
}
