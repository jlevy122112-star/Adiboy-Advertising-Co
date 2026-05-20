/**
 * Pinterest Creative Studio — Pinterest Partner + Shopping Ads.
 *
 * Generates Pinterest-optimized content:
 *   - Standard Pins, Idea Pins (multi-page), Product Pins, Video Pins
 *   - SEO title + keyword chips + category targeting
 *   - Board/Section assignment + destination URL
 *   - Product fields: price, availability, product link
 *   - Best-time scheduling via ScheduleCalendar
 *   - Direct publish via campaign API
 */

import { useState, useCallback, useRef } from 'react'
import { useBrandTheme } from '../BrandThemePanel'
import { MediaDropZone, type MediaItem } from '../platform-studio/MediaDropZone'
import { ScheduleCalendar, type BestTimeSlot } from '../platform-studio/ScheduleCalendar'
import { HashtagBuilder } from '../platform-studio/HashtagBuilder'
import { apiFetch } from '../hooks/useApi'
import './pinterest-studio.css'

const CAMPAIGN_API = (import.meta.env.VITE_CAMPAIGN_API_ORIGIN as string | undefined) ?? 'http://localhost:8801'

type PinType = 'pin' | 'idea_pin' | 'product_pin' | 'video_pin'
type Availability = 'in_stock' | 'out_of_stock' | 'preorder'

const PI_BEST_TIMES: BestTimeSlot[] = [
  { hour: 8,  score: 'good' },
  { hour: 20, score: 'peak' },
  { hour: 21, score: 'peak' },
  { hour: 22, score: 'peak' },
  { hour: 23, score: 'good' },
]

const CATEGORIES = [
  'Art', 'DIY', 'Food & Drink', 'Fashion', 'Home Decor',
  'Beauty', 'Travel & Places', 'Health & Fitness', 'Technology', 'Business & Finance',
]

interface IdeaPinPage {
  id: string
  imageUrl: string
  textOverlay: string
  emojiStickers: string[]
}

interface PinterestDraft {
  pinType: PinType
  title: string
  description: string
  destinationUrl: string
  altText: string
  board: string
  section: string
  media: MediaItem[]
  hashtags: string[]
  seoTitle: string
  keywords: string[]
  category: string
  // Idea Pin
  ideaPages: IdeaPinPage[]
  // Product Pin
  price: string
  availability: Availability
  productLink: string
  scheduledAt: Date | null
}

function mkPageId() { return Math.random().toString(36).slice(2, 10) }

function CharCount({ value, max }: { value: string; max: number }) {
  const pct = value.length / max
  const color = pct > 0.9 ? 'var(--danger)' : pct > 0.75 ? 'var(--warning)' : 'var(--text-muted)'
  return <span className="pi-char-count" style={{ color }}>{value.length}/{max}</span>
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`pi-check-item${ok ? ' pi-check-item--ok' : ''}`}>
      <span className="pi-check-icon">{ok ? '✓' : '○'}</span>
      <span className="pi-check-label">{label}</span>
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="pi-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="pi-toggle-input"
      />
      <span className="pi-toggle-track">
        <span className="pi-toggle-thumb" />
      </span>
      <span className="pi-toggle-label">{label}</span>
    </label>
  )
}

const EMOJI_STICKERS = ['😂','❤️','🔥','✨','💯','🎉','🌸','🍀','🦋','🌿','🍓','🎨','✈️','🏠','💄','💪','⭐','🌟','💡','🎯']

const DEFAULT_PAGE = (): IdeaPinPage => ({
  id: mkPageId(),
  imageUrl: '',
  textOverlay: '',
  emojiStickers: [],
})

const DEFAULT_DRAFT: PinterestDraft = {
  pinType: 'pin',
  title: '',
  description: '',
  destinationUrl: '',
  altText: '',
  board: '',
  section: '',
  media: [],
  hashtags: [],
  seoTitle: '',
  keywords: [],
  category: '',
  ideaPages: [DEFAULT_PAGE()],
  price: '',
  availability: 'in_stock',
  productLink: '',
  scheduledAt: null,
}

function PinterestPhoneMock({ draft }: { draft: PinterestDraft }) {
  const firstMedia = draft.media[0]
  const hasImage = !!firstMedia?.url

  return (
    <div className="pi-phone">
      <div className="pi-phone-notch" />
      <div className="pi-phone-screen">
        {/* Top bar */}
        <div className="pi-mock-topbar">
          <div className="pi-mock-logo">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="#E60023">
              <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
            </svg>
          </div>
          <div className="pi-mock-search">🔍 Search</div>
          <div className="pi-mock-bell">🔔</div>
        </div>

        {/* Masonry background */}
        <div className="pi-mock-masonry">
          <div className="pi-mock-col">
            <div className="pi-mock-thumb pi-mock-thumb--1" />
            <div className="pi-mock-thumb pi-mock-thumb--2" />
          </div>
          <div className="pi-mock-col">
            <div className="pi-mock-thumb pi-mock-thumb--3" />
            <div className="pi-mock-thumb pi-mock-thumb--4" />
          </div>
        </div>

        {/* Foreground pin card */}
        <div className="pi-mock-card">
          <div className="pi-mock-card-img">
            {hasImage ? (
              <img src={firstMedia.url} alt="Pin preview" className="pi-mock-card-img-el" />
            ) : (
              <div className="pi-mock-card-placeholder">
                <span className="pi-mock-placeholder-icon">📌</span>
              </div>
            )}
          </div>
          <div className="pi-mock-card-body">
            <div className="pi-mock-card-title">
              {draft.title || <span className="pi-mock-card-empty">Pin title</span>}
            </div>
            <div className="pi-mock-card-actions">
              <div className="pi-mock-save-btn">
                <span>🔖</span> Save
              </div>
            </div>
            {draft.destinationUrl && (
              <div className="pi-mock-card-domain">
                <div className="pi-mock-favicon">🌐</div>
                <span className="pi-mock-domain-text">
                  {(() => { try { return new URL(draft.destinationUrl).hostname } catch { return draft.destinationUrl.slice(0, 20) } })()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="pi-phone-home" />
    </div>
  )
}

export function PinterestStudioPanel() {
  const { theme } = useBrandTheme()
  const [draft, setDraft] = useState<PinterestDraft>(DEFAULT_DRAFT)
  const [keywordInput, setKeywordInput] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<{ ok: boolean; message: string } | null>(null)
  const keywordInputRef = useRef<HTMLInputElement>(null)

  const update = useCallback(<K extends keyof PinterestDraft>(key: K, value: PinterestDraft[K]) => {
    setDraft(d => ({ ...d, [key]: value }))
  }, [])

  const addKeyword = useCallback((raw: string) => {
    const kw = raw.trim().toLowerCase()
    if (!kw || draft.keywords.includes(kw) || draft.keywords.length >= 20) return
    setDraft(d => ({ ...d, keywords: [...d.keywords, kw] }))
  }, [draft.keywords])

  const removeKeyword = useCallback((kw: string) => {
    setDraft(d => ({ ...d, keywords: d.keywords.filter(k => k !== kw) }))
  }, [])

  const onKeywordKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addKeyword(keywordInput)
      setKeywordInput('')
    }
  }, [keywordInput, addKeyword])

  const addIdeaPage = useCallback(() => {
    setDraft(d => {
      if (d.ideaPages.length >= 20) return d
      return { ...d, ideaPages: [...d.ideaPages, DEFAULT_PAGE()] }
    })
  }, [])

  const removeIdeaPage = useCallback((id: string) => {
    setDraft(d => {
      if (d.ideaPages.length <= 1) return d
      return { ...d, ideaPages: d.ideaPages.filter(p => p.id !== id) }
    })
  }, [])

  const updateIdeaPage = useCallback((id: string, field: keyof IdeaPinPage, value: string) => {
    setDraft(d => ({
      ...d,
      ideaPages: d.ideaPages.map(p => p.id === id ? { ...p, [field]: value } : p),
    }))
  }, [])

  const togglePageEmoji = useCallback((pageId: string, emoji: string) => {
    setDraft(d => ({
      ...d,
      ideaPages: d.ideaPages.map(p => {
        if (p.id !== pageId) return p
        const has = p.emojiStickers.includes(emoji)
        return { ...p, emojiStickers: has ? p.emojiStickers.filter(e => e !== emoji) : [...p.emojiStickers, emoji] }
      }),
    }))
  }, [])

  const publish = useCallback(async () => {
    if (!draft.title.trim()) return
    setPublishing(true)
    setPublishResult(null)

    const r = await apiFetch<{ ok: boolean; pinId?: string; detail?: string }>(
      `${CAMPAIGN_API}/api/schedule`,
      {
        method: 'POST',
        json: {
          network: 'pinterest',
          pinType: draft.pinType,
          title: draft.title,
          description: draft.description,
          destinationUrl: draft.destinationUrl,
          altText: draft.altText,
          board: draft.board,
          section: draft.section || undefined,
          hashtags: draft.hashtags,
          seoTitle: draft.seoTitle,
          keywords: draft.keywords,
          category: draft.category || undefined,
          mediaUrls: draft.media.map(m => m.url),
          ...(draft.pinType === 'product_pin' ? {
            price: draft.price ? parseFloat(draft.price) : undefined,
            availability: draft.availability,
            productLink: draft.productLink,
          } : {}),
          ...(draft.scheduledAt ? { scheduledAt: draft.scheduledAt.toISOString() } : {}),
        },
      }
    )

    if (r.ok && r.data.ok) {
      setPublishResult({ ok: true, message: `Published! Pin ID: ${r.data.pinId ?? '—'}` })
      setDraft(DEFAULT_DRAFT)
    } else {
      const msg = r.ok ? (r.data.detail ?? 'Publish failed.') : r.error
      setPublishResult({ ok: false, message: msg ?? 'Publish failed — check your Pinterest connection.' })
    }
    setPublishing(false)
  }, [draft])

  const openTestLink = useCallback(() => {
    if (draft.destinationUrl) window.open(draft.destinationUrl, '_blank', 'noopener,noreferrer')
  }, [draft.destinationUrl])

  const readyChecks = [
    draft.title.length > 0,
    draft.board.trim().length > 0,
    draft.media.length > 0 || draft.pinType === 'idea_pin',
    draft.altText.length > 0,
    draft.keywords.length >= 3,
    draft.category !== '',
    draft.pinType !== 'product_pin' || draft.productLink.trim().length > 0,
  ]

  return (
    <div className="pi-root">
      {/* Header */}
      <div className="pi-header">
        <div className="pi-header-left">
          <div className="pi-logo">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff">
              <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
            </svg>
          </div>
          <div>
            <div className="pi-title">Pinterest Creative Studio</div>
            <div className="pi-subtitle">Pinterest Partner · Shopping Ads</div>
          </div>
        </div>
        <div className="pi-partner-badges">
          <span className="pi-badge pi-badge--partner">Pinterest Partner</span>
          <span className="pi-badge pi-badge--shopping">Shopping Ads</span>
        </div>
      </div>

      <div className="pi-layout">
        {/* Left: editor */}
        <div className="pi-editor">

          {/* Pin type */}
          <section className="pi-section">
            <div className="pi-section-title">Pin Type</div>
            <div className="pi-type-grid">
              {(['pin', 'idea_pin', 'product_pin', 'video_pin'] as PinType[]).map(t => (
                <button
                  key={t}
                  className={`pi-type-btn${draft.pinType === t ? ' pi-type-btn--active' : ''}`}
                  onClick={() => update('pinType', t)}
                  type="button"
                >
                  {t === 'pin' && '📌 Standard Pin'}
                  {t === 'idea_pin' && '💡 Idea Pin'}
                  {t === 'product_pin' && '🛍 Product Pin'}
                  {t === 'video_pin' && '▶ Video Pin'}
                </button>
              ))}
            </div>
          </section>

          {/* Media */}
          {draft.pinType !== 'idea_pin' && (
            <section className="pi-section">
              <div className="pi-section-title">
                {draft.pinType === 'video_pin' ? 'Video' : 'Image'} — 2:3 ratio recommended
              </div>
              <MediaDropZone
                items={draft.media}
                onChange={items => update('media', items)}
                maxItems={draft.pinType === 'pin' ? 1 : 5}
                accept={draft.pinType === 'video_pin' ? 'video/*' : 'image/*'}
                aspectHint="2:3 (1000×1500px)"
              />
            </section>
          )}

          {/* Idea Pin pages */}
          {draft.pinType === 'idea_pin' && (
            <section className="pi-section">
              <div className="pi-section-header">
                <div className="pi-section-title">
                  Idea Pin Pages — Page {1} of {draft.ideaPages.length}
                </div>
                <div className="pi-idea-controls">
                  <button className="pi-idea-btn" onClick={addIdeaPage} type="button" disabled={draft.ideaPages.length >= 20}>
                    + Add Page
                  </button>
                  <button
                    className="pi-idea-btn pi-idea-btn--remove"
                    onClick={() => removeIdeaPage(draft.ideaPages[draft.ideaPages.length - 1]?.id ?? '')}
                    type="button"
                    disabled={draft.ideaPages.length <= 1}
                  >
                    − Remove Page
                  </button>
                </div>
              </div>
              <div className="pi-idea-pages">
                {draft.ideaPages.map((page, idx) => (
                  <div key={page.id} className="pi-idea-page">
                    <div className="pi-idea-page-header">Page {idx + 1}</div>
                    <div className="pi-idea-page-upload">
                      <input
                        className="pi-input"
                        type="url"
                        placeholder="Image URL for this page…"
                        value={page.imageUrl}
                        onChange={e => updateIdeaPage(page.id, 'imageUrl', e.target.value)}
                      />
                    </div>
                    <input
                      className="pi-input"
                      type="text"
                      placeholder="Text overlay for this page…"
                      value={page.textOverlay}
                      onChange={e => updateIdeaPage(page.id, 'textOverlay', e.target.value)}
                    />
                    <div className="pi-emoji-grid">
                      {EMOJI_STICKERS.map(emoji => (
                        <button
                          key={emoji}
                          className={`pi-emoji-btn${page.emojiStickers.includes(emoji) ? ' pi-emoji-btn--active' : ''}`}
                          onClick={() => togglePageEmoji(page.id, emoji)}
                          type="button"
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Title */}
          <section className="pi-section">
            <div className="pi-section-header">
              <div className="pi-section-title">Title</div>
              <CharCount value={draft.title} max={100} />
            </div>
            <input
              className="pi-input"
              type="text"
              placeholder="Compelling pin title (100 chars max)…"
              value={draft.title}
              maxLength={100}
              onChange={e => update('title', e.target.value)}
            />
          </section>

          {/* Description */}
          <section className="pi-section">
            <div className="pi-section-header">
              <div className="pi-section-title">Description</div>
              <CharCount value={draft.description} max={500} />
            </div>
            <textarea
              className="pi-textarea"
              rows={3}
              placeholder="Describe your pin. Tell people what it is and why they'll love it…"
              value={draft.description}
              maxLength={500}
              onChange={e => update('description', e.target.value)}
            />
          </section>

          {/* Destination URL */}
          <section className="pi-section">
            <div className="pi-section-title">Destination URL</div>
            <div className="pi-url-row">
              <input
                className="pi-input pi-input--flex"
                type="url"
                placeholder="https://yourwebsite.com/page"
                value={draft.destinationUrl}
                onChange={e => update('destinationUrl', e.target.value)}
              />
              <button
                className="pi-test-link-btn"
                onClick={openTestLink}
                type="button"
                disabled={!draft.destinationUrl}
                title="Test link"
              >
                Test Link ↗
              </button>
            </div>
          </section>

          {/* Alt text */}
          <section className="pi-section">
            <div className="pi-section-header">
              <div className="pi-section-title">Alt Text</div>
              <CharCount value={draft.altText} max={500} />
            </div>
            <input
              className="pi-input"
              type="text"
              placeholder="Describe the image for accessibility…"
              value={draft.altText}
              maxLength={500}
              onChange={e => update('altText', e.target.value)}
            />
          </section>

          {/* Board + Section */}
          <section className="pi-section">
            <div className="pi-section-title">Board</div>
            <input
              className="pi-input"
              type="text"
              placeholder="Board name"
              value={draft.board}
              onChange={e => update('board', e.target.value)}
            />
            <div className="pi-field-hint">Enter an existing board name or create a new one</div>
            <input
              className="pi-input"
              type="text"
              placeholder="Section (optional)"
              value={draft.section}
              onChange={e => update('section', e.target.value)}
            />
          </section>

          {/* Product Pin extras */}
          {draft.pinType === 'product_pin' && (
            <section className="pi-section">
              <div className="pi-section-title">Product Details</div>
              <div className="pi-price-row">
                <span className="pi-price-prefix">$</span>
                <input
                  className="pi-input pi-input--flex"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={draft.price}
                  onChange={e => update('price', e.target.value)}
                />
              </div>
              <div className="pi-avail-grid">
                {(['in_stock', 'out_of_stock', 'preorder'] as Availability[]).map(a => (
                  <button
                    key={a}
                    className={`pi-avail-btn${draft.availability === a ? ' pi-avail-btn--active' : ''}`}
                    onClick={() => update('availability', a)}
                    type="button"
                  >
                    {a === 'in_stock' ? '✓ In Stock' : a === 'out_of_stock' ? '✗ Out of Stock' : '⏳ Preorder'}
                  </button>
                ))}
              </div>
              <input
                className="pi-input"
                type="url"
                placeholder="Product link URL…"
                value={draft.productLink}
                onChange={e => update('productLink', e.target.value)}
              />
            </section>
          )}

          {/* SEO section */}
          <section className="pi-section">
            <div className="pi-section-title">SEO &amp; Discovery</div>

            <div className="pi-section-header">
              <label className="pi-field-label">SEO Title</label>
              <CharCount value={draft.seoTitle} max={100} />
            </div>
            <input
              className="pi-input"
              type="text"
              placeholder="SEO-optimised title for search (separate from pin title)…"
              value={draft.seoTitle}
              maxLength={100}
              onChange={e => update('seoTitle', e.target.value)}
            />

            <div className="pi-field-label">Keywords (max 20)</div>
            <div className="pi-kw-input-row">
              <input
                ref={keywordInputRef}
                className="pi-kw-input"
                type="text"
                placeholder="Type keyword, press Enter…"
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={onKeywordKeyDown}
                maxLength={60}
                disabled={draft.keywords.length >= 20}
              />
            </div>
            {draft.keywords.length > 0 && (
              <div className="pi-kw-chips">
                {draft.keywords.map(kw => (
                  <span key={kw} className="pi-kw-chip">
                    {kw}
                    <button className="pi-kw-remove" onClick={() => removeKeyword(kw)} type="button" aria-label={`Remove ${kw}`}>×</button>
                  </span>
                ))}
              </div>
            )}

            <div className="pi-field-label">Category</div>
            <select
              className="pi-select"
              value={draft.category}
              onChange={e => update('category', e.target.value)}
            >
              <option value="">— Select a category —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </section>

          {/* Hashtags */}
          <section className="pi-section">
            <div className="pi-section-title">Hashtags</div>
            <HashtagBuilder
              tags={draft.hashtags}
              onChange={tags => update('hashtags', tags)}
              maxTags={20}
              platform="pinterest"
            />
          </section>

          {/* Schedule */}
          <section className="pi-section">
            <div className="pi-section-title">Schedule</div>
            <ScheduleCalendar
              value={draft.scheduledAt}
              onChange={d => update('scheduledAt', d)}
              bestTimes={PI_BEST_TIMES}
              platform="Pinterest"
            />
          </section>

          {/* Publish */}
          <div className="pi-publish-row">
            <button
              className="pi-publish-btn"
              onClick={publish}
              disabled={publishing || !draft.title.trim()}
              type="button"
            >
              {publishing ? (
                <><span className="pi-spinner" /> Publishing to Pinterest…</>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ flexShrink: 0 }}>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
                  </svg>
                  Publish to Pinterest
                </>
              )}
            </button>
          </div>

          {publishResult && (
            <div className={`pi-result${publishResult.ok ? ' pi-result--ok' : ' pi-result--err'}`}>
              {publishResult.message}
            </div>
          )}
        </div>

        {/* Right: phone mock + checklist */}
        <div className="pi-preview-col">
          <div className="pi-preview-label">Live Preview · 2:3 Pin</div>
          <PinterestPhoneMock draft={draft} />

          <div className="pi-checklist">
            <div className="pi-checklist-title">Partner Readiness</div>
            <CheckItem ok={false} label="Business account verified" />
            <CheckItem ok={false} label="Website claimed &amp; verified" />
            <CheckItem ok={false} label="Catalog connected" />
            <CheckItem ok={false} label="50+ Pins saved" />
            <CheckItem ok={false} label="Rich Pins enabled" />
            <CheckItem ok={false} label="No policy violations" />
            <CheckItem ok={false} label="Ads account active" />
          </div>
        </div>
      </div>
    </div>
  )
}
