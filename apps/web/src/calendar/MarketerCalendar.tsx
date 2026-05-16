import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  buildMonthGrid,
  isoWeekNumber,
  isToday,
  monthLabel,
  parseDayKey,
  toDayKey,
} from './calendarGrid.js'
import './MarketerCalendar.css'
import {
  defaultDayData,
  emptyPersisted,
  type CalendarPersisted,
  type CalendarPreferences,
  type DayData,
  type DayKey,
  type OversightMode,
  type PinItem,
  type PlannedPost,
} from './calendarTypes.js'
import {
  exportCalendarJson,
  importCalendarJson,
  loadCalendarState,
  newId,
  saveCalendarState,
} from './calendarStorage.js'
import {
  listScheduleEntriesByTenant,
  syncPostChanges,
  toValidNetwork,
  updateScheduleEntry,
  type CalendarApiConfig,
} from './calendarApi.js'
import { PostEditModal } from '../PostEditModal.js'

const NETWORK_OPTIONS: Array<NonNullable<PlannedPost['network']>> = [
  'instagram',
  'facebook',
  'x',
  'linkedin',
  'youtube',
  'tiktok',
  'email',
  'generic',
]

const NETWORK_ABBR: Record<NonNullable<PlannedPost['network']>, string> = {
  instagram: 'IG',
  facebook: 'FB',
  x: 'X',
  linkedin: 'LI',
  youtube: 'YT',
  tiktok: 'TT',
  email: '✉',
  generic: '●',
}

function oversightCopy(mode: OversightMode): string {
  switch (mode) {
    case 'hands_off':
      return 'Hands-off: move fast with fewer prompts. You can still open any day to tweak copy, tasks, or planned posts.'
    case 'nudges':
      return 'Nudges: we highlight open decisions and empty risk areas before you publish (as API wiring lands).'
    case 'checkpoints':
      return 'Checkpoints: prefer explicit confirmations at publish boundaries—best when compliance or brand stakes are high.'
    default:
      return ''
  }
}

function countActiveDaysThisMonth(
  days: CalendarPersisted['days'],
  anchor: Date,
): number {
  const y = anchor.getFullYear()
  const m = anchor.getMonth()
  let n = 0
  for (const [k, dd] of Object.entries(days)) {
    const d = parseDayKey(k as DayKey)
    if (d.getFullYear() !== y || d.getMonth() !== m) continue
    const active =
      (dd.notes?.trim().length ?? 0) > 0 ||
      (dd.tasks?.some((t) => t.text.trim()) ?? false) ||
      (dd.posts?.some((p) => p.title.trim()) ?? false)
    if (active) n++
  }
  return n
}

function activityStreak(days: CalendarPersisted['days']): number {
  const cur = new Date()
  let streak = 0
  for (let i = 0; i < 400; i++) {
    const k = toDayKey(cur)
    const dd = days[k] ?? defaultDayData()
    const active =
      dd.notes.trim().length > 0 ||
      dd.tasks.some((t) => t.text.trim()) ||
      dd.posts.some((p) => p.title.trim())
    if (!active) break
    streak++
    cur.setDate(cur.getDate() - 1)
  }
  return streak
}

const DAY_ABBRS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function getWeekStart(from: Date, weekStartsOn: 0 | 1): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay()
  const offset = weekStartsOn === 1 ? (dow === 0 ? -6 : 1 - dow) : -dow
  d.setDate(d.getDate() + offset)
  return d
}

function mobileWeekRangeLabel(start: Date): string {
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const sm = start.toLocaleString(undefined, { month: 'short' })
  const sd = start.getDate()
  const em = end.toLocaleString(undefined, { month: 'short' })
  const ed = end.getDate()
  return start.getMonth() === end.getMonth()
    ? `${sm} ${sd}–${ed}`
    : `${sm} ${sd} – ${em} ${ed}`
}

export function MarketerCalendar() {
  const [state, setState] = useState<CalendarPersisted>(loadCalendarState)
  const [anchor, setAnchor] = useState(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), 1)
  })
  const [selectedDay, setSelectedDay] = useState<DayKey | null>(null)
  const [pinDraft, setPinDraft] = useState('')
  const [pinLinkDay, setPinLinkDay] = useState(false)
  const [importText, setImportText] = useState('')
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [draggedPinId, setDraggedPinId] = useState<string | null>(null)
  const [draggedPost, setDraggedPost] = useState<{
    post: PlannedPost
    fromDayKey: DayKey
  } | null>(null)
  const [dragOverDay, setDragOverDay] = useState<DayKey | null>(null)
  const [editingPost, setEditingPost] = useState<{
    post: PlannedPost
    dayKey: DayKey
  } | null>(null)
  const [mobileWeekStart, setMobileWeekStart] = useState<Date>(() =>
    getWeekStart(new Date(), loadCalendarState().preferences.weekStartsOn),
  )
  const touchStartX = useRef<number | null>(null)

  const apiConfig = useMemo<CalendarApiConfig | null>(() => {
    const origin = import.meta.env.VITE_CAMPAIGN_API_ORIGIN
    const tenantId = import.meta.env.VITE_DEFAULT_TENANT_ID
    if (!origin?.trim() || !tenantId?.trim()) return null
    return {
      apiOrigin: origin.trim().replace(/\/$/, ''),
      tenantId: tenantId.trim(),
    }
  }, [])

  // Always-current refs so stable callbacks can read the latest values without
  // capturing stale closures.
  const apiConfigRef = useRef<CalendarApiConfig | null>(apiConfig)
  apiConfigRef.current = apiConfig
  const stateRef = useRef(state)
  stateRef.current = state

  // On mount: load schedule entries from the API and merge into local state
  // (API wins for posts it knows about; local-only pins/notes/preferences unchanged).
  useEffect(() => {
    if (!apiConfig) return
    listScheduleEntriesByTenant(apiConfig).then((entries) => {
      if (entries.length === 0) return
      setState((s) => {
        const days = { ...s.days }
        for (const entry of entries) {
          if (!entry.scheduledAt) continue
          const dayKey = entry.scheduledAt.slice(0, 10)
          const existing = days[dayKey] ?? defaultDayData()
          if (existing.posts.some((p) => p.id === entry.scheduleEntryId)) continue
          days[dayKey] = {
            ...existing,
            posts: [
              ...existing.posts,
              {
                id: entry.scheduleEntryId,
                title: entry.contentSummary ?? entry.scheduleEntryId,
                network: toValidNetwork(entry.network),
                videoOptions: entry.videoOptions ?? null,
                metadata: entry.metadata ?? null,
              },
            ],
          }
        }
        return { ...s, days }
      })
    })
  }, [])

  const p = state.preferences

  useEffect(() => {
    const t = window.setTimeout(() => saveCalendarState(state), 280)
    return () => window.clearTimeout(t)
  }, [state])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedDay(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const grid = useMemo(
    () => buildMonthGrid(anchor, p.weekStartsOn),
    [anchor, p.weekStartsOn],
  )

  const weekdayLabels = useMemo(() => {
    return p.weekStartsOn === 1
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  }, [p.weekStartsOn])

  const rows = useMemo(() => {
    const out: (typeof grid)[] = []
    for (let r = 0; r < 6; r++) out.push(grid.slice(r * 7, r * 7 + 7))
    return out
  }, [grid])

  const activeDays = useMemo(
    () => countActiveDaysThisMonth(state.days, anchor),
    [state.days, anchor],
  )
  const streak = useMemo(() => activityStreak(state.days), [state.days])

  const setPref = useCallback((partial: Partial<CalendarPreferences>) => {
    setState((s) => ({
      ...s,
      preferences: { ...s.preferences, ...partial },
    }))
  }, [])

  const getDay = useCallback(
    (key: DayKey): DayData => state.days[key] ?? defaultDayData(),
    [state.days],
  )

  const patchDay = useCallback((key: DayKey, next: DayData) => {
    const cfg = apiConfigRef.current
    if (cfg) {
      const prev = stateRef.current.days[key] ?? defaultDayData()
      syncPostChanges(cfg, key, prev.posts, next.posts)
    }
    setState((s) => ({ ...s, days: { ...s.days, [key]: next } }))
  }, [])

  const movePost = useCallback((fromKey: DayKey, toKey: DayKey, post: PlannedPost) => {
    if (fromKey === toKey) return
    const cfg = apiConfigRef.current
    if (cfg) {
      updateScheduleEntry(
        cfg,
        post.id,
        post.title,
        post.network ?? null,
        `${toKey}T00:00:00.000Z`,
      ).catch(() => {})
    }
    setState((s) => {
      const fromDay = s.days[fromKey] ?? defaultDayData()
      const toDay = s.days[toKey] ?? defaultDayData()
      return {
        ...s,
        days: {
          ...s.days,
          [fromKey]: { ...fromDay, posts: fromDay.posts.filter((p) => p.id !== post.id) },
          [toKey]: { ...toDay, posts: [...toDay.posts, post] },
        },
      }
    })
  }, [])

  const handlePostSaved = useCallback(
    (id: string, newTitle: string, network: PlannedPost['network']) => {
      setState((s) => {
        const newDays = { ...s.days }
        for (const dk of Object.keys(newDays)) {
          const day = newDays[dk]
          if (!day) continue
          const idx = day.posts.findIndex((p) => p.id === id)
          if (idx !== -1) {
            newDays[dk] = {
              ...day,
              posts: day.posts.map((p) =>
                p.id === id ? { ...p, title: newTitle, network } : p,
              ),
            }
            break
          }
        }
        return { ...s, days: newDays }
      })
    },
    [],
  )

  const handlePostDeleted = useCallback((id: string, dayKey: DayKey) => {
    setState((s) => {
      const day = s.days[dayKey]
      if (!day) return s
      return {
        ...s,
        days: {
          ...s.days,
          [dayKey]: { ...day, posts: day.posts.filter((p) => p.id !== id) },
        },
      }
    })
  }, [])

  const goPrev = () =>
    setAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const goNext = () =>
    setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  const goToday = () => {
    const t = new Date()
    setAnchor(new Date(t.getFullYear(), t.getMonth(), 1))
    setSelectedDay(toDayKey(t))
  }

  const addPin = () => {
    const text = pinDraft.trim()
    if (!text) return
    const item: PinItem = {
      id: newId(),
      text,
      createdAt: new Date().toISOString(),
      dayKey: pinLinkDay && selectedDay ? selectedDay : undefined,
    }
    setState((s) => ({ ...s, pins: [item, ...s.pins] }))
    setPinDraft('')
    setPinLinkDay(false)
  }

  const removePin = (id: string) => {
    setState((s) => ({ ...s, pins: s.pins.filter((x) => x.id !== id) }))
  }

  const onPinDrop = (targetId: string) => {
    if (!draggedPinId || draggedPinId === targetId) return
    setState((s) => {
      const pins = [...s.pins]
      const from = pins.findIndex((x) => x.id === draggedPinId)
      const to = pins.findIndex((x) => x.id === targetId)
      if (from < 0 || to < 0) return s
      const [m] = pins.splice(from, 1)
      pins.splice(to, 0, m)
      return { ...s, pins }
    })
    setDraggedPinId(null)
  }

  const onExport = () => {
    const blob = new Blob([exportCalendarJson(state)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'marketer-pro-calendar.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const onImport = () => {
    const next = importCalendarJson(importText)
    if (!next) {
      setImportMsg('Could not import — invalid JSON or shape.')
      return
    }
    setState(next)
    setImportMsg('Imported.')
    saveCalendarState(next)
  }

  const onReset = () => {
    if (
      !window.confirm(
        'Reset calendar data on this device? This clears pins and day notes.',
      )
    )
      return
    const fresh = emptyPersisted()
    setState(fresh)
    saveCalendarState(fresh)
    setSelectedDay(null)
  }

  const densityClass =
    p.density === 'compact' ? 'mc-density-compact' : 'mc-density-comfortable'

  const bgImageStyle =
    p.bgMode === 'image' && p.imageUrl.trim()
      ? { backgroundImage: `url(${p.imageUrl.trim()})` }
      : undefined

  return (
    <>
    <div
      className="mc-root"
      style={
        {
          ['--mc-accent' as string]: p.accentHex,
        } as CSSProperties
      }
    >
      <div className="mc-bg" aria-hidden>
        {p.bgMode === 'gradient' ? (
          <div
            className={`mc-bg--gradient mc-preset-${p.gradientPreset}`}
          />
        ) : null}
        {p.bgMode === 'image' ? (
          <div className="mc-bg--image" style={bgImageStyle} />
        ) : null}
        <div
          className="mc-bg-overlay"
          style={{ opacity: p.bgMode === 'none' ? 0 : p.overlayOpacity }}
        />
      </div>

      <div className="mc-inner">
        <header className="mc-header">
          <h2 className="mc-title">Content calendar</h2>
          <p className="mc-sub">
            Local-first planner — customize look, pins, and per-day tasks and
            campaign slots.{' '}
            {apiConfig
              ? `Planned posts sync to schedule API (tenant: ${apiConfig.tenantId}).`
              : 'Set VITE_CAMPAIGN_API_ORIGIN + VITE_DEFAULT_TENANT_ID to enable post sync.'}
          </p>
          <div className="mc-nav">
            <button type="button" className="mc-btn" onClick={goPrev}>
              ←
            </button>
            <button type="button" className="mc-btn" onClick={goToday}>
              Today
            </button>
            <button type="button" className="mc-btn" onClick={goNext}>
              →
            </button>
          </div>
        </header>

        <div className="mc-rhythm">
          <span>
            <strong>{monthLabel(anchor)}</strong>
          </span>
          <span>
            Active days this month: <strong>{activeDays}</strong>
          </span>
          <span>
            Rhythm streak: <strong>{streak}</strong> day
            {streak === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mc-layout">
          <div>
            <div
              className={`mc-weekdays ${densityClass}`}
              style={{
                display: 'grid',
                gridTemplateColumns: p.showWeekNumbers
                  ? '36px repeat(7, minmax(0, 1fr))'
                  : 'repeat(7, minmax(0, 1fr))',
                gap: '2px',
              }}
            >
              {p.showWeekNumbers ? (
                <span className="mc-week-num" aria-hidden>
                  Wk
                </span>
              ) : null}
              {weekdayLabels.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>

            {rows.map((row, ri) => (
              <div
                key={ri}
                className={`mc-grid ${densityClass}`}
                style={
                  p.showWeekNumbers
                    ? {
                        gridTemplateColumns:
                          '36px repeat(7, minmax(0, 1fr))',
                      }
                    : undefined
                }
              >
                {p.showWeekNumbers ? (
                  <div
                    className="mc-week-num"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                    }}
                  >
                    {isoWeekNumber(row[0].date)}
                  </div>
                ) : null}
                {row.map(({ date, inMonth }) => {
                  const key = toDayKey(date)
                  const dd = getDay(key)
                  const posts = dd.posts.filter((x) => x.title.trim())
                  const openTasks = dd.tasks.filter(
                    (t) => t.text.trim() && !t.done,
                  )
                  const hasNotes = dd.notes.trim().length > 0
                  const w = date.getDay()
                  const weekend = w === 0 || w === 6
                  const chipLimit = p.density === 'compact' ? 1 : 2
                  const isDragSource = draggedPost?.fromDayKey === key
                  const isDragTarget = dragOverDay === key && !!draggedPost && !isDragSource
                  return (
                    <button
                      key={key}
                      type="button"
                      className={[
                        'mc-day',
                        !inMonth ? 'mc-day--muted' : '',
                        isToday(date) ? 'mc-day--today' : '',
                        weekend && p.highlightWeekends
                          ? 'mc-day--weekend mc-day--hl-weekend'
                          : '',
                        isDragSource ? 'mc-day--dragging' : '',
                        isDragTarget ? 'mc-day--drag-over' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setSelectedDay(key)}
                      onDragOver={(e) => {
                        if (!draggedPost) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        setDragOverDay(key)
                      }}
                      onDragLeave={(e) => {
                        // Only clear if leaving the button itself (not a child)
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setDragOverDay(null)
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        setDragOverDay(null)
                        if (!draggedPost) return
                        movePost(draggedPost.fromDayKey, key, draggedPost.post)
                        setDraggedPost(null)
                      }}
                    >
                      <div className="mc-day-num">{date.getDate()}</div>
                      {posts.slice(0, chipLimit).map((post) => (
                        <div
                          key={post.id}
                          className="mc-post-chip"
                          draggable
                          role="button"
                          tabIndex={0}
                          aria-label={`Edit post: ${post.title}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingPost({ post, dayKey: key })
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation()
                              setEditingPost({ post, dayKey: key })
                            }
                          }}
                          onDragStart={(e) => {
                            e.stopPropagation()
                            setDraggedPost({ post, fromDayKey: key })
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragEnd={() => {
                            setDraggedPost(null)
                            setDragOverDay(null)
                          }}
                        >
                          {post.network ? (
                            <span className="mc-chip-net">
                              {NETWORK_ABBR[post.network]}
                            </span>
                          ) : null}
                          <span className="mc-chip-title">
                            {post.title.length > 13
                              ? `${post.title.slice(0, 13)}…`
                              : post.title}
                          </span>
                        </div>
                      ))}
                      {posts.length > chipLimit ? (
                        <div className="mc-chip-more">
                          +{posts.length - chipLimit}
                        </div>
                      ) : null}
                      <div className="mc-day-dots" aria-hidden>
                        {hasNotes ? <span className="mc-dot" /> : null}
                        {openTasks.length ? (
                          <span className="mc-dot mc-dot--task" />
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          <aside className="mc-side">
            <div className="mc-card mc-oversight">
              <strong>Oversight: </strong>
              {oversightCopy(p.oversightMode)}
            </div>

            <details className="mc-card mc-settings" open>
              <summary>Customize workspace</summary>
              <div className="mc-settings-grid">
                <label>
                  Oversight mode
                  <select
                    className="mc-input"
                    value={p.oversightMode}
                    onChange={(e) =>
                      setPref({
                        oversightMode: e.target.value as OversightMode,
                      })
                    }
                  >
                    <option value="hands_off">Hands off</option>
                    <option value="nudges">Nudges</option>
                    <option value="checkpoints">Checkpoints</option>
                  </select>
                </label>
                <label>
                  Week starts on
                  <select
                    className="mc-input"
                    value={p.weekStartsOn}
                    onChange={(e) =>
                      setPref({
                        weekStartsOn: Number(e.target.value) as 0 | 1,
                      })
                    }
                  >
                    <option value={0}>Sunday</option>
                    <option value={1}>Monday</option>
                  </select>
                </label>
                <label>
                  Density
                  <select
                    className="mc-input"
                    value={p.density}
                    onChange={(e) =>
                      setPref({
                        density: e.target.value as 'compact' | 'comfortable',
                      })
                    }
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </select>
                </label>
                <label>
                  Accent color
                  <input
                    className="mc-input"
                    type="color"
                    value={p.accentHex}
                    onChange={(e) => setPref({ accentHex: e.target.value })}
                  />
                </label>
                <label>
                  Background
                  <select
                    className="mc-input"
                    value={p.bgMode}
                    onChange={(e) =>
                      setPref({
                        bgMode: e.target.value as typeof p.bgMode,
                      })
                    }
                  >
                    <option value="none">Plain</option>
                    <option value="gradient">Gradient</option>
                    <option value="image">Image URL</option>
                  </select>
                </label>
                {p.bgMode === 'gradient' ? (
                  <label>
                    Gradient preset
                    <select
                      className="mc-input"
                      value={p.gradientPreset}
                      onChange={(e) =>
                        setPref({
                          gradientPreset: e.target.value as typeof p.gradientPreset,
                        })
                      }
                    >
                      <option value="aurora">Aurora</option>
                      <option value="dusk">Dusk</option>
                      <option value="mint">Mint</option>
                      <option value="ember">Ember</option>
                      <option value="noir">Noir</option>
                    </select>
                  </label>
                ) : null}
                {p.bgMode === 'image' ? (
                  <label>
                    Image URL (https)
                    <input
                      className="mc-input"
                      value={p.imageUrl}
                      onChange={(e) => setPref({ imageUrl: e.target.value })}
                      placeholder="https://…"
                    />
                  </label>
                ) : null}
                {p.bgMode !== 'none' ? (
                  <label>
                    Overlay strength
                    <input
                      className="mc-input"
                      type="range"
                      min={0}
                      max={0.9}
                      step={0.05}
                      value={p.overlayOpacity}
                      onChange={(e) =>
                        setPref({
                          overlayOpacity: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                ) : null}
                <label style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={p.showWeekNumbers}
                    onChange={(e) =>
                      setPref({ showWeekNumbers: e.target.checked })
                    }
                  />
                  &nbsp;Show ISO week numbers
                </label>
                <label style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={p.highlightWeekends}
                    onChange={(e) =>
                      setPref({ highlightWeekends: e.target.checked })
                    }
                  />
                  &nbsp;Highlight weekends
                </label>
                <div className="mc-row">
                  <button type="button" className="mc-btn" onClick={onExport}>
                    Export JSON
                  </button>
                  <button type="button" className="mc-btn" onClick={onReset}>
                    Reset local data
                  </button>
                </div>
                <label>
                  Import JSON (paste)
                  <textarea
                    className="mc-textarea"
                    rows={3}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    spellCheck={false}
                  />
                </label>
                <div className="mc-row">
                  <button
                    type="button"
                    className="mc-btn mc-btn--primary"
                    onClick={onImport}
                  >
                    Import
                  </button>
                  {importMsg ? (
                    <span style={{ fontSize: '0.78rem' }}>{importMsg}</span>
                  ) : null}
                </div>
              </div>
            </details>

            <div className="mc-card">
              <h3>Pinned list</h3>
              <p
                style={{
                  fontSize: '0.78rem',
                  margin: '0 0 0.5rem',
                  color: 'var(--text, #666)',
                }}
              >
                Drag to reorder. Pins are workspace-local until backend sync
                exists.
              </p>
              {state.pins.length === 0 ? (
                <p style={{ fontSize: '0.82rem', margin: 0 }}>No pins yet.</p>
              ) : (
                state.pins.map((pin) => (
                  <div
                    key={pin.id}
                    className="mc-pin"
                    draggable
                    onDragStart={() => setDraggedPinId(pin.id)}
                    onDragEnd={() => setDraggedPinId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onPinDrop(pin.id)}
                  >
                    <span aria-hidden>⋮⋮</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.86rem' }}>{pin.text}</div>
                      {pin.dayKey ? (
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--mc-accent)',
                            marginTop: 2,
                          }}
                        >
                          Linked: {pin.dayKey}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="mc-icon-btn"
                      aria-label="Remove pin"
                      onClick={() => removePin(pin.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
              <div style={{ marginTop: '0.6rem' }}>
                <textarea
                  className="mc-textarea"
                  rows={2}
                  placeholder="New pin…"
                  value={pinDraft}
                  onChange={(e) => setPinDraft(e.target.value)}
                />
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 6,
                    fontSize: '0.78rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={pinLinkDay}
                    onChange={(e) => setPinLinkDay(e.target.checked)}
                    disabled={!selectedDay}
                  />
                  Link to selected day {selectedDay ? `(${selectedDay})` : ''}
                </label>
                <button
                  type="button"
                  className="mc-btn mc-btn--primary"
                  style={{ marginTop: 8 }}
                  onClick={addPin}
                >
                  Add pin
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {selectedDay ? (
        <>
          <button
            type="button"
            className="mc-drawer-backdrop"
            aria-label="Close day panel"
            onClick={() => setSelectedDay(null)}
          />
          <aside className="mc-drawer" role="dialog" aria-modal="true">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <h2>{selectedDay}</h2>
              <button
                type="button"
                className="mc-btn"
                onClick={() => setSelectedDay(null)}
              >
                Close
              </button>
            </div>

            <DayEditor
              dayKey={selectedDay}
              data={getDay(selectedDay)}
              onChange={(next) => patchDay(selectedDay, next)}
            />
          </aside>
        </>
      ) : null}
    </div>

    {editingPost && (
      <PostEditModal
        post={editingPost.post}
        dayKey={editingPost.dayKey}
        onClose={() => setEditingPost(null)}
        onSaved={handlePostSaved}
        onDeleted={handlePostDeleted}
        apiConfig={apiConfig}
      />
    )}
  </>
  )
}

function DayEditor({
  dayKey,
  data,
  onChange,
}: {
  dayKey: DayKey
  data: DayData
  onChange: (d: DayData) => void
}) {
  const [postTitle, setPostTitle] = useState('')
  const [postNet, setPostNet] = useState<NonNullable<PlannedPost['network']>>(
    'instagram',
  )
  const [taskDraft, setTaskDraft] = useState('')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <label>
        <strong>Day notes</strong>
        <textarea
          className="mc-textarea"
          style={{ marginTop: 6 }}
          rows={4}
          value={data.notes}
          onChange={(e) => onChange({ ...data, notes: e.target.value })}
          placeholder="Ideas, voice prompt transcript, links…"
        />
      </label>

      <div>
        <strong>Tasks</strong>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
          {data.tasks.map((t) => (
            <li
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
              }}
            >
              <input
                type="checkbox"
                checked={t.done}
                onChange={() =>
                  onChange({
                    ...data,
                    tasks: data.tasks.map((x) =>
                      x.id === t.id ? { ...x, done: !x.done } : x,
                    ),
                  })
                }
              />
              <span
                style={{
                  flex: 1,
                  textDecoration: t.done ? 'line-through' : undefined,
                  opacity: t.done ? 0.65 : 1,
                  fontSize: '0.88rem',
                }}
              >
                {t.text}
              </span>
              <button
                type="button"
                className="mc-icon-btn"
                aria-label="Remove task"
                onClick={() =>
                  onChange({
                    ...data,
                    tasks: data.tasks.filter((x) => x.id !== t.id),
                  })
                }
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="mc-row" style={{ marginTop: 8 }}>
          <input
            className="mc-input"
            placeholder="New task…"
            value={taskDraft}
            onChange={(e) => setTaskDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              const text = taskDraft.trim()
              if (!text) return
              onChange({
                ...data,
                tasks: [...data.tasks, { id: newId(), text, done: false }],
              })
              setTaskDraft('')
            }}
          />
          <button
            type="button"
            className="mc-btn"
            onClick={() => {
              const text = taskDraft.trim()
              if (!text) return
              onChange({
                ...data,
                tasks: [...data.tasks, { id: newId(), text, done: false }],
              })
              setTaskDraft('')
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div>
        <strong>Planned campaign posts</strong>
        <p
          style={{
            fontSize: '0.76rem',
            margin: '0.35rem 0 0.5rem',
            color: 'var(--text, #666)',
          }}
        >
          Planned posts are saved locally and synced to{' '}
          <code>schedule_entries</code> when the API is configured.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {data.posts.map((post) => (
            <li
              key={post.id}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                marginBottom: 6,
                fontSize: '0.85rem',
              }}
            >
              <span style={{ flex: 1 }}>
                {post.title}
                {post.network ? (
                  <span style={{ color: 'var(--mc-accent)', marginLeft: 6 }}>
                    · {post.network}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                className="mc-icon-btn"
                aria-label="Remove post"
                onClick={() =>
                  onChange({
                    ...data,
                    posts: data.posts.filter((x) => x.id !== post.id),
                  })
                }
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="mc-row" style={{ marginTop: 8 }}>
          <input
            className="mc-input"
            placeholder="Post title / hook"
            value={postTitle}
            onChange={(e) => setPostTitle(e.target.value)}
          />
          <select
            className="mc-input"
            style={{ maxWidth: 130 }}
            value={postNet}
            onChange={(e) =>
              setPostNet(e.target.value as NonNullable<PlannedPost['network']>)
            }
          >
            {NETWORK_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="mc-btn mc-btn--primary"
            onClick={() => {
              const title = postTitle.trim()
              if (!title) return
              onChange({
                ...data,
                posts: [
                  ...data.posts,
                  { id: newId(), title, network: postNet },
                ],
              })
              setPostTitle('')
            }}
          >
            Add
          </button>
        </div>
      </div>

      <p style={{ fontSize: '0.72rem', color: 'var(--text, #888)', margin: 0 }}>
        Day key: {dayKey} · Saved locally; planned posts sync to schedule_entries when API is configured.
      </p>
    </div>
  )
}
