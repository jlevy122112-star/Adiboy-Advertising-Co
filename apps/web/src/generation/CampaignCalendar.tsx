/**
 * CampaignCalendar — full-screen drag-and-drop 30-day campaign calendar
 * with integrated task manager sidebar and detail/info slide panels.
 */

import { useState, useCallback, useRef, useMemo } from 'react'
import type { ScheduledPost, Platform, AssetSpec, SeoStrategy } from './CampaignOrchestrator'
import { PLATFORM_META, ASSET_TYPE_ICONS } from './CampaignOrchestrator'
import { useBrandTheme } from '../BrandThemePanel'
import './campaign-calendar.css'

/* ── constants ── */

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const PLATFORM_PEAK_DOWS: Record<Platform, number[]> = {
  facebook:  [1, 3, 4],
  instagram: [1, 3, 5],
  linkedin:  [2, 3, 4],
  youtube:   [2, 4, 6],
}

type PlatformFilter = 'all' | Platform
type DragTarget = number | 'palette' | null
type InfoTab = 'assets' | 'seo' | 'copy'

/* ── props ── */

interface CampaignCalendarProps {
  posts: ScheduledPost[]
  platforms: Platform[]
  campaignName: string
  totalAssets: number
  assets: AssetSpec[]
  seo: SeoStrategy
  adCopy: Array<{ platform: Platform; headline: string; body: string; cta: string }>
  onPostsChange: (posts: ScheduledPost[]) => void
  onLaunch: () => void
  launching: boolean
  launched: boolean
  onSwitchStrategy: () => void
  onNewCampaign: () => void
  variantId: 'A' | 'B'
  strategyName: string
  startDate?: Date
}

/* ── helpers ── */

function formatDateRange(start: Date): string {
  const end = new Date(start)
  end.setDate(end.getDate() + 29)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

function getDayDate(start: Date, dayIndex: number): Date {
  const d = new Date(start)
  d.setDate(d.getDate() + dayIndex)
  return d
}

function formatDayDate(start: Date, dayIndex: number): string {
  return getDayDate(start, dayIndex).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function isPeakDow(platform: Platform, dow: number): boolean {
  return PLATFORM_PEAK_DOWS[platform].includes(dow)
}

function getPeakColor(platform: Platform): string {
  return PLATFORM_META[platform].color
}

function peakScoreForDay(platforms: Platform[], dow: number): Platform[] {
  return platforms.filter(p => PLATFORM_PEAK_DOWS[p].includes(dow))
}

/* ── sub-components ── */

interface TaskCardProps {
  post: ScheduledPost
  start: Date
  isSelected: boolean
  onClick: () => void
  onRemove: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}

function TaskCard({ post, start, isSelected, onClick, onRemove, onDragStart, onDragEnd }: TaskCardProps) {
  const m = PLATFORM_META[post.platform]
  const isScheduled = post.dayIndex !== null

  let peakLabel: string | null = null
  if (isScheduled && post.dayIndex !== null) {
    const d = getDayDate(start, post.dayIndex)
    const dow = d.getDay()
    if (isPeakDow(post.platform, dow)) {
      peakLabel = post.peakScore === 'peak' ? '🔥 Peak' : '⭐ Good'
    }
  }

  const scheduledLabel = isScheduled && post.dayIndex !== null
    ? formatDayDate(start, post.dayIndex) + ' · ' + post.time
    : null

  return (
    <div
      className={[
        'cc-task-card',
        isSelected ? 'cc-task-card--selected' : '',
        isScheduled ? 'cc-task-card--scheduled' : '',
      ].filter(Boolean).join(' ')}
      style={{ '--task-color': m.color } as React.CSSProperties}
      onClick={onClick}
    >
      <div
        className="cc-task-drag-handle"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={e => e.stopPropagation()}
      >
        ⠿
      </div>
      <span className="cc-task-icon">{ASSET_TYPE_ICONS[post.assetType]}</span>
      <div className="cc-task-info">
        <div className="cc-task-label">{post.label}</div>
        <div className="cc-task-meta">
          <span className="cc-task-platform-name" style={{ color: m.color }}>{m.label}</span>
          {scheduledLabel ? (
            <> · <span>{scheduledLabel}</span></>
          ) : (
            <> · <span className="cc-task-unscheduled">Drag to schedule</span></>
          )}
        </div>
        {peakLabel && (
          <div className="cc-task-peak-badge" style={{ color: m.color }}>
            {peakLabel}
          </div>
        )}
      </div>
      {isScheduled && (
        <button
          type="button"
          className="cc-task-remove"
          title="Unschedule"
          onClick={e => { e.stopPropagation(); onRemove() }}
        >
          ✕
        </button>
      )}
    </div>
  )
}

interface CalendarPillProps {
  post: ScheduledPost
  isSelected: boolean
  onClick: () => void
  onRemove: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}

function CalendarPill({ post, isSelected, onClick, onRemove, onDragStart, onDragEnd }: CalendarPillProps) {
  const m = PLATFORM_META[post.platform]
  return (
    <div
      className={`cc-pill${isSelected ? ' cc-pill--selected' : ''}`}
      style={{ '--pill-color': m.color } as React.CSSProperties}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <span className="cc-pill-icon">{ASSET_TYPE_ICONS[post.assetType]}</span>
      <span className="cc-pill-text">{post.label}</span>
      <button
        type="button"
        className="cc-pill-x"
        title="Remove from day"
        onClick={e => { e.stopPropagation(); onRemove() }}
      >
        ✕
      </button>
    </div>
  )
}

interface PostDetailPanelProps {
  post: ScheduledPost
  start: Date
  adCopy: Array<{ platform: Platform; headline: string; body: string; cta: string }>
  onClose: () => void
  onUnschedule: () => void
}

function PostDetailPanel({ post, start, adCopy, onClose, onUnschedule }: PostDetailPanelProps) {
  const m = PLATFORM_META[post.platform]

  const dateStr = post.dayIndex !== null
    ? getDayDate(start, post.dayIndex).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : 'Unscheduled'

  const peakStatus = post.dayIndex !== null
    ? (() => {
        const dow = getDayDate(start, post.dayIndex).getDay()
        return isPeakDow(post.platform, dow)
          ? post.peakScore === 'peak' ? 'Peak Traffic' : 'High Traffic'
          : 'Standard'
      })()
    : '—'

  const copy = adCopy.find(c => c.platform === post.platform)

  return (
    <div className="cc-detail-panel">
      <div className="cc-detail-header" style={{ background: m.color }}>
        <span className="cc-detail-platform-label">{m.icon} {m.label}</span>
        <button type="button" className="cc-detail-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="cc-detail-body">
        <div className="cc-detail-icon">{ASSET_TYPE_ICONS[post.assetType]}</div>
        <div className="cc-detail-label">{post.label}</div>

        <div className="cc-detail-rows">
          <div className="cc-detail-row">
            <span className="cc-detail-key">Date</span>
            <span className="cc-detail-val">{dateStr}</span>
          </div>
          <div className="cc-detail-row">
            <span className="cc-detail-key">Time</span>
            <span className="cc-detail-val">{post.time}</span>
          </div>
          <div className="cc-detail-row">
            <span className="cc-detail-key">Content Type</span>
            <span className="cc-detail-val">{post.assetType.replace(/_/g, ' ')}</span>
          </div>
          <div className="cc-detail-row">
            <span className="cc-detail-key">Traffic</span>
            <span className="cc-detail-val">{peakStatus}</span>
          </div>
        </div>

        {post.dayIndex !== null && post.peakScore === 'peak' && (
          <div className="cc-detail-peak-badge">
            🔥 Peak traffic day for {m.label}
          </div>
        )}

        {copy && (
          <div className="cc-detail-copy-section">
            <div className="cc-detail-copy-label">Ad Copy</div>
            <div className="cc-detail-copy-headline">{copy.headline}</div>
            <div className="cc-detail-copy-body">{copy.body}</div>
            <span className="cc-detail-cta-pill" style={{ background: m.color }}>{copy.cta}</span>
          </div>
        )}

        {post.dayIndex !== null && (
          <button type="button" className="cc-detail-remove-btn" onClick={onUnschedule}>
            Unschedule
          </button>
        )}
      </div>
    </div>
  )
}

interface InfoPanelProps {
  tab: InfoTab
  assets: AssetSpec[]
  seo: SeoStrategy
  adCopy: Array<{ platform: Platform; headline: string; body: string; cta: string }>
  platforms: Platform[]
  onClose: () => void
}

function InfoPanel({ tab, assets, seo, adCopy, platforms, onClose }: InfoPanelProps) {
  const titles: Record<InfoTab, string> = {
    assets: 'Campaign Assets',
    seo: 'SEO Strategy',
    copy: 'Ad Copy',
  }

  return (
    <div className="cc-info-panel">
      <div className="cc-info-panel-header">
        <span className="cc-info-panel-title">{titles[tab]}</span>
        <button type="button" className="cc-info-panel-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="cc-info-panel-body">
        {tab === 'assets' && (
          <>
            {platforms.map(platform => {
              const m = PLATFORM_META[platform]
              const platformAssets = assets.filter(a => a.platform === platform && a.enabled)
              if (!platformAssets.length) return null
              return (
                <div key={platform} className="cc-info-asset-group">
                  <div
                    className="cc-info-asset-group-header"
                    style={{ '--platform-color': m.color } as React.CSSProperties}
                  >
                    <span className="cc-info-asset-group-icon" style={{ background: m.color }}>{m.icon}</span>
                    <span className="cc-info-asset-group-name">{m.label}</span>
                  </div>
                  {platformAssets.map(asset => (
                    <div key={asset.id} className="cc-info-asset-item">
                      <span className="cc-info-asset-icon">{ASSET_TYPE_ICONS[asset.type]}</span>
                      <div className="cc-info-asset-info">
                        <div className="cc-info-asset-label">{asset.label}</div>
                        <div className="cc-info-asset-dims">{asset.dims}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </>
        )}

        {tab === 'seo' && (
          <>
            <div className="cc-info-seo-section">
              <div className="cc-info-seo-label">Focus Keywords</div>
              <div className="cc-info-seo-chips">
                {seo.focusKeywords.map(kw => (
                  <span key={kw} className="cc-info-seo-chip">{kw}</span>
                ))}
              </div>
            </div>

            <div className="cc-info-seo-section">
              <div className="cc-info-seo-label">Hashtags by Platform</div>
              {Object.entries(seo.hashtagsByPlatform).map(([platform, tags]) => {
                const m = PLATFORM_META[platform as Platform]
                return (
                  <div key={platform} style={{ marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: m.color, marginBottom: '0.25rem' }}>
                      {m.icon} {m.label}
                    </div>
                    <div className="cc-info-seo-chips">
                      {(tags ?? []).slice(0, 8).map(tag => (
                        <span key={tag} className="cc-info-seo-chip cc-info-seo-hashtag">#{tag}</span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="cc-info-seo-section">
              <div className="cc-info-seo-label">Blog Outline</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-h)', marginBottom: '0.375rem' }}>
                {seo.blogPostTitle}
              </div>
              <ol className="cc-info-seo-outline">
                {seo.blogPostOutline.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            </div>
          </>
        )}

        {tab === 'copy' && (
          <>
            {adCopy.map((copy, i) => {
              const m = PLATFORM_META[copy.platform]
              return (
                <div
                  key={i}
                  className="cc-info-copy-card"
                  style={{ '--copy-color': m.color } as React.CSSProperties}
                >
                  <div className="cc-info-copy-platform">
                    <span className="cc-info-copy-platform-dot" style={{ background: m.color }}>{m.icon}</span>
                    <span className="cc-info-copy-platform-name">{m.label}</span>
                  </div>
                  <div className="cc-info-copy-headline">{copy.headline}</div>
                  <div className="cc-info-copy-body">{copy.body}</div>
                  <span className="cc-info-copy-cta" style={{ background: m.color }}>{copy.cta}</span>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

/* ── main component ── */

export function CampaignCalendar({
  posts,
  platforms,
  campaignName,
  totalAssets,
  assets,
  seo,
  adCopy,
  onPostsChange,
  onLaunch,
  launching,
  launched,
  onSwitchStrategy,
  onNewCampaign,
  startDate,
}: CampaignCalendarProps) {
  const { theme } = useBrandTheme()
  const { primaryHex, displayName, logoUrl } = theme
  const brandColor = primaryHex ?? 'var(--accent)'

  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [dragOverTarget, setDragOverTarget] = useState<DragTarget>(null)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeInfoTab, setActiveInfoTab] = useState<InfoTab | null>(null)

  const dragRef = useRef<{ postId: string; fromDay: number | null } | null>(null)

  /* ── calendar math ── */

  const start = useMemo(() => {
    const d = new Date(startDate ?? new Date())
    d.setHours(0, 0, 0, 0)
    return d
  }, [startDate])

  const startDow = start.getDay()
  const totalCells = Math.ceil((startDow + 30) / 7) * 7

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  /* ── filtered posts ── */

  const visiblePosts = useMemo(() => {
    if (platformFilter === 'all') return posts
    return posts.filter(p => p.platform === platformFilter)
  }, [posts, platformFilter])

  const unscheduledPosts = useMemo(
    () => visiblePosts.filter(p => p.dayIndex === null),
    [visiblePosts],
  )

  const scheduledPosts = useMemo(
    () => visiblePosts.filter(p => p.dayIndex !== null),
    [visiblePosts],
  )

  const scheduledByPlatform = useMemo(() => {
    const map = new Map<Platform, ScheduledPost[]>()
    for (const platform of platforms) {
      const list = scheduledPosts.filter(p => p.platform === platform)
      if (list.length) map.set(platform, list)
    }
    return map
  }, [scheduledPosts, platforms])

  const totalScheduled = posts.filter(p => p.dayIndex !== null).length
  const totalUnplaced = posts.filter(p => p.dayIndex === null).length

  const selectedPost = useMemo(
    () => posts.find(p => p.id === selectedPostId) ?? null,
    [posts, selectedPostId],
  )

  /* ── drag handlers ── */

  const handleDragStart = useCallback((
    e: React.DragEvent,
    postId: string,
    fromDay: number | null,
  ) => {
    dragRef.current = { postId, fromDay }
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, target: DragTarget) => {
    e.preventDefault()
    setDragOverTarget(target)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverTarget(null)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, toDayIndex: number | null) => {
    e.preventDefault()
    setDragOverTarget(null)
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null

    const newPosts = posts.map(p =>
      p.id === drag.postId ? { ...p, dayIndex: toDayIndex } : p,
    )
    onPostsChange(newPosts)
  }, [posts, onPostsChange])

  const handlePaletteDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOverTarget(null)
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null

    const newPosts = posts.map(p =>
      p.id === drag.postId ? { ...p, dayIndex: null } : p,
    )
    onPostsChange(newPosts)
  }, [posts, onPostsChange])

  const handleDragEnd = useCallback(() => {
    dragRef.current = null
    setDragOverTarget(null)
  }, [])

  const handleUnschedule = useCallback((postId: string) => {
    const newPosts = posts.map(p =>
      p.id === postId ? { ...p, dayIndex: null } : p,
    )
    onPostsChange(newPosts)
    setSelectedPostId(null)
  }, [posts, onPostsChange])

  /* ── topbar ── */

  const rangeLabel = formatDateRange(start)

  /* ── month label ── */

  const monthLabel = useMemo(() => {
    const end = new Date(start)
    end.setDate(end.getDate() + 29)
    const startMonth = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const endMonth = end.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    return startMonth === endMonth ? startMonth : `${startMonth} – ${endMonth}`
  }, [start])

  /* ── render ── */

  return (
    <div
      className="cc-root"
      style={{ '--cc-brand-color': brandColor } as React.CSSProperties}
    >
      {/* ── topbar ── */}
      <header className="cc-topbar">
        <div className="cc-topbar-left">
          <button
            type="button"
            className="cc-sidebar-toggle"
            onClick={() => setSidebarCollapsed(c => !c)}
          >
            {sidebarCollapsed ? '▶ Tasks' : '◀ Tasks'}
          </button>

          {logoUrl && (
            <img
              src={logoUrl}
              alt={displayName ?? ''}
              style={{ height: 28, objectFit: 'contain', borderRadius: 4 }}
            />
          )}

          <div className="cc-campaign-name">
            <span className="cc-campaign-label">Campaign</span>
            <span className="cc-campaign-title" title={campaignName}>{campaignName}</span>
          </div>

          <span className="cc-range-label">{rangeLabel}</span>
        </div>

        <div className="cc-topbar-center">
          <div className="cc-platform-filters">
            <button
              type="button"
              className={`cc-filter-btn${platformFilter === 'all' ? ' cc-filter-btn--active' : ''}`}
              onClick={() => setPlatformFilter('all')}
            >
              All
            </button>
            {platforms.map(p => {
              const m = PLATFORM_META[p]
              return (
                <button
                  key={p}
                  type="button"
                  className={`cc-filter-btn${platformFilter === p ? ' cc-filter-btn--active' : ''}`}
                  style={
                    platformFilter === p
                      ? { background: m.color, borderColor: m.color }
                      : {}
                  }
                  onClick={() => setPlatformFilter(platformFilter === p ? 'all' : p)}
                >
                  <span
                    className="cc-filter-dot"
                    style={{ background: platformFilter === p ? '#fff' : m.color }}
                  />
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="cc-topbar-right">
          <div className="cc-info-btns">
            {(['assets', 'seo', 'copy'] as InfoTab[]).map(tab => (
              <button
                key={tab}
                type="button"
                className={`cc-info-btn${activeInfoTab === tab ? ' cc-info-btn--active' : ''}`}
                onClick={() => {
                  setActiveInfoTab(prev => prev === tab ? null : tab)
                  setSelectedPostId(null)
                }}
              >
                {tab === 'assets' ? 'Assets' : tab === 'seo' ? 'SEO' : 'Ad Copy'}
              </button>
            ))}
          </div>

          <span className="cc-topbar-stat">{totalScheduled} scheduled</span>

          <button type="button" className="cc-switch-btn" onClick={onSwitchStrategy}>
            ↔ Switch Strategy
          </button>
        </div>
      </header>

      {/* ── body ── */}
      <div className="cc-body">

        {/* ── sidebar ── */}
        <aside className={`cc-sidebar${sidebarCollapsed ? ' cc-sidebar--collapsed' : ''}`}>
          {sidebarCollapsed ? (
            <div className="cc-sidebar-collapsed-content">
              {platforms.map(p => {
                const m = PLATFORM_META[p]
                const count = scheduledByPlatform.get(p)?.length ?? 0
                return (
                  <div
                    key={p}
                    className="cc-sidebar-mini-badge"
                    style={{ background: m.color }}
                    title={`${m.label}: ${count} scheduled`}
                  >
                    {m.icon}
                  </div>
                )
              })}
            </div>
          ) : (
            <>
              <div className="cc-sidebar-header">
                <span className="cc-sidebar-title">Task Manager</span>
                <span className="cc-sidebar-count">{totalUnplaced} to schedule</span>
              </div>

              {/* unscheduled drop palette */}
              <div
                className={`cc-palette${dragOverTarget === 'palette' ? ' cc-palette--dragover' : ''}`}
                onDragOver={e => handleDragOver(e, 'palette')}
                onDragLeave={handleDragLeave}
                onDrop={handlePaletteDrop}
              >
                {unscheduledPosts.length === 0 ? (
                  <div className="cc-palette-empty">
                    <span>☁</span>
                    <span>Drag scheduled posts here to unschedule</span>
                  </div>
                ) : (
                  <div className="cc-task-list">
                    {unscheduledPosts.map(post => (
                      <TaskCard
                        key={post.id}
                        post={post}
                        start={start}
                        isSelected={selectedPostId === post.id}
                        onClick={() => setSelectedPostId(prev => prev === post.id ? null : post.id)}
                        onRemove={() => handleUnschedule(post.id)}
                        onDragStart={e => handleDragStart(e, post.id, null)}
                        onDragEnd={handleDragEnd}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* scheduled section */}
              {scheduledByPlatform.size > 0 && (
                <div className="cc-sidebar-scheduled">
                  <div className="cc-sidebar-section-label">Scheduled</div>
                  {platforms.map(platform => {
                    const platformScheduled = scheduledByPlatform.get(platform)
                    if (!platformScheduled?.length) return null
                    const m = PLATFORM_META[platform]
                    return (
                      <div
                        key={platform}
                        className="cc-sidebar-platform-group"
                      >
                        <div
                          className="cc-sidebar-platform-header"
                          style={{ '--platform-color': m.color } as React.CSSProperties}
                        >
                          <div
                            className="cc-sidebar-platform-dot"
                            style={{ background: m.color }}
                          >
                            {m.icon}
                          </div>
                          <span className="cc-sidebar-platform-name">{m.label}</span>
                          <span className="cc-sidebar-platform-count">({platformScheduled.length})</span>
                        </div>
                        <div className="cc-task-list">
                          {platformScheduled.map(post => (
                            <TaskCard
                              key={post.id}
                              post={post}
                              start={start}
                              isSelected={selectedPostId === post.id}
                              onClick={() => setSelectedPostId(prev => prev === post.id ? null : post.id)}
                              onRemove={() => handleUnschedule(post.id)}
                              onDragStart={e => handleDragStart(e, post.id, post.dayIndex)}
                              onDragEnd={handleDragEnd}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </aside>

        {/* ── calendar area ── */}
        <div className="cc-calendar-area">
          <div className="cc-month-header">
            <div className="cc-month-label">{monthLabel}</div>
            <div className="cc-dow-headers">
              {DOW_LABELS.map(d => (
                <div key={d} className="cc-dow-header">{d}</div>
              ))}
            </div>
          </div>

          <div className="cc-grid">
            {Array.from({ length: totalCells }, (_, cellIndex) => {
              const dayOffset = cellIndex - startDow
              const inRange = dayOffset >= 0 && dayOffset < 30

              if (!inRange) {
                return (
                  <div key={cellIndex} className="cc-cell cc-cell--out" />
                )
              }

              const dayDate = getDayDate(start, dayOffset)
              const dow = dayDate.getDay()
              const isToday = dayDate.getTime() === today.getTime()
              const isWeekend = dow === 0 || dow === 6
              const peakPlatforms = peakScoreForDay(platforms, dow)
              const isPeakDay = peakPlatforms.length > 0
              const isDragOver = dragOverTarget === dayOffset

              const dayPosts = visiblePosts.filter(p => p.dayIndex === dayOffset)

              const cellClasses = [
                'cc-cell',
                !inRange ? 'cc-cell--out' : '',
                isWeekend && !isToday ? 'cc-cell--weekend' : '',
                isToday ? 'cc-cell--today' : '',
                isPeakDay && !isToday ? 'cc-cell--peak' : '',
                isDragOver ? 'cc-cell--dragover' : '',
              ].filter(Boolean).join(' ')

              const peakColor = peakPlatforms[0]
                ? getPeakColor(peakPlatforms[0])
                : 'var(--accent)'

              return (
                <div
                  key={cellIndex}
                  className={cellClasses}
                  style={isPeakDay ? { '--peak-color': peakColor } as React.CSSProperties : undefined}
                  onDragOver={e => handleDragOver(e, dayOffset)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, dayOffset)}
                >
                  <div className="cc-cell-head">
                    {isToday ? (
                      <span
                        className="cc-day-num cc-day-num--today"
                        style={{ background: brandColor }}
                      >
                        {dayDate.getDate()}
                      </span>
                    ) : (
                      <span className="cc-day-num">{dayDate.getDate()}</span>
                    )}
                    {peakPlatforms.length > 0 && (
                      <div className="cc-peak-row">
                        {peakPlatforms.map(p => (
                          <div
                            key={p}
                            className="cc-peak-dot"
                            style={{ background: getPeakColor(p) }}
                            title={`${PLATFORM_META[p].label} peak`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="cc-cell-posts">
                    {dayPosts.map(post => (
                      <CalendarPill
                        key={post.id}
                        post={post}
                        isSelected={selectedPostId === post.id}
                        onClick={() => {
                          setSelectedPostId(prev => prev === post.id ? null : post.id)
                          setActiveInfoTab(null)
                        }}
                        onRemove={() => handleUnschedule(post.id)}
                        onDragStart={e => handleDragStart(e, post.id, dayOffset)}
                        onDragEnd={handleDragEnd}
                      />
                    ))}
                  </div>

                  {isDragOver && (
                    <div className="cc-drop-overlay">
                      <span className="cc-drop-label">Drop here</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── right panels ── */}
        {selectedPost && (
          <PostDetailPanel
            post={selectedPost}
            start={start}
            adCopy={adCopy}
            onClose={() => setSelectedPostId(null)}
            onUnschedule={() => handleUnschedule(selectedPost.id)}
          />
        )}

        {!selectedPost && activeInfoTab && (
          <InfoPanel
            tab={activeInfoTab}
            assets={assets}
            seo={seo}
            adCopy={adCopy}
            platforms={platforms}
            onClose={() => setActiveInfoTab(null)}
          />
        )}
      </div>

      {/* ── launch bar ── */}
      <footer className="cc-launch-bar" style={{ borderTopColor: brandColor }}>
        {launched ? (
          <div className="cc-launched">
            <span className="cc-launched-check">✓</span>
            Campaign launched! Your autonomous agent is generating and scheduling everything.
          </div>
        ) : (
          <>
            <div className="cc-launch-meta">
              <div className="cc-launch-stats">
                <span className="cc-lstat"><strong>{totalScheduled}</strong> scheduled</span>
                <span className="cc-lstat-div">·</span>
                <span className="cc-lstat"><strong>{totalUnplaced}</strong> unplaced</span>
                <span className="cc-lstat-div">·</span>
                <span className="cc-lstat"><strong>{totalAssets}</strong> assets</span>
              </div>
              {totalUnplaced > 0 && (
                <div className="cc-launch-warn">
                  ⚠ {totalUnplaced} post{totalUnplaced !== 1 ? 's' : ''} not yet scheduled — drag to a calendar day
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type="button"
                className="cc-switch-btn"
                onClick={onNewCampaign}
              >
                ← New Campaign
              </button>

              <button
                type="button"
                className="cc-launch-btn"
                style={{ background: brandColor }}
                onClick={onLaunch}
                disabled={launching || totalScheduled === 0}
              >
                {launching ? (
                  <>
                    <span className="cc-spinner" />
                    Launching…
                  </>
                ) : (
                  <>
                    <span>✦</span>
                    Launch Campaign
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </footer>
    </div>
  )
}
