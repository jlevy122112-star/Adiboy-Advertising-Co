import { z } from 'zod'

/** YYYY-MM-DD */
export type DayKey = string

export const OVERSIGHT_MODES = ['hands_off', 'nudges', 'checkpoints'] as const
export type OversightMode = (typeof OVERSIGHT_MODES)[number]

export const TaskItemSchema = z.object({
  id: z.string(),
  text: z.string().max(2000),
  done: z.boolean(),
})
export type TaskItem = z.infer<typeof TaskItemSchema>

export const POST_STATUSES = ['draft', 'scheduled', 'publishing', 'published', 'failed'] as const
export type PostStatus = (typeof POST_STATUSES)[number]

export const PlannedPostSchema = z.object({
  id: z.string(),
  title: z.string().max(500),
  network: z
    .enum([
      'facebook',
      'instagram',
      'x',
      'linkedin',
      'youtube',
      'tiktok',
      'email',
      'generic',
    ])
    .optional(),
  status: z.enum(POST_STATUSES).optional(),
  scheduledTime: z.string().max(5).optional(), // "HH:MM"
  campaignId: z.string().optional(),
  campaignColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  videoOptions: z.record(z.string(), z.unknown()).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})
export type PlannedPost = z.infer<typeof PlannedPostSchema>

export const DayDataSchema = z.object({
  notes: z.string().max(20_000),
  tasks: z.array(TaskItemSchema),
  posts: z.array(PlannedPostSchema),
})
export type DayData = z.infer<typeof DayDataSchema>

export const PinItemSchema = z.object({
  id: z.string(),
  text: z.string().max(2000),
  createdAt: z.string(),
  /** Optional anchor day for “pin to date” */
  dayKey: z.string().optional(),
})
export type PinItem = z.infer<typeof PinItemSchema>

export const PreferencesSchema = z
  .object({
    weekStartsOn: z.union([z.literal(0), z.literal(1)]),
    density: z.enum(['compact', 'comfortable']),
    accentHex: z
      .string()
      .regex(/^#([0-9A-Fa-f]{6})$/, 'Use #RRGGBB'),
    bgMode: z.enum(['none', 'gradient', 'image']),
    gradientPreset: z.enum(['aurora', 'dusk', 'mint', 'ember', 'noir']),
    imageUrl: z.string().max(2048),
    overlayOpacity: z.number().min(0).max(0.9),
    showWeekNumbers: z.boolean(),
    oversightMode: z.enum(OVERSIGHT_MODES),
    highlightWeekends: z.boolean(),
    viewMode: z.enum(['month', 'week', 'day']).default('month'),
  })
  .strict()

export type CalendarPreferences = z.infer<typeof PreferencesSchema>

export const CalendarPersistedSchema = z.object({
  version: z.literal(1),
  preferences: PreferencesSchema,
  pins: z.array(PinItemSchema),
  days: z.record(z.string(), DayDataSchema),
})

export type CalendarPersisted = z.infer<typeof CalendarPersistedSchema>

export function defaultPreferences(): CalendarPreferences {
  return {
    weekStartsOn: 0,
    density: 'comfortable',
    accentHex: '#7c3aed',
    bgMode: 'gradient',
    gradientPreset: 'aurora',
    imageUrl: '',
    overlayOpacity: 0.35,
    showWeekNumbers: false,
    oversightMode: 'nudges',
    highlightWeekends: true,
    viewMode: 'month',
  }
}

export function defaultDayData(): DayData {
  return { notes: '', tasks: [], posts: [] }
}

export function emptyPersisted(): CalendarPersisted {
  return {
    version: 1,
    preferences: defaultPreferences(),
    pins: [],
    days: {},
  }
}
