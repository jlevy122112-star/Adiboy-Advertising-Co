/**
 * ContentBriefGenerator — "Write once, publish everywhere."
 *
 * 1. User enters topic, tone, optional link, optional hashtag seeds.
 * 2. Selects which platforms to target.
 * 3. Clicks Generate → API call to generation-draft-server.
 * 4. adaptCopyToPlatform() runs client-side for each selected platform.
 * 5. Brief is pushed into ContentBriefContext.
 * 6. Each platform studio below auto-fills and shows an AI badge.
 */

import { useState, useCallback, useRef } from 'react'
import { useBrandTheme } from '../BrandThemePanel'
import { apiFetch } from '../hooks/useApi'
import {
  useContentBriefContext,
  buildAdaptations,
  type BriefTone,
  type MasterBrief,
} from './ContentBriefContext'
import type { PublishableNetwork } from '@home-link/marketer-pro-contract'
import './content-brief-generator.css'

const DRAFT_API = (import.meta.env.VITE_CAMPAIGN_API_ORIGIN as string | undefined) ?? 'http://localhost:8801'

/* -------------------------------------------------------------------------- */
/*  Platform config                                                            */
/* -------------------------------------------------------------------------- */

const PLATFORMS: Array<{
  network: PublishableNetwork
  label: string
  color: string
  textColor?: string
  icon: string
}> = [
  { network: 'instagram', label: 'Instagram',  color: '#d6249f', icon: '📸' },
  { network: 'facebook',  label: 'Facebook',   color: '#1877F2', icon: '📘' },
  { network: 'x',         label: 'X',          color: '#000000', icon: '✕'  },
  { network: 'tiktok',    label: 'TikTok',     color: '#010101', icon: '♪'  },
  { network: 'linkedin',  label: 'LinkedIn',   color: '#0A66C2', icon: 'in' },
  { network: 'youtube',   label: 'YouTube',    color: '#FF0000', icon: '▶'  },
  { network: 'pinterest', label: 'Pinterest',  color: '#E60023', icon: '𝑃'  },
  { network: 'snapchat',  label: 'Snapchat',   color: '#FFFC00', textColor: '#000', icon: '👻' },
]

const TONES: Array<{ value: BriefTone; label: string; desc: string }> = [
  { value: 'professional',  label: 'Professional',  desc: 'Polished, credible, authoritative'  },
  { value: 'casual',        label: 'Casual',        desc: 'Friendly, conversational, relatable' },
  { value: 'enthusiastic',  label: 'Enthusiastic',  desc: 'Energetic, exciting, high-energy'   },
  { value: 'educational',   label: 'Educational',   desc: 'Informative, clear, value-driven'   },
  { value: 'promotional',   label: 'Promotional',   desc: 'Sales-forward, urgent, benefit-led'  },
]

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function PlatformToggle({
  network, label, color, textColor, icon, selected, onToggle,
}: typeof PLATFORMS[0] & { selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`cbg-platform-btn${selected ? ' cbg-platform-btn--on' : ''}`}
      style={selected ? { '--platform-color': color, '--platform-text': textColor ?? '#fff' } as React.CSSProperties : {}}
      onClick={onToggle}
      aria-pressed={selected}
    >
      <span className="cbg-platform-icon" style={selected ? { background: color, color: textColor ?? '#fff' } : {}}>
        {icon}
      </span>
      <span className="cbg-platform-label">{label}</span>
      {selected && <span className="cbg-platform-check">✓</span>}
    </button>
  )
}

function AdaptationCard({
  network, label, color, icon, body, hashtags, warnings,
}: {
  network: PublishableNetwork
  label: string
  color: string
  icon: string
  body: string
  hashtags: string[]
  warnings: string[]
}) {
  const [expanded, setExpanded] = useState(false)
  const preview = body.length > 120 ? body.slice(0, 120) + '…' : body

  return (
    <div className="cbg-adapt-card">
      <div className="cbg-adapt-card-header">
        <span className="cbg-adapt-card-icon" style={{ background: color }}>{icon}</span>
        <span className="cbg-adapt-card-platform">{label}</span>
        <span className="cbg-adapt-card-chars">{body.length} chars</span>
        {warnings.length > 0 && (
          <span className="cbg-adapt-card-warn" title={warnings.join(' · ')}>⚠</span>
        )}
      </div>
      <div className="cbg-adapt-card-body">
        {expanded ? body : preview}
        {body.length > 120 && (
          <button
            type="button"
            className="cbg-adapt-card-toggle"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? ' See less' : ' See more'}
          </button>
        )}
      </div>
      {hashtags.length > 0 && (
        <div className="cbg-adapt-card-tags">
          {hashtags.slice(0, 6).map(t => (
            <span key={t} className="cbg-adapt-card-tag">#{t}</span>
          ))}
          {hashtags.length > 6 && (
            <span className="cbg-adapt-card-tag cbg-adapt-card-tag--more">+{hashtags.length - 6}</span>
          )}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                             */
/* -------------------------------------------------------------------------- */

export function ContentBriefGenerator() {
  const { brief, setBrief, clearBrief } = useContentBriefContext()
  const { displayName, logoUrl } = useBrandTheme()

  const [topic, setTopic]         = useState('')
  const [tone, setTone]           = useState<BriefTone>('casual')
  const [link, setLink]           = useState('')
  const [seedTags, setSeedTags]   = useState('')
  const [selected, setSelected]   = useState<Set<PublishableNetwork>>(
    new Set(['instagram', 'x', 'tiktok', 'linkedin'] as PublishableNetwork[])
  )
  const [generating, setGenerating] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [collapsed, setCollapsed]   = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const togglePlatform = useCallback((network: PublishableNetwork) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(network)) {
        if (next.size > 1) next.delete(network)
      } else {
        next.add(network)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected(prev =>
      prev.size === PLATFORMS.length
        ? new Set(['instagram', 'x'] as PublishableNetwork[])
        : new Set(PLATFORMS.map(p => p.network))
    )
  }, [])

  const generate = useCallback(async () => {
    if (!topic.trim()) { setError('Enter a topic first.'); return }
    if (selected.size === 0) { setError('Select at least one platform.'); return }

    setGenerating(true)
    setError(null)

    const brandContext = displayName ? `Brand: ${displayName}.` : ''
    const toneLabel = TONES.find(t => t.value === tone)?.desc ?? tone
    const seedHashtags = seedTags.split(/[\s,]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean)

    const result = await apiFetch<{
      headline?: string
      body?: string
      cta?: string
      hashtags?: string[]
    }>(
      `${DRAFT_API}/api/marketer-pro/generation/draft-from-brief`,
      {
        method: 'POST',
        json: {
          topic: topic.trim(),
          tone: toneLabel,
          brandContext,
          link: link.trim() || undefined,
          seedHashtags,
          platforms: Array.from(selected),
        },
      },
    )

    setGenerating(false)

    if (!result.ok) {
      setError(`Generation failed: ${result.error}`)
      return
    }

    const d = result.data
    const rawHeadline = d.headline ?? topic.trim()
    const rawBody     = d.body     ?? `${topic.trim()} — crafted for your audience.`
    const rawCta      = d.cta      ?? ''
    const rawHashtags = d.hashtags ?? seedHashtags

    const platforms = Array.from(selected)
    const adaptations = buildAdaptations(rawHeadline, rawBody, rawCta, rawHashtags, platforms)

    const newBrief: MasterBrief = {
      id: Math.random().toString(36).slice(2),
      topic: topic.trim(),
      tone,
      rawHeadline,
      rawBody,
      rawCta,
      rawHashtags,
      media: [],
      selectedPlatforms: platforms,
      adaptations,
      generatedAt: new Date(),
    }

    setBrief(newBrief)
    setCollapsed(true)
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }, [topic, tone, link, seedTags, selected, displayName, setBrief])

  const hasAdaptations = brief !== null && Object.keys(brief.adaptations).length > 0

  return (
    <div className="cbg-root">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="cbg-header">
        <div className="cbg-header-left">
          <div className="cbg-logo">
            {logoUrl
              ? <img src={logoUrl} alt={displayName} className="cbg-logo-img" />
              : <span className="cbg-logo-icon">✦</span>
            }
          </div>
          <div>
            <div className="cbg-title">Content Brief Generator</div>
            <div className="cbg-subtitle">Write once · AI adapts · Publish everywhere</div>
          </div>
        </div>
        <div className="cbg-header-right">
          {hasAdaptations && (
            <button
              type="button"
              className="cbg-collapse-btn"
              onClick={() => setCollapsed(c => !c)}
            >
              {collapsed ? '▼ Edit Brief' : '▲ Collapse'}
            </button>
          )}
          {hasAdaptations && (
            <button type="button" className="cbg-clear-btn" onClick={clearBrief}>
              × Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Form (collapsible after generation) ─────────────────────────── */}
      {!collapsed && (
        <div className="cbg-form">
          {/* Topic */}
          <div className="cbg-field">
            <label className="cbg-label">What's this post about? *</label>
            <input
              className="cbg-input"
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Summer sale — 30% off all products this weekend only"
              maxLength={500}
            />
          </div>

          {/* Tone */}
          <div className="cbg-field">
            <label className="cbg-label">Tone</label>
            <div className="cbg-tone-grid">
              {TONES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  className={`cbg-tone-btn${tone === t.value ? ' cbg-tone-btn--active' : ''}`}
                  onClick={() => setTone(t.value)}
                  title={t.desc}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Link + Hashtag seeds */}
          <div className="cbg-row">
            <div className="cbg-field cbg-field--half">
              <label className="cbg-label">Destination link (optional)</label>
              <input
                className="cbg-input"
                type="url"
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="https://yoursite.com/sale"
              />
            </div>
            <div className="cbg-field cbg-field--half">
              <label className="cbg-label">Hashtag seeds (optional)</label>
              <input
                className="cbg-input"
                type="text"
                value={seedTags}
                onChange={e => setSeedTags(e.target.value)}
                placeholder="sale, summer, deals"
              />
            </div>
          </div>

          {/* Platform picker */}
          <div className="cbg-field">
            <div className="cbg-label-row">
              <label className="cbg-label">Target platforms *</label>
              <button type="button" className="cbg-select-all" onClick={toggleAll}>
                {selected.size === PLATFORMS.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="cbg-platform-grid">
              {PLATFORMS.map(p => (
                <PlatformToggle
                  key={p.network}
                  {...p}
                  selected={selected.has(p.network)}
                  onToggle={() => togglePlatform(p.network)}
                />
              ))}
            </div>
          </div>

          {error && <div className="cbg-error">{error}</div>}

          <button
            type="button"
            className="cbg-generate-btn"
            onClick={generate}
            disabled={generating || !topic.trim() || selected.size === 0}
          >
            {generating ? (
              <>
                <span className="cbg-spinner" />
                Generating for {selected.size} platform{selected.size !== 1 ? 's' : ''}…
              </>
            ) : (
              <>
                <span className="cbg-generate-icon">✦</span>
                Generate for {selected.size} platform{selected.size !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Adaptation results ───────────────────────────────────────────── */}
      {hasAdaptations && (
        <div className="cbg-results" ref={resultRef}>
          <div className="cbg-results-header">
            <span className="cbg-results-badge">✦ AI-Generated</span>
            <span className="cbg-results-topic">"{brief!.topic}"</span>
            <span className="cbg-results-meta">
              {brief!.selectedPlatforms.length} platforms · {brief!.rawHashtags.length} hashtags
              · {new Date(brief!.generatedAt).toLocaleTimeString()}
            </span>
          </div>
          <p className="cbg-results-hint">
            Each studio below has been pre-filled with an adapted version. Edit freely in any studio before publishing.
          </p>
          <div className="cbg-adapt-grid">
            {PLATFORMS.filter(p => brief!.selectedPlatforms.includes(p.network)).map(p => {
              const adapt = brief!.adaptations[p.network]
              if (!adapt) return null
              const body = [adapt.copy.headline, adapt.copy.body, adapt.copy.cta]
                .filter(Boolean).join('\n\n')
              const warnings = adapt.warnings.map(w => w.message)
              return (
                <AdaptationCard
                  key={p.network}
                  network={p.network}
                  label={p.label}
                  color={p.color}
                  icon={p.icon}
                  body={body}
                  hashtags={adapt.copy.hashtags ?? []}
                  warnings={warnings}
                />
              )
            })}
          </div>
          <div className="cbg-results-footer">
            <span className="cbg-results-arrow">↓</span>
            <span>Review and publish in each studio below</span>
          </div>
        </div>
      )}
    </div>
  )
}
