/**
 * Snapchat Creative Studio — Snap Partner + Ads Manager.
 *
 * Generates Snapchat-optimized content:
 *   - Stories (photo/video ≤60s), Spotlight, Ads
 *   - Caption overlays, swipe-up links, duration chips
 *   - Spotlight topic tags, remix toggle, sound toggle
 *   - Ad types, headlines, CTAs with Ads Manager notice
 *   - Best-time scheduling via ScheduleCalendar
 *   - Direct publish via campaign API
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useContentBrief } from '../generation/ContentBriefContext'
import { useBrandTheme } from '../BrandThemePanel'
import { MediaDropZone, type MediaItem } from '../platform-studio/MediaDropZone'
import { ScheduleCalendar, type BestTimeSlot } from '../platform-studio/ScheduleCalendar'
import { apiFetch } from '../hooks/useApi'
import './snapchat-studio.css'

const CAMPAIGN_API = (import.meta.env.VITE_CAMPAIGN_API_ORIGIN as string | undefined) ?? 'http://localhost:8801'

type PostType = 'story' | 'spotlight' | 'ad'
type CaptionColor = 'white' | 'black' | 'yellow' | 'rainbow'
type StoryAudience = 'public' | 'friends'
type PhotoDuration = 3 | 5 | 7 | 10
type AdType = 'single_image' | 'single_video' | 'story_ad' | 'collection_ad'
type CTA = 'buy_now' | 'learn_more' | 'download' | 'sign_up' | 'watch_more'

const SC_BEST_TIMES: BestTimeSlot[] = [
  { hour: 10, score: 'good' },
  { hour: 16, score: 'peak' },
  { hour: 17, score: 'peak' },
  { hour: 20, score: 'peak' },
  { hour: 22, score: 'good' },
]

const SPOTLIGHT_TOPICS = [
  'Comedy', 'Gaming', 'Beauty', 'Food', 'Sports',
  'Fashion', 'Pets', 'Travel', 'DIY', 'Music', 'News', 'Education',
]

const STORY_EMOJIS = [
  '😂','❤️','🔥','✨','💯','🎉','🙌','👏','🤝','💪',
  '🎯','🚀','⭐','💫','🎊','🎁','💡','🔑','💎','👑',
  '🏆','🌟','✅','🎶','🎵',
]

interface SnapchatDraft {
  postType: PostType
  media: MediaItem[]
  // Story
  caption: string
  captionColor: CaptionColor
  swipeUpLink: string
  photoDuration: PhotoDuration
  storyEmojis: string[]
  storyAudience: StoryAudience
  // Spotlight
  spotlightCaption: string
  soundEnabled: boolean
  topicTags: string[]
  allowRemix: boolean
  // Ad
  adType: AdType
  adHeadline: string
  brandName: string
  cta: CTA
  scheduledAt: Date | null
}

function CharCount({ value, max }: { value: string; max: number }) {
  const pct = value.length / max
  const color = pct > 0.9 ? 'var(--danger)' : pct > 0.75 ? 'var(--warning)' : 'var(--text-muted)'
  return <span className="sc-char-count" style={{ color }}>{value.length}/{max}</span>
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`sc-check-item${ok ? ' sc-check-item--ok' : ''}`}>
      <span className="sc-check-icon">{ok ? '✓' : '○'}</span>
      <span className="sc-check-label">{label}</span>
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="sc-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="sc-toggle-input"
      />
      <span className="sc-toggle-track">
        <span className="sc-toggle-thumb" />
      </span>
      <span className="sc-toggle-label">{label}</span>
    </label>
  )
}

// Snapchat ghost logo SVG
function SnapGhost({ size = 20, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 40 44" width={size} height={size} fill={color}>
      <path d="M20 2C11.163 2 4 9.163 4 18c0 5.5 2.7 10.4 6.9 13.5-.3.7-.8 1.4-1.5 1.9-1.2.9-2.8 1.2-4 1.7-.8.3-1.4.9-1.4 1.7 0 1.2 1.2 2 2.2 2.3 2.3.6 4.2 1 5.8 2.3.5.4.8.8.8 1.3 0 .2-.1.5-.1.7 0 .4.3.6.7.6.3 0 .6-.1.9-.2.9-.3 1.9-.5 3-.5 1.1 0 2.1.2 3 .5.3.1.6.2.9.2.4 0 .7-.2.7-.6 0-.2-.1-.5-.1-.7 0-.5.3-.9.8-1.3 1.6-1.3 3.5-1.7 5.8-2.3 1-.3 2.2-1.1 2.2-2.3 0-.8-.6-1.4-1.4-1.7-1.2-.5-2.8-.8-4-1.7-.7-.5-1.2-1.2-1.5-1.9C33.3 28.4 36 23.5 36 18c0-8.837-7.163-16-16-16z"/>
    </svg>
  )
}

function SnapchatPhoneMock({ draft }: { draft: SnapchatDraft }) {
  const firstMedia = draft.media[0]
  const hasImage = !!firstMedia?.url
  const captionText = draft.postType === 'spotlight' ? draft.spotlightCaption : draft.caption

  return (
    <div className="sc-phone">
      <div className="sc-phone-notch" />
      <div className="sc-phone-screen">
        {/* Media/viewfinder area */}
        <div className="sc-viewfinder">
          {hasImage ? (
            <img src={firstMedia.url} alt="Story preview" className="sc-viewfinder-img" />
          ) : (
            <div className="sc-viewfinder-placeholder" />
          )}

          {/* Story overlay UI */}
          <div className="sc-story-overlay">
            {/* Top: username + timer */}
            <div className="sc-story-top">
              <div className="sc-story-username">@marketer_pro</div>
              <div className="sc-story-timer">
                <div className="sc-timer-bar" />
              </div>
            </div>

            {/* Caption */}
            {captionText && (
              <div
                className="sc-story-caption"
                style={{
                  color: draft.captionColor === 'white' ? '#fff'
                    : draft.captionColor === 'black' ? '#000'
                    : draft.captionColor === 'yellow' ? '#FFFC00'
                    : undefined,
                }}
                data-rainbow={draft.captionColor === 'rainbow' ? 'true' : undefined}
              >
                {captionText.slice(0, 80)}
              </div>
            )}

            {/* Right action bar */}
            <div className="sc-story-sidebar">
              <div className="sc-story-action">❤️<span className="sc-action-count">0</span></div>
              <div className="sc-story-action">💬<span className="sc-action-count">0</span></div>
              <div className="sc-story-action">➤</div>
            </div>

            {/* Swipe up */}
            {draft.swipeUpLink && draft.postType === 'story' && (
              <div className="sc-swipe-up">↑ Swipe Up</div>
            )}
          </div>
        </div>

        {/* Ghost logo top-center */}
        <div className="sc-mock-logo">
          <SnapGhost size={20} color="#FFFC00" />
        </div>

        {/* Bottom bar: capture + gallery + flip */}
        <div className="sc-bottom-bar">
          <div className="sc-gallery-btn">⬛</div>
          <div className="sc-capture-btn">
            <div className="sc-capture-ring" />
            <div className="sc-capture-center" />
          </div>
          <div className="sc-flip-btn">🔄</div>
        </div>
      </div>
      <div className="sc-phone-home" />
    </div>
  )
}

const DEFAULT_DRAFT: SnapchatDraft = {
  postType: 'story',
  media: [],
  caption: '',
  captionColor: 'white',
  swipeUpLink: '',
  photoDuration: 5,
  storyEmojis: [],
  storyAudience: 'public',
  spotlightCaption: '',
  soundEnabled: true,
  topicTags: [],
  allowRemix: false,
  adType: 'single_image',
  adHeadline: '',
  brandName: '',
  cta: 'learn_more',
  scheduledAt: null,
}

const CTA_LABELS: Record<CTA, string> = {
  buy_now: 'Buy Now',
  learn_more: 'Learn More',
  download: 'Download',
  sign_up: 'Sign Up',
  watch_more: 'Watch More',
}

const AD_TYPE_LABELS: Record<AdType, string> = {
  single_image: 'Single Image',
  single_video: 'Single Video',
  story_ad: 'Story Ad',
  collection_ad: 'Collection Ad',
}

export function SnapchatStudioPanel() {
  const { theme } = useBrandTheme()
  const [draft, setDraft] = useState<SnapchatDraft>(DEFAULT_DRAFT)
  const { briefId, adaptation, isSelected } = useContentBrief('snapchat')
  useEffect(() => {
    if (!briefId || !adaptation || !isSelected) return
    const caption = [adaptation.copy.headline, adaptation.copy.body].filter(Boolean).join(' ')
    setDraft(d => ({ ...d, caption: caption.slice(0, 250), spotlightCaption: caption.slice(0, 250) }))
  }, [briefId, adaptation, isSelected])

  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<{ ok: boolean; message: string } | null>(null)

  const update = useCallback(<K extends keyof SnapchatDraft>(key: K, value: SnapchatDraft[K]) => {
    setDraft(d => ({ ...d, [key]: value }))
  }, [])

  const toggleEmoji = useCallback((emoji: string) => {
    setDraft(d => {
      const has = d.storyEmojis.includes(emoji)
      return { ...d, storyEmojis: has ? d.storyEmojis.filter(e => e !== emoji) : [...d.storyEmojis, emoji] }
    })
  }, [])

  const toggleTopic = useCallback((topic: string) => {
    setDraft(d => {
      const has = d.topicTags.includes(topic)
      if (!has && d.topicTags.length >= 5) return d
      return { ...d, topicTags: has ? d.topicTags.filter(t => t !== topic) : [...d.topicTags, topic] }
    })
  }, [])

  const publish = useCallback(async () => {
    const hasContent = draft.postType === 'story'
      ? (draft.caption.trim().length > 0 || draft.media.length > 0)
      : draft.postType === 'spotlight'
      ? draft.spotlightCaption.trim().length > 0
      : draft.adHeadline.trim().length > 0

    if (!hasContent) return
    setPublishing(true)
    setPublishResult(null)

    const r = await apiFetch<{ ok: boolean; snapId?: string; detail?: string }>(
      `${CAMPAIGN_API}/api/schedule`,
      {
        method: 'POST',
        json: {
          network: 'snapchat',
          postType: draft.postType,
          mediaUrls: draft.media.map(m => m.url),
          ...(draft.postType === 'story' ? {
            caption: draft.caption,
            captionColor: draft.captionColor,
            swipeUpLink: draft.swipeUpLink || undefined,
            photoDuration: draft.photoDuration,
            storyEmojis: draft.storyEmojis,
            audience: draft.storyAudience,
          } : {}),
          ...(draft.postType === 'spotlight' ? {
            caption: draft.spotlightCaption,
            soundEnabled: draft.soundEnabled,
            topicTags: draft.topicTags,
            allowRemix: draft.allowRemix,
          } : {}),
          ...(draft.postType === 'ad' ? {
            adType: draft.adType,
            headline: draft.adHeadline,
            brandName: draft.brandName,
            cta: draft.cta,
          } : {}),
          ...(draft.scheduledAt ? { scheduledAt: draft.scheduledAt.toISOString() } : {}),
        },
      }
    )

    if (r.ok && r.data.ok) {
      setPublishResult({ ok: true, message: `Published! Snap ID: ${r.data.snapId ?? '—'}` })
      setDraft(DEFAULT_DRAFT)
    } else {
      const msg = r.ok ? (r.data.detail ?? 'Publish failed.') : r.error
      setPublishResult({ ok: false, message: msg ?? 'Publish failed — check your Snapchat connection.' })
    }
    setPublishing(false)
  }, [draft])

  const canPublish = draft.postType === 'story'
    ? (draft.caption.trim().length > 0 || draft.media.length > 0)
    : draft.postType === 'spotlight'
    ? draft.spotlightCaption.trim().length > 0
    : draft.adHeadline.trim().length > 0

  return (
    <div className="sc-root">
      {/* Header */}
      <div className="sc-header">
        <div className="sc-header-left">
          <div className="sc-logo">
            <SnapGhost size={20} color="#000" />
          </div>
          <div>
            <div className="sc-title">Snapchat Creative Studio</div>
            <div className="sc-subtitle">Snap Partner · Ads Manager</div>
          </div>
        </div>
        <div className="sc-partner-badges">
          <span className="sc-badge sc-badge--snap">Snap Partner</span>
          <span className="sc-badge sc-badge--ads">Ads Manager</span>
        </div>
      </div>

      <div className="sc-layout">
        {/* Left: editor */}
        <div className="sc-editor">

          {/* Post type */}
          <section className="sc-section">
            <div className="sc-section-title">Post Type</div>
            <div className="sc-type-row">
              {(['story', 'spotlight', 'ad'] as PostType[]).map(t => (
                <button
                  key={t}
                  className={`sc-type-btn${draft.postType === t ? ' sc-type-btn--active' : ''}`}
                  onClick={() => update('postType', t)}
                  type="button"
                >
                  {t === 'story' && '📸 Story'}
                  {t === 'spotlight' && '🌟 Spotlight'}
                  {t === 'ad' && '📣 Ad'}
                </button>
              ))}
            </div>
          </section>

          {/* Media */}
          {draft.postType !== 'ad' && (
            <section className="sc-section">
              <div className="sc-section-title">
                {draft.postType === 'spotlight' ? 'Video (required)' : 'Photo or Video ≤60s'}
              </div>
              <MediaDropZone
                items={draft.media}
                onChange={items => update('media', items)}
                maxItems={draft.postType === 'story' ? 1 : 1}
                accept={draft.postType === 'spotlight' ? 'video/*' : 'image/*,video/*'}
                aspectHint="9:16 (1080×1920px)"
              />
            </section>
          )}

          {/* Story-specific */}
          {draft.postType === 'story' && (
            <>
              <section className="sc-section">
                <div className="sc-section-header">
                  <div className="sc-section-title">Caption Overlay</div>
                </div>
                <textarea
                  className="sc-textarea"
                  rows={2}
                  placeholder="Caption shown on your story…"
                  value={draft.caption}
                  onChange={e => update('caption', e.target.value)}
                />
                <div className="sc-color-row">
                  <div className="sc-color-label">Text color</div>
                  <div className="sc-color-swatches">
                    {(['white', 'black', 'yellow', 'rainbow'] as CaptionColor[]).map(c => (
                      <button
                        key={c}
                        className={`sc-color-swatch sc-color-swatch--${c}${draft.captionColor === c ? ' sc-color-swatch--active' : ''}`}
                        onClick={() => update('captionColor', c)}
                        type="button"
                        title={c}
                        aria-label={c}
                      />
                    ))}
                  </div>
                </div>
              </section>

              <section className="sc-section">
                <div className="sc-section-title">Swipe Up Link</div>
                <input
                  className="sc-input"
                  type="url"
                  placeholder="https://yoursite.com"
                  value={draft.swipeUpLink}
                  onChange={e => update('swipeUpLink', e.target.value)}
                />
              </section>

              <section className="sc-section">
                <div className="sc-section-title">Photo Duration</div>
                <div className="sc-duration-chips">
                  {([3, 5, 7, 10] as PhotoDuration[]).map(d => (
                    <button
                      key={d}
                      className={`sc-duration-chip${draft.photoDuration === d ? ' sc-duration-chip--active' : ''}`}
                      onClick={() => update('photoDuration', d)}
                      type="button"
                    >
                      {d}s
                    </button>
                  ))}
                </div>
                <div className="sc-field-hint">For photo stories only — videos play for their full duration</div>
              </section>

              <section className="sc-section">
                <div className="sc-section-title">Emoji Stickers</div>
                <div className="sc-emoji-grid">
                  {STORY_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      className={`sc-emoji-btn${draft.storyEmojis.includes(emoji) ? ' sc-emoji-btn--active' : ''}`}
                      onClick={() => toggleEmoji(emoji)}
                      type="button"
                      aria-label={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </section>

              <section className="sc-section">
                <div className="sc-section-title">Audience</div>
                <div className="sc-audience-row">
                  {(['public', 'friends'] as StoryAudience[]).map(a => (
                    <button
                      key={a}
                      className={`sc-audience-btn${draft.storyAudience === a ? ' sc-audience-btn--active' : ''}`}
                      onClick={() => update('storyAudience', a)}
                      type="button"
                    >
                      {a === 'public' ? '🌍 Public' : '👥 Friends Only'}
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Spotlight-specific */}
          {draft.postType === 'spotlight' && (
            <>
              <section className="sc-section">
                <div className="sc-section-header">
                  <div className="sc-section-title">Caption</div>
                  <CharCount value={draft.spotlightCaption} max={250} />
                </div>
                <textarea
                  className="sc-textarea"
                  rows={3}
                  placeholder="Caption for your Spotlight video…"
                  value={draft.spotlightCaption}
                  maxLength={250}
                  onChange={e => update('spotlightCaption', e.target.value)}
                />
              </section>

              <section className="sc-section">
                <div className="sc-section-title">Options</div>
                <div className="sc-toggles">
                  <Toggle checked={draft.soundEnabled} onChange={v => update('soundEnabled', v)} label="Sound on" />
                  <Toggle checked={draft.allowRemix} onChange={v => update('allowRemix', v)} label="Allow Remix" />
                </div>
              </section>

              <section className="sc-section">
                <div className="sc-section-title">Topic Tags (max 5)</div>
                <div className="sc-topics-grid">
                  {SPOTLIGHT_TOPICS.map(topic => (
                    <button
                      key={topic}
                      className={`sc-topic-btn${draft.topicTags.includes(topic) ? ' sc-topic-btn--active' : ''}`}
                      onClick={() => toggleTopic(topic)}
                      type="button"
                      disabled={!draft.topicTags.includes(topic) && draft.topicTags.length >= 5}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
                {draft.topicTags.length > 0 && (
                  <div className="sc-topic-selected">
                    Selected: {draft.topicTags.join(', ')}
                  </div>
                )}
              </section>
            </>
          )}

          {/* Ad-specific */}
          {draft.postType === 'ad' && (
            <>
              <section className="sc-section">
                <div className="sc-ad-notice">
                  <span className="sc-ad-notice-icon">ℹ️</span>
                  An Ads Manager account is required to publish Snapchat Ads. Connect your account in Settings → Social Connections.
                </div>
              </section>

              <section className="sc-section">
                <div className="sc-section-title">Ad Type</div>
                <div className="sc-ad-type-grid">
                  {(['single_image', 'single_video', 'story_ad', 'collection_ad'] as AdType[]).map(t => (
                    <button
                      key={t}
                      className={`sc-ad-type-btn${draft.adType === t ? ' sc-ad-type-btn--active' : ''}`}
                      onClick={() => update('adType', t)}
                      type="button"
                    >
                      {AD_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </section>

              <section className="sc-section">
                <div className="sc-section-header">
                  <div className="sc-section-title">Headline</div>
                  <CharCount value={draft.adHeadline} max={34} />
                </div>
                <input
                  className="sc-input"
                  type="text"
                  placeholder="Headline (34 chars max)…"
                  value={draft.adHeadline}
                  maxLength={34}
                  onChange={e => update('adHeadline', e.target.value)}
                />
              </section>

              <section className="sc-section">
                <div className="sc-section-header">
                  <div className="sc-section-title">Brand Name</div>
                  <CharCount value={draft.brandName} max={25} />
                </div>
                <input
                  className="sc-input"
                  type="text"
                  placeholder="Your brand name (25 chars max)…"
                  value={draft.brandName}
                  maxLength={25}
                  onChange={e => update('brandName', e.target.value)}
                />
              </section>

              <section className="sc-section">
                <div className="sc-section-title">Call to Action</div>
                <div className="sc-cta-grid">
                  {(['buy_now', 'learn_more', 'download', 'sign_up', 'watch_more'] as CTA[]).map(c => (
                    <button
                      key={c}
                      className={`sc-cta-btn${draft.cta === c ? ' sc-cta-btn--active' : ''}`}
                      onClick={() => update('cta', c)}
                      type="button"
                    >
                      {CTA_LABELS[c]}
                    </button>
                  ))}
                </div>
              </section>

              <section className="sc-section">
                <div className="sc-section-title">Ad Media</div>
                <MediaDropZone
                  items={draft.media}
                  onChange={items => update('media', items)}
                  maxItems={draft.adType === 'collection_ad' ? 10 : 1}
                  accept="image/*,video/*"
                  aspectHint="9:16 (1080×1920px)"
                />
              </section>
            </>
          )}

          {/* Schedule */}
          <section className="sc-section">
            <div className="sc-section-title">Schedule</div>
            <ScheduleCalendar
              value={draft.scheduledAt}
              onChange={d => update('scheduledAt', d)}
              bestTimes={SC_BEST_TIMES}
              platform="Snapchat"
            />
          </section>

          {/* Publish */}
          <div className="sc-publish-row">
            <button
              className="sc-publish-btn"
              onClick={publish}
              disabled={publishing || !canPublish}
              type="button"
            >
              {publishing ? (
                <><span className="sc-spinner" /> Publishing to Snapchat…</>
              ) : (
                <>
                  <SnapGhost size={14} color="#000" />
                  Publish to Snapchat
                </>
              )}
            </button>
          </div>

          {publishResult && (
            <div className={`sc-result${publishResult.ok ? ' sc-result--ok' : ' sc-result--err'}`}>
              {publishResult.message}
            </div>
          )}
        </div>

        {/* Right: phone mock + checklist */}
        <div className="sc-preview-col">
          <div className="sc-preview-label">Live Preview · Snapchat</div>
          <SnapchatPhoneMock draft={draft} />

          <div className="sc-checklist">
            <div className="sc-checklist-title">Partner Readiness</div>
            <CheckItem ok={false} label="Public Profile created" />
            <CheckItem ok={false} label="Lens Studio account" />
            <CheckItem ok={false} label="100+ subscribers" />
            <CheckItem ok={false} label="Ads Manager account linked" />
            <CheckItem ok={false} label="Pixel helper installed" />
            <CheckItem ok={false} label="No Community Guidelines strikes" />
            <CheckItem ok={false} label="Brand Safety category set" />
          </div>
        </div>
      </div>
    </div>
  )
}
