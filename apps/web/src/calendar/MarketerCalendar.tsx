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
import { downloadCSV } from './calendarExport.js'
import {
  listScheduleEntriesByTenant,
  syncPostChanges,
  toValidNetwork,
  updateScheduleEntry,
  type CalendarApiConfig,
} from './calendarApi.js'
import { PostEditModal } from '../PostEditModal.js'

// ── Network config ────────────────────────────────────────────────────────────

const NETWORK_OPTIONS: Array<NonNullable<PlannedPost['network']>> = [
  'instagram', 'facebook', 'x', 'linkedin', 'youtube', 'tiktok', 'email', 'generic',
]

const NETWORK_ABBR: Record<NonNullable<PlannedPost['network']>, string> = {
  instagram: 'IG', facebook: 'FB', x: 'X', linkedin: 'LI',
  youtube: 'YT', tiktok: 'TT', email: '✉', generic: '●',
}

const NETWORK_COLOR: Record<NonNullable<PlannedPost['network']>, string> = {
  instagram: '#E1306C', facebook: '#1877F2', x: '#111111',
  linkedin: '#0A66C2', youtube: '#FF0000', tiktok: '#010101',
  email: '#6B7280', generic: '#8B5CF6',
}

function chipClass(network: PlannedPost['network']): string {
  return `mc-post-chip mc-chip--${network ?? 'none'}`
}

// ── Oversight copy ────────────────────────────────────────────────────────────

function oversightCopy(mode: OversightMode): string {
  switch (mode) {
    case 'hands_off':    return 'Hands-off: move fast with fewer prompts. You can still open any day to tweak copy, tasks, or planned posts.'
    case 'nudges':       return 'Nudges: we highlight open decisions and empty risk areas before you publish.'
    case 'checkpoints':  return 'Checkpoints: explicit confirmations at publish boundaries — best when compliance or brand stakes are high.'
    default:             return ''
  }
}

// ── Stat helpers ──────────────────────────────────────────────────────────────

function countActiveDaysThisMonth(days: CalendarPersisted['days'], anchor: Date): number {
  const y = anchor.getFullYear(), m = anchor.getMonth()
  let n = 0
  for (const [k, dd] of Object.entries(days)) {
    const d = parseDayKey(k as DayKey)
    if (d.getFullYear() !== y || d.getMonth() !== m) continue
    if ((dd.notes?.trim().length ?? 0) > 0 || dd.tasks?.some(t => t.text.trim()) || dd.posts?.some(p => p.title.trim())) n++
  }
  return n
}

function activityStreak(days: CalendarPersisted['days']): number {
  const cur = new Date()
  let streak = 0
  for (let i = 0; i < 400; i++) {
    const k = toDayKey(cur)
    const dd = days[k] ?? defaultDayData()
    if (!dd.notes.trim().length && !dd.tasks.some(t => t.text.trim()) && !dd.posts.some(p => p.title.trim())) break
    streak++
    cur.setDate(cur.getDate() - 1)
  }
  return streak
}

// ── Week helpers ──────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getWeekDays(anchor: Date, weekStartsOn: 0 | 1): Date[] {
  const dow = anchor.getDay()
  const diff = weekStartsOn === 1 ? (dow === 0 ? -6 : 1 - dow) : -dow
  const start = new Date(anchor)
  start.setDate(anchor.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function weekLabel(days: Date[]): string {
  const a = days[0], b = days[6]
  if (a.getMonth() === b.getMonth())
    return `${DAY_NAMES[a.getDay()]} ${a.getDate()} – ${DAY_NAMES[b.getDay()]} ${b.getDate()}, ${a.toLocaleString('default', { month: 'long' })} ${a.getFullYear()}`
  return `${a.toLocaleString('default', { month: 'short' })} ${a.getDate()} – ${b.toLocaleString('default', { month: 'short' })} ${b.getDate()}, ${b.getFullYear()}`
}

// ── Drag ghost ────────────────────────────────────────────────────────────────

function makeDragGhost(post: PlannedPost): HTMLElement {
  const el = document.createElement('div')
  el.className = 'mc-drag-ghost'
  if (post.network) {
    const net = document.createElement('span')
    net.textContent = NETWORK_ABBR[post.network]
    net.style.cssText = `font-size:0.62rem;font-weight:700;opacity:0.9;`
    el.appendChild(net)
  }
  const title = document.createElement('span')
  title.textContent = post.title.length > 28 ? post.title.slice(0, 28) + '…' : post.title
  el.appendChild(title)
  document.body.appendChild(el)
  return el
}

// ── Post chip (month view) ────────────────────────────────────────────────────

function PostChip({
  post,
  onEdit,
  onDragStart,
  onDragEnd,
}: {
  post: PlannedPost
  onEdit: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}) {
  const style: CSSProperties = {}
  if (post.campaignColor) style.borderLeftColor = post.campaignColor

  return (
    <div
      className={chipClass(post.network)}
      style={style}
      draggable
      role="button"
      tabIndex={0}
      aria-label={`Edit post: ${post.title}`}
      onClick={(e) => { e.stopPropagation(); onEdit() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onEdit() } }}
      onDragStart={(e) => { e.stopPropagation(); onDragStart(e) }}
      onDragEnd={onDragEnd}
    >
      {post.status && (
        <span className={`mc-chip-status mc-chip-status--${post.status}`} title={post.status} />
      )}
      {post.network && <span className="mc-chip-net">{NETWORK_ABBR[post.network]}</span>}
      {post.scheduledTime && <span className="mc-chip-time">{post.scheduledTime}</span>}
      <span className="mc-chip-title">
        {post.title.length > 13 ? `${post.title.slice(0, 13)}…` : post.title}
      </span>
    </div>
  )
}

// ── Overflow popover ──────────────────────────────────────────────────────────

function OverflowPopover({
  posts,
  onEdit,
  onClose,
}: {
  posts: PlannedPost[]
  onEdit: (post: PlannedPost) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  return (
    <div ref={ref} className="mc-overflow-popover" onClick={(e) => e.stopPropagation()}>
      {posts.map(post => (
        <button
          key={post.id}
          className="mc-overflow-item"
          onClick={() => { onEdit(post); onClose() }}
        >
          <span
            className="mc-overflow-net"
            style={{ background: post.network ? NETWORK_COLOR[post.network] : '#8B5CF6' }}
          >
            {post.network ? NETWORK_ABBR[post.network] : '●'}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {post.scheduledTime && <span style={{ marginRight: 4, opacity: 0.6, fontSize: '0.7rem' }}>{post.scheduledTime}</span>}
            {post.title}
          </span>
          {post.status && (
            <span className={`mc-status-badge mc-status-badge--${post.status}`}>{post.status}</span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Quick-add popover ─────────────────────────────────────────────────────────

function QuickAddPopover({
  onAdd,
  onClose,
}: {
  onAdd: (title: string, network: PlannedPost['network'], time: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [network, setNetwork] = useState<PlannedPost['network']>('instagram')
  const [time, setTime] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  const submit = () => {
    if (!title.trim()) return
    onAdd(title.trim(), network, time)
    onClose()
  }

  return (
    <div
      ref={ref}
      className="mc-quick-add-popover"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        className="mc-input"
        placeholder="Post title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
        style={{ fontSize: '0.82rem' }}
      />
      <div style={{ display: 'flex', gap: 4 }}>
        <select
          className="mc-input"
          value={network ?? ''}
          onChange={(e) => setNetwork(e.target.value as PlannedPost['network'])}
          style={{ flex: 1, fontSize: '0.78rem' }}
        >
          {NETWORK_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <input
          className="mc-input"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          style={{ width: 84, fontSize: '0.78rem' }}
        />
      </div>
      <button className="mc-btn mc-btn--primary" onClick={submit} style={{ fontSize: '0.78rem' }}>
        Add post
      </button>
    </div>
  )
}

// ── Month day cell ────────────────────────────────────────────────────────────

function DayCell({
  date,
  inMonth,
  dayData,
  onOpen,
  onQuickAdd,
  onEditPost,
  draggedPost,
  onDragStart,
  onDragEnd,
  onDrop,
  focused,
  onFocus,
}: {
  date: Date
  inMonth: boolean
  dayData: DayData
  onOpen: () => void
  onQuickAdd: (title: string, network: PlannedPost['network'], time: string) => void
  onEditPost: (post: PlannedPost) => void
  draggedPost: { post: PlannedPost; fromDayKey: DayKey } | null
  onDragStart: (e: React.DragEvent, post: PlannedPost) => void
  onDragEnd: () => void
  onDrop: (e: React.DragEvent) => void
  focused: boolean
  onFocus: () => void
}) {
  const dayKey = toDayKey(date)
  const posts = dayData.posts.filter(p => p.title.trim())
  const openTasks = dayData.tasks.filter(t => t.text.trim() && !t.done)
  const hasNotes = dayData.notes.trim().length > 0
  const w = date.getDay()
  const weekend = w === 0 || w === 6
  const isDragSource = draggedPost?.fromDayKey === dayKey
  const [dragOver, setDragOver] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const CHIP_LIMIT = 2

  const cls = [
    'mc-day',
    !inMonth ? 'mc-day--muted' : '',
    isToday(date) ? 'mc-day--today' : '',
    weekend ? 'mc-day--weekend mc-day--hl-weekend' : '',
    isDragSource ? 'mc-day--dragging' : '',
    dragOver && draggedPost && !isDragSource ? 'mc-day--drag-over' : '',
  ].filter(Boolean).join(' ')

  return (
    <div style={{ position: 'relative' }}>
      <button
        className={cls}
        tabIndex={focused ? 0 : -1}
        onClick={onOpen}
        onFocus={onFocus}
        onDragOver={(e) => {
          if (!draggedPost) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
        }}
        onDrop={(e) => { setDragOver(false); onDrop(e) }}
      >
        <div className="mc-day-num">{date.getDate()}</div>

        {posts.slice(0, CHIP_LIMIT).map(post => (
          <PostChip
            key={post.id}
            post={post}
            onEdit={() => onEditPost(post)}
            onDragStart={(e) => onDragStart(e, post)}
            onDragEnd={onDragEnd}
          />
        ))}

        {posts.length > CHIP_LIMIT && (
          <div
            className="mc-chip-more"
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); setOverflowOpen(o => !o) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setOverflowOpen(o => !o) } }}
          >
            +{posts.length - CHIP_LIMIT} more
          </div>
        )}

        <div className="mc-day-dots" aria-hidden>
          {hasNotes  && <span className="mc-dot" />}
          {openTasks.length > 0 && <span className="mc-dot mc-dot--task" />}
        </div>

        {/* Quick-add button (visible on hover via CSS) */}
        <button
          type="button"
          className="mc-quick-add"
          aria-label="Quick add post"
          onClick={(e) => { e.stopPropagation(); setShowQuickAdd(true) }}
          title="Quick add post"
        >+</button>
      </button>

      {/* Overflow popover */}
      {overflowOpen && (
        <OverflowPopover
          posts={posts}
          onEdit={onEditPost}
          onClose={() => setOverflowOpen(false)}
        />
      )}

      {/* Quick-add popover */}
      {showQuickAdd && (
        <QuickAddPopover
          onAdd={onQuickAdd}
          onClose={() => setShowQuickAdd(false)}
        />
      )}
    </div>
  )
}

// ── Week view ─────────────────────────────────────────────────────────────────

function WeekView({
  weekDays,
  getDay,
  patchDay,
  onOpenDay,
  onEditPost,
}: {
  weekDays: Date[]
  getDay: (k: DayKey) => DayData
  patchDay: (k: DayKey, d: DayData) => void
  onOpenDay: (k: DayKey) => void
  onEditPost: (post: PlannedPost, dayKey: DayKey) => void
}) {
  const [draggedPost, setDraggedPost] = useState<{ post: PlannedPost; fromDayKey: DayKey } | null>(null)
  const [dragOverDay, setDragOverDay] = useState<DayKey | null>(null)

  const movePost = (fromKey: DayKey, toKey: DayKey, post: PlannedPost) => {
    if (fromKey === toKey) return
    patchDay(fromKey, { ...getDay(fromKey), posts: getDay(fromKey).posts.filter(p => p.id !== post.id) })
    patchDay(toKey, { ...getDay(toKey), posts: [...getDay(toKey).posts, post] })
  }

  return (
    <div className="mc-week-grid">
      {weekDays.map(date => {
        const dayKey = toDayKey(date)
        const dd = getDay(dayKey)
        const posts = dd.posts.filter(p => p.title.trim())
        const isDragOver = dragOverDay === dayKey && !!draggedPost && draggedPost.fromDayKey !== dayKey

        return (
          <div key={dayKey} className="mc-week-col">
            <button
              className={`mc-week-col-header${isToday(date) ? ' mc-week-col-header--today' : ''}`}
              onClick={() => onOpenDay(dayKey)}
            >
              <div className="mc-week-col-day-name">{DAY_NAMES[date.getDay()]}</div>
              <div className="mc-week-col-day-num">{date.getDate()}</div>
            </button>

            <div
              className={`mc-week-col-body${isDragOver ? ' mc-week-col-body--drag-over' : ''}`}
              onDragOver={(e) => { if (!draggedPost) return; e.preventDefault(); setDragOverDay(dayKey) }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDay(null) }}
              onDrop={(e) => {
                e.preventDefault()
                setDragOverDay(null)
                if (draggedPost) { movePost(draggedPost.fromDayKey, dayKey, draggedPost.post); setDraggedPost(null) }
              }}
            >
              {posts.map(post => (
                <div
                  key={post.id}
                  className="mc-week-post-card"
                  draggable
                  style={{
                    background: post.network ? NETWORK_COLOR[post.network] : '#8B5CF6',
                    borderLeft: post.campaignColor ? `4px solid ${post.campaignColor}` : undefined,
                    opacity: draggedPost?.post.id === post.id ? 0.4 : 1,
                  }}
                  onClick={() => onEditPost(post, dayKey)}
                  onDragStart={(e) => {
                    const ghost = makeDragGhost(post)
                    e.dataTransfer.setDragImage(ghost, 0, 0)
                    setTimeout(() => ghost.parentNode?.removeChild(ghost), 0)
                    e.dataTransfer.effectAllowed = 'move'
                    setDraggedPost({ post, fromDayKey: dayKey })
                  }}
                  onDragEnd={() => { setDraggedPost(null); setDragOverDay(null) }}
                >
                  <div className="mc-week-card-net">
                    {post.network && <span>{NETWORK_ABBR[post.network]}</span>}
                    {post.scheduledTime && <span style={{ fontWeight: 400, opacity: 0.8 }}>{post.scheduledTime}</span>}
                    {post.status && (
                      <span className={`mc-chip-status mc-chip-status--${post.status}`} style={{ marginLeft: 'auto' }} />
                    )}
                  </div>
                  <div className="mc-week-card-title">{post.title}</div>
                </div>
              ))}

              {/* Quick-add in week view */}
              <button
                className="mc-week-add-btn"
                onClick={() => onOpenDay(dayKey)}
              >
                + Add
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Day view ──────────────────────────────────────────────────────────────────

function DayViewPanel({
  dayKey,
  dayData,
  onEditPost,
  onOpenDrawer,
}: {
  dayKey: DayKey
  dayData: DayData
  onEditPost: (post: PlannedPost) => void
  onOpenDrawer: () => void
}) {
  const date = parseDayKey(dayKey)
  const posts = dayData.posts.filter(p => p.title.trim())
  const sortedPosts = [...posts].sort((a, b) => (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? ''))

  return (
    <div className="mc-day-view">
      <div className="mc-day-view-header">
        <div className="mc-day-view-title">
          {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        {isToday(date) && <div className="mc-day-view-sub">Today</div>}
      </div>

      <div className="mc-day-view-posts">
        {sortedPosts.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text,#888)', fontSize: '0.85rem', marginTop: '2rem' }}>
            No posts planned. <button className="mc-btn" onClick={onOpenDrawer}>Add one</button>
          </p>
        )}
        {sortedPosts.map(post => (
          <button
            key={post.id}
            className="mc-day-post-card"
            onClick={() => onEditPost(post)}
          >
            <div
              className="mc-day-post-net-badge"
              style={{ background: post.network ? NETWORK_COLOR[post.network] : '#8B5CF6' }}
            >
              {post.network ? NETWORK_ABBR[post.network] : '●'}
            </div>
            <div className="mc-day-post-info">
              <div className="mc-day-post-title">{post.title}</div>
              <div className="mc-day-post-meta">
                {post.scheduledTime && <span>{post.scheduledTime}</span>}
                {post.network && <span style={{ textTransform: 'capitalize' }}>{post.network}</span>}
                {post.status && (
                  <span className={`mc-status-badge mc-status-badge--${post.status}`}>{post.status}</span>
                )}
              </div>
            </div>
          </button>
        ))}

        <button className="mc-btn mc-btn--primary" onClick={onOpenDrawer} style={{ marginTop: 8 }}>
          + Add / edit posts
        </button>
      </div>
    </div>
  )
}

// ── Main calendar ─────────────────────────────────────────────────────────────

export function MarketerCalendar() {
  const [state, setState]   = useState<CalendarPersisted>(loadCalendarState)
  const [anchor, setAnchor] = useState(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1) })
  const [selectedDay, setSelectedDay]   = useState<DayKey | null>(null)
  const [drawerOpen, setDrawerOpen]     = useState(false)
  const [pinDraft, setPinDraft]         = useState('')
  const [pinLinkDay, setPinLinkDay]     = useState(false)
  const [importText, setImportText]     = useState('')
  const [importMsg, setImportMsg]       = useState<string | null>(null)
  const [draggedPost, setDraggedPost]   = useState<{ post: PlannedPost; fromDayKey: DayKey } | null>(null)
  const [editingPost, setEditingPost]   = useState<{ post: PlannedPost; dayKey: DayKey } | null>(null)
  const [focusedDayKey, setFocusedDayKey] = useState<DayKey | null>(null)

  const apiConfig = useMemo<CalendarApiConfig | null>(() => {
    const origin   = import.meta.env.VITE_CAMPAIGN_API_ORIGIN
    const tenantId = import.meta.env.VITE_TENANT_ID
    if (!origin?.trim() || !tenantId?.trim()) return null
    return { apiOrigin: origin.trim().replace(/\/$/, ''), tenantId: tenantId.trim() }
  }, [])

  const apiConfigRef = useRef<CalendarApiConfig | null>(apiConfig)
  apiConfigRef.current = apiConfig
  const stateRef = useRef(state)
  stateRef.current = state

  // API sync on mount
  useEffect(() => {
    if (!apiConfig) return
    listScheduleEntriesByTenant(apiConfig).then(entries => {
      if (!entries.length) return
      setState(s => {
        const days = { ...s.days }
        for (const entry of entries) {
          if (!entry.scheduledAt) continue
          const dayKey = entry.scheduledAt.slice(0, 10)
          const existing = days[dayKey] ?? defaultDayData()
          if (existing.posts.some(p => p.id === entry.scheduleEntryId)) continue
          days[dayKey] = {
            ...existing,
            posts: [...existing.posts, {
              id: entry.scheduleEntryId,
              title: entry.contentSummary ?? entry.scheduleEntryId,
              network: toValidNetwork(entry.network),
              videoOptions: entry.videoOptions ?? null,
              metadata: entry.metadata ?? null,
            }],
          }
        }
        return { ...s, days }
      })
    })
  }, [])

  // Autosave
  useEffect(() => {
    const t = window.setTimeout(() => saveCalendarState(state), 280)
    return () => window.clearTimeout(t)
  }, [state])

  // Drawer animation: open with a tick delay so CSS transition fires
  useEffect(() => {
    if (selectedDay) {
      requestAnimationFrame(() => setDrawerOpen(true))
    } else {
      setDrawerOpen(false)
    }
  }, [selectedDay])

  // Keyboard: Escape closes drawer; arrow keys navigate month grid
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedDay(null); return }

      const viewMode = stateRef.current.preferences.viewMode
      if (viewMode !== 'month') return
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) return

      const active = document.activeElement
      if (active && active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA' && active.tagName !== 'SELECT') {
        e.preventDefault()
        setFocusedDayKey(prev => {
          const base = prev ? parseDayKey(prev) : new Date()
          const next = new Date(base)
          if      (e.key === 'ArrowLeft')  next.setDate(base.getDate() - 1)
          else if (e.key === 'ArrowRight') next.setDate(base.getDate() + 1)
          else if (e.key === 'ArrowUp')    next.setDate(base.getDate() - 7)
          else if (e.key === 'ArrowDown')  next.setDate(base.getDate() + 7)
          else if (e.key === 'Enter' && prev) { setSelectedDay(prev); return prev }
          const k = toDayKey(next)
          // Update anchor if we navigated to a new month
          setAnchor(new Date(next.getFullYear(), next.getMonth(), 1))
          return k
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const p     = state.preferences
  const grid  = useMemo(() => buildMonthGrid(anchor, p.weekStartsOn), [anchor, p.weekStartsOn])
  const rows  = useMemo(() => { const out: (typeof grid)[] = []; for (let r = 0; r < 6; r++) out.push(grid.slice(r * 7, r * 7 + 7)); return out }, [grid])
  const weekDays = useMemo(() => getWeekDays(anchor, p.weekStartsOn), [anchor, p.weekStartsOn])
  const weekdayLabels = useMemo(() => p.weekStartsOn === 1 ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], [p.weekStartsOn])
  const activeDays = useMemo(() => countActiveDaysThisMonth(state.days, anchor), [state.days, anchor])
  const streak     = useMemo(() => activityStreak(state.days), [state.days])

  const setPref = useCallback((partial: Partial<CalendarPreferences>) => {
    setState(s => ({ ...s, preferences: { ...s.preferences, ...partial } }))
  }, [])

  const getDay = useCallback((key: DayKey): DayData => state.days[key] ?? defaultDayData(), [state.days])

  const patchDay = useCallback((key: DayKey, next: DayData) => {
    const cfg = apiConfigRef.current
    if (cfg) {
      const prev = stateRef.current.days[key] ?? defaultDayData()
      syncPostChanges(cfg, key, prev.posts, next.posts)
    }
    setState(s => ({ ...s, days: { ...s.days, [key]: next } }))
  }, [])

  const movePost = useCallback((fromKey: DayKey, toKey: DayKey, post: PlannedPost) => {
    if (fromKey === toKey) return
    const cfg = apiConfigRef.current
    if (cfg) {
      updateScheduleEntry(cfg, post.id, post.title, post.network ?? null, `${toKey}T00:00:00.000Z`).catch(() => {})
    }
    setState(s => {
      const fromDay = s.days[fromKey] ?? defaultDayData()
      const toDay   = s.days[toKey]   ?? defaultDayData()
      return {
        ...s,
        days: {
          ...s.days,
          [fromKey]: { ...fromDay, posts: fromDay.posts.filter(p => p.id !== post.id) },
          [toDay === fromDay ? fromKey : toKey]: { ...toDay, posts: [...toDay.posts, post] },
          [toKey]: { ...toDay, posts: [...toDay.posts, post] },
        },
      }
    })
  }, [])

  const handlePostSaved = useCallback((id: string, newTitle: string, network: PlannedPost['network']) => {
    setState(s => {
      const newDays = { ...s.days }
      for (const dk of Object.keys(newDays)) {
        const day = newDays[dk]
        if (!day) continue
        const idx = day.posts.findIndex(p => p.id === id)
        if (idx !== -1) {
          newDays[dk] = { ...day, posts: day.posts.map(p => p.id === id ? { ...p, title: newTitle, network } : p) }
          break
        }
      }
      return { ...s, days: newDays }
    })
  }, [])

  const handlePostDeleted = useCallback((id: string, dayKey: DayKey) => {
    setState(s => {
      const day = s.days[dayKey]
      if (!day) return s
      return { ...s, days: { ...s.days, [dayKey]: { ...day, posts: day.posts.filter(p => p.id !== id) } } }
    })
  }, [])

  const openDay = useCallback((key: DayKey) => setSelectedDay(key), [])
  const closeDay = useCallback(() => setSelectedDay(null), [])

  const quickAddPost = useCallback((dayKey: DayKey, title: string, network: PlannedPost['network'], time: string) => {
    patchDay(dayKey, {
      ...getDay(dayKey),
      posts: [...getDay(dayKey).posts, {
        id: newId(),
        title,
        network,
        scheduledTime: time || undefined,
        status: 'draft',
      }],
    })
  }, [patchDay, getDay])

  // Nav
  const goPrev = () => {
    if (p.viewMode === 'month') setAnchor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    else if (p.viewMode === 'week') setAnchor(d => { const n = new Date(d); n.setDate(d.getDate() - 7); return n })
    else setAnchor(d => { const n = new Date(d); n.setDate(d.getDate() - 1); return n })
  }
  const goNext = () => {
    if (p.viewMode === 'month') setAnchor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    else if (p.viewMode === 'week') setAnchor(d => { const n = new Date(d); n.setDate(d.getDate() + 7); return n })
    else setAnchor(d => { const n = new Date(d); n.setDate(d.getDate() + 1); return n })
  }
  const goToday = () => {
    const t = new Date()
    setAnchor(new Date(t.getFullYear(), t.getMonth(), 1))
    setSelectedDay(toDayKey(t))
  }

  const addPin = () => {
    const text = pinDraft.trim()
    if (!text) return
    const item: PinItem = { id: newId(), text, createdAt: new Date().toISOString(), dayKey: pinLinkDay && selectedDay ? selectedDay : undefined }
    setState(s => ({ ...s, pins: [item, ...s.pins] }))
    setPinDraft('')
    setPinLinkDay(false)
  }
  const removePin = (id: string) => setState(s => ({ ...s, pins: s.pins.filter(x => x.id !== id) }))

  const [draggedPinId, setDraggedPinId] = useState<string | null>(null)
  const onPinDrop = (targetId: string) => {
    if (!draggedPinId || draggedPinId === targetId) return
    setState(s => {
      const pins = [...s.pins]
      const from = pins.findIndex(x => x.id === draggedPinId)
      const to   = pins.findIndex(x => x.id === targetId)
      if (from < 0 || to < 0) return s
      const [m] = pins.splice(from, 1)
      pins.splice(to, 0, m)
      return { ...s, pins }
    })
    setDraggedPinId(null)
  }

  const onExport    = () => { const blob = new Blob([exportCalendarJson(state)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'marketer-pro-calendar.json'; a.click(); URL.revokeObjectURL(a.href) }
  const onExportCSV = () => downloadCSV(state)
  const onImport    = () => { const next = importCalendarJson(importText); if (!next) { setImportMsg('Could not import — invalid JSON or shape.'); return }; setState(next); setImportMsg('Imported.'); saveCalendarState(next) }
  const onReset     = () => { if (!window.confirm('Reset calendar data on this device? This clears pins and day notes.')) return; const fresh = emptyPersisted(); setState(fresh); saveCalendarState(fresh); setSelectedDay(null) }

  const densityClass = p.density === 'compact' ? 'mc-density-compact' : 'mc-density-comfortable'
  const bgImageStyle = p.bgMode === 'image' && p.imageUrl.trim() ? { backgroundImage: `url(${p.imageUrl.trim()})` } : undefined

  const currentDayKey = p.viewMode === 'day' ? toDayKey(anchor) : null

  return (
    <>
      <div className="mc-root" style={{ ['--mc-accent' as string]: p.accentHex } as CSSProperties}>
        <div className="mc-bg" aria-hidden>
          {p.bgMode === 'gradient' && <div className={`mc-bg--gradient mc-preset-${p.gradientPreset}`} />}
          {p.bgMode === 'image'    && <div className="mc-bg--image" style={bgImageStyle} />}
          <div className="mc-bg-overlay" style={{ opacity: p.bgMode === 'none' ? 0 : p.overlayOpacity }} />
        </div>

        <div className="mc-inner">
          <header className="mc-header">
            <h2 className="mc-title">Content calendar</h2>
            <p className="mc-sub">
              {apiConfig
                ? `Synced to schedule API (tenant: ${apiConfig.tenantId}).`
                : 'Local-first planner — set VITE_CAMPAIGN_API_ORIGIN to enable sync.'}
            </p>

            {/* View mode toggle */}
            <div className="mc-view-toggle">
              {(['month', 'week', 'day'] as const).map(mode => (
                <button
                  key={mode}
                  className={`mc-view-btn${p.viewMode === mode ? ' mc-view-btn--active' : ''}`}
                  onClick={() => setPref({ viewMode: mode })}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            <div className="mc-nav">
              <button type="button" className="mc-btn" onClick={goPrev}>←</button>
              <button type="button" className="mc-btn" onClick={goToday}>Today</button>
              <button type="button" className="mc-btn" onClick={goNext}>→</button>
            </div>
          </header>

          <div className="mc-rhythm">
            <span>
              <strong>
                {p.viewMode === 'month' ? monthLabel(anchor)
                  : p.viewMode === 'week' ? weekLabel(weekDays)
                  : anchor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </strong>
            </span>
            {p.viewMode === 'month' && (
              <>
                <span>Active days: <strong>{activeDays}</strong></span>
                <span>Streak: <strong>{streak}</strong> day{streak === 1 ? '' : 's'}</span>
              </>
            )}
          </div>

          {/* ── Month view ─────────────────────────────────────────────── */}
          {p.viewMode === 'month' && (
            <div className="mc-layout">
              <div className="mc-month-col">
                <div
                  className={`mc-weekdays ${densityClass}`}
                  style={{ display: 'grid', gridTemplateColumns: p.showWeekNumbers ? '36px repeat(7, minmax(0, 1fr))' : 'repeat(7, minmax(0, 1fr))', gap: '2px' }}
                >
                  {p.showWeekNumbers && <span className="mc-week-num" aria-hidden>Wk</span>}
                  {weekdayLabels.map(w => <span key={w}>{w}</span>)}
                </div>

                {rows.map((row, ri) => (
                  <div
                    key={ri}
                    className={`mc-grid ${densityClass}`}
                    style={p.showWeekNumbers ? { gridTemplateColumns: '36px repeat(7, minmax(0, 1fr))' } : undefined}
                  >
                    {p.showWeekNumbers && (
                      <div className="mc-week-num" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem' }}>
                        {isoWeekNumber(row[0].date)}
                      </div>
                    )}
                    {row.map(({ date, inMonth }) => {
                      const dk = toDayKey(date)
                      return (
                        <DayCell
                          key={dk}
                          date={date}
                          inMonth={inMonth}
                          dayData={getDay(dk)}
                          onOpen={() => openDay(dk)}
                          onQuickAdd={(title, network, time) => quickAddPost(dk, title, network, time)}
                          onEditPost={post => setEditingPost({ post, dayKey: dk })}
                          draggedPost={draggedPost}
                          onDragStart={(e, post) => {
                            const ghost = makeDragGhost(post)
                            e.dataTransfer.setDragImage(ghost, 0, 0)
                            setTimeout(() => ghost.parentNode?.removeChild(ghost), 0)
                            e.dataTransfer.effectAllowed = 'move'
                            setDraggedPost({ post, fromDayKey: dk })
                          }}
                          onDragEnd={() => { setDraggedPost(null); setDragOverDay(null) }}
                          onDrop={(e) => {
                            e.preventDefault()
                            setDragOverDay(null)
                            if (draggedPost) { movePost(draggedPost.fromDayKey, dk, draggedPost.post); setDraggedPost(null) }
                          }}
                          focused={focusedDayKey === dk}
                          onFocus={() => setFocusedDayKey(dk)}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Sidebar */}
              <aside className="mc-side">
                <div className="mc-card mc-oversight"><strong>Oversight: </strong>{oversightCopy(p.oversightMode)}</div>

                <details className="mc-card mc-settings" open>
                  <summary>Customize workspace</summary>
                  <div className="mc-settings-grid">
                    <label>Oversight mode<select className="mc-input" value={p.oversightMode} onChange={e => setPref({ oversightMode: e.target.value as OversightMode })}><option value="hands_off">Hands off</option><option value="nudges">Nudges</option><option value="checkpoints">Checkpoints</option></select></label>
                    <label>Week starts on<select className="mc-input" value={p.weekStartsOn} onChange={e => setPref({ weekStartsOn: Number(e.target.value) as 0 | 1 })}><option value={0}>Sunday</option><option value={1}>Monday</option></select></label>
                    <label>Density<select className="mc-input" value={p.density} onChange={e => setPref({ density: e.target.value as 'compact' | 'comfortable' })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
                    <label>Accent color<input className="mc-input" type="color" value={p.accentHex} onChange={e => setPref({ accentHex: e.target.value })} /></label>
                    <label>Background<select className="mc-input" value={p.bgMode} onChange={e => setPref({ bgMode: e.target.value as typeof p.bgMode })}><option value="none">Plain</option><option value="gradient">Gradient</option><option value="image">Image URL</option></select></label>
                    {p.bgMode === 'gradient' && <label>Gradient preset<select className="mc-input" value={p.gradientPreset} onChange={e => setPref({ gradientPreset: e.target.value as typeof p.gradientPreset })}><option value="aurora">Aurora</option><option value="dusk">Dusk</option><option value="mint">Mint</option><option value="ember">Ember</option><option value="noir">Noir</option></select></label>}
                    {p.bgMode === 'image' && <label>Image URL<input className="mc-input" value={p.imageUrl} onChange={e => setPref({ imageUrl: e.target.value })} placeholder="https://…" /></label>}
                    {p.bgMode !== 'none' && <label>Overlay<input className="mc-input" type="range" min={0} max={0.9} step={0.05} value={p.overlayOpacity} onChange={e => setPref({ overlayOpacity: Number(e.target.value) })} /></label>}
                    <label style={{ flexDirection: 'row', alignItems: 'center' }}><input type="checkbox" checked={p.showWeekNumbers} onChange={e => setPref({ showWeekNumbers: e.target.checked })} />&nbsp;ISO week numbers</label>
                    <label style={{ flexDirection: 'row', alignItems: 'center' }}><input type="checkbox" checked={p.highlightWeekends} onChange={e => setPref({ highlightWeekends: e.target.checked })} />&nbsp;Highlight weekends</label>
                    <div className="mc-row">
                      <button type="button" className="mc-btn" onClick={onExport}>Export JSON</button>
                      <button type="button" className="mc-btn mc-btn--primary" onClick={onExportCSV} title="Opens in Excel & Google Sheets">Export CSV</button>
                      <button type="button" className="mc-btn" onClick={onReset}>Reset</button>
                    </div>
                    <label>Import JSON<textarea className="mc-textarea" rows={3} value={importText} onChange={e => setImportText(e.target.value)} spellCheck={false} /></label>
                    <div className="mc-row">
                      <button type="button" className="mc-btn mc-btn--primary" onClick={onImport}>Import</button>
                      {importMsg && <span style={{ fontSize: '0.78rem' }}>{importMsg}</span>}
                    </div>
                  </div>
                </details>

                <div className="mc-card">
                  <h3>Pinned list</h3>
                  <p style={{ fontSize: '0.78rem', margin: '0 0 0.5rem', color: 'var(--text, #666)' }}>Drag to reorder.</p>
                  {state.pins.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', margin: 0 }}>No pins yet.</p>
                  ) : state.pins.map(pin => (
                    <div key={pin.id} className="mc-pin" draggable onDragStart={() => setDraggedPinId(pin.id)} onDragEnd={() => setDraggedPinId(null)} onDragOver={e => e.preventDefault()} onDrop={() => onPinDrop(pin.id)}>
                      <span aria-hidden>⋮⋮</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.86rem' }}>{pin.text}</div>
                        {pin.dayKey && <div style={{ fontSize: '0.72rem', color: 'var(--mc-accent)', marginTop: 2 }}>Linked: {pin.dayKey}</div>}
                      </div>
                      <button type="button" className="mc-icon-btn" aria-label="Remove pin" onClick={() => removePin(pin.id)}>✕</button>
                    </div>
                  ))}
                  <div style={{ marginTop: '0.6rem' }}>
                    <textarea className="mc-textarea" rows={2} placeholder="New pin…" value={pinDraft} onChange={e => setPinDraft(e.target.value)} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: '0.78rem' }}>
                      <input type="checkbox" checked={pinLinkDay} onChange={e => setPinLinkDay(e.target.checked)} disabled={!selectedDay} />
                      Link to selected day {selectedDay ? `(${selectedDay})` : ''}
                    </label>
                    <button type="button" className="mc-btn mc-btn--primary" style={{ marginTop: 8 }} onClick={addPin}>Add pin</button>
                  </div>
                </div>
              </aside>
            </div>
          )}

          {/* ── Week view ────────────────────────────────────────────────── */}
          {p.viewMode === 'week' && (
            <WeekView
              weekDays={weekDays}
              getDay={getDay}
              patchDay={patchDay}
              onOpenDay={openDay}
              onEditPost={(post, dayKey) => setEditingPost({ post, dayKey })}
            />
          )}

          {/* ── Day view ─────────────────────────────────────────────────── */}
          {p.viewMode === 'day' && currentDayKey && (
            <DayViewPanel
              dayKey={currentDayKey}
              dayData={getDay(currentDayKey)}
              onEditPost={post => setEditingPost({ post, dayKey: currentDayKey })}
              onOpenDrawer={() => openDay(currentDayKey)}
            />
          )}
        </div>

        {/* ── Animated day drawer ──────────────────────────────────────── */}
        {selectedDay !== null && (
          <button type="button" className="mc-drawer-backdrop" aria-label="Close day panel" onClick={closeDay} />
        )}
        <aside
          className={`mc-drawer${drawerOpen ? ' mc-drawer--open' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-hidden={selectedDay === null}
        >
          {selectedDay && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>
                  {parseDayKey(selectedDay).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}
                </h2>
                <button type="button" className="mc-btn" onClick={closeDay}>Close</button>
              </div>
              <DayEditor
                dayKey={selectedDay}
                data={getDay(selectedDay)}
                onChange={next => patchDay(selectedDay, next)}
              />
            </>
          )}
        </aside>
      </div>

      {/* Post edit modal */}
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

// ── Day editor (drawer content) ───────────────────────────────────────────────

function DayEditor({ dayKey, data, onChange }: { dayKey: DayKey; data: DayData; onChange: (d: DayData) => void }) {
  const [postTitle, setPostTitle] = useState('')
  const [postNet, setPostNet]     = useState<NonNullable<PlannedPost['network']>>('instagram')
  const [postTime, setPostTime]   = useState('')
  const [taskDraft, setTaskDraft] = useState('')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <label>
        <strong>Day notes</strong>
        <textarea className="mc-textarea" style={{ marginTop: 6 }} rows={4} value={data.notes} onChange={e => onChange({ ...data, notes: e.target.value })} placeholder="Ideas, voice prompt transcript, links…" />
      </label>

      <div>
        <strong>Tasks</strong>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
          {data.tasks.map(t => (
            <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <input type="checkbox" checked={t.done} onChange={() => onChange({ ...data, tasks: data.tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x) })} />
              <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : undefined, opacity: t.done ? 0.65 : 1, fontSize: '0.88rem' }}>{t.text}</span>
              <button type="button" className="mc-icon-btn" aria-label="Remove task" onClick={() => onChange({ ...data, tasks: data.tasks.filter(x => x.id !== t.id) })}>✕</button>
            </li>
          ))}
        </ul>
        <div className="mc-row" style={{ marginTop: 8 }}>
          <input
            className="mc-input"
            placeholder="New task…"
            value={taskDraft}
            onChange={e => setTaskDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              const text = taskDraft.trim()
              if (!text) return
              onChange({ ...data, tasks: [...data.tasks, { id: newId(), text, done: false }] })
              setTaskDraft('')
            }}
          />
          <button type="button" className="mc-btn" onClick={() => { const text = taskDraft.trim(); if (!text) return; onChange({ ...data, tasks: [...data.tasks, { id: newId(), text, done: false }] }); setTaskDraft('') }}>Add</button>
        </div>
      </div>

      <div>
        <strong>Planned posts</strong>
        <p style={{ fontSize: '0.76rem', margin: '0.35rem 0 0.5rem', color: 'var(--text, #666)' }}>Click a post to edit content, metadata, and video options.</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {data.posts.map(post => (
            <li key={post.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: '0.85rem' }}>
              <span
                style={{ width: 24, height: 24, borderRadius: 6, background: post.network ? NETWORK_COLOR[post.network] : '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.6rem', fontWeight: 700, flexShrink: 0 }}
              >
                {post.network ? NETWORK_ABBR[post.network] : '●'}
              </span>
              <span style={{ flex: 1 }}>
                {post.title}
                {post.scheduledTime && <span style={{ color: 'var(--mc-accent)', marginLeft: 6, fontSize: '0.78rem' }}>{post.scheduledTime}</span>}
              </span>
              {post.status && <span className={`mc-status-badge mc-status-badge--${post.status}`}>{post.status}</span>}
              <button type="button" className="mc-icon-btn" aria-label="Remove post" onClick={() => onChange({ ...data, posts: data.posts.filter(x => x.id !== post.id) })}>✕</button>
            </li>
          ))}
        </ul>
        <div className="mc-row" style={{ marginTop: 8 }}>
          <input className="mc-input" placeholder="Post title / hook" value={postTitle} onChange={e => setPostTitle(e.target.value)} style={{ flex: 2 }} />
          <select className="mc-input" style={{ maxWidth: 110 }} value={postNet} onChange={e => setPostNet(e.target.value as NonNullable<PlannedPost['network']>)}>
            {NETWORK_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <input className="mc-input" type="time" value={postTime} onChange={e => setPostTime(e.target.value)} style={{ width: 90 }} title="Schedule time" />
          <button
            type="button"
            className="mc-btn mc-btn--primary"
            onClick={() => {
              const title = postTitle.trim()
              if (!title) return
              onChange({ ...data, posts: [...data.posts, { id: newId(), title, network: postNet, scheduledTime: postTime || undefined, status: 'draft' }] })
              setPostTitle('')
              setPostTime('')
            }}
          >
            Add
          </button>
        </div>
      </div>

      <p style={{ fontSize: '0.72rem', color: 'var(--text, #888)', margin: 0 }}>Day: {dayKey}</p>
    </div>
  )
}
