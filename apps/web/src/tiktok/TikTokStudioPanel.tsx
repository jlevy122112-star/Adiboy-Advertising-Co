/**
 * TikTok Creative Studio — Creative Partner + Content Management Partner.
 *
 * Generates TikTok-optimized content:
 *   - Vertical video (9:16) format with duration targets
 *   - AI caption generator with hashtag builder
 *   - Privacy level, duet/stitch/comment controls
 *   - Branded content disclosure
 *   - Trending hashtag suggestions
 *   - Direct publish or schedule via campaign
 */

import { useState, useCallback, useEffect } from 'react'
import { useContentBrief } from '../generation/ContentBriefContext'
import { apiFetch } from '../hooks/useApi'
import './tiktok-studio.css'

const CAMPAIGN_API = (import.meta.env.VITE_CAMPAIGN_API_ORIGIN as string | undefined) ?? 'http://localhost:8801'

type PrivacyLevel = 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY'
type ContentFormat = 'video' | 'photo_carousel'
type DurationTarget = 15 | 30 | 60 | 180 | 600

interface TikTokPost {
  format: ContentFormat
  durationTarget: DurationTarget
  caption: string
  hashtags: string[]
  privacyLevel: PrivacyLevel
  duetEnabled: boolean
  stitchEnabled: boolean
  commentEnabled: boolean
  brandedContent: boolean
  brandOrganicToggle: boolean
  imageUrl: string
  videoUrl: string
  soundCredit: string
}

const PRIVACY_OPTIONS: Array<{ value: PrivacyLevel; label: string; desc: string }> = [
  { value: 'PUBLIC_TO_EVERYONE', label: 'Public', desc: 'Anyone on TikTok' },
  { value: 'MUTUAL_FOLLOW_FRIENDS', label: 'Friends', desc: 'Mutual followers' },
  { value: 'FOLLOWER_OF_CREATOR', label: 'Followers', desc: 'Your followers only' },
  { value: 'SELF_ONLY', label: 'Private', desc: 'Only you' },
]

const DURATION_OPTIONS: Array<{ value: DurationTarget; label: string }> = [
  { value: 15,  label: '15 s' },
  { value: 30,  label: '30 s' },
  { value: 60,  label: '60 s' },
  { value: 180, label: '3 min' },
  { value: 600, label: '10 min' },
]

const TRENDING_HASHTAGS = [
  'fyp', 'foryou', 'foryoupage', 'trending', 'viral',
  'smallbusiness', 'entrepreneur', 'marketing', 'growthhack',
  'contentcreator', 'socialmedia', 'digitalmarketing',
  'brandawareness', 'tiktokmarketing', 'businesstips',
]

const CAPTION_MAX = 2200

function CharCount({ value, max }: { value: string; max: number }) {
  const pct = value.length / max
  const color = pct > 0.9 ? 'var(--danger)' : pct > 0.75 ? 'var(--warning)' : 'var(--text-muted)'
  return (
    <span className="tt-char-count" style={{ color }}>
      {value.length}/{max}
    </span>
  )
}

function HashtagPill({ tag, onRemove }: { tag: string; onRemove: () => void }) {
  return (
    <span className="tt-hashtag-pill">
      #{tag}
      <button className="tt-hashtag-remove" onClick={onRemove} aria-label={`Remove #${tag}`}>×</button>
    </span>
  )
}

function TrendingTag({ tag, active, onToggle }: { tag: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      className={`tt-trending-tag${active ? ' tt-trending-tag--active' : ''}`}
      onClick={onToggle}
      type="button"
    >
      #{tag}
    </button>
  )
}

function VerticalPreview({ caption, hashtags, imageUrl }: { caption: string; hashtags: string[]; imageUrl: string }) {
  const displayCaption = caption.slice(0, 120) + (caption.length > 120 ? '…' : '')
  const tagLine = hashtags.slice(0, 5).map(t => `#${t}`).join(' ')

  return (
    <div className="tt-preview">
      <div className="tt-preview-phone">
        <div className="tt-preview-screen">
          {imageUrl ? (
            <img src={imageUrl} alt="Preview" className="tt-preview-img" />
          ) : (
            <div className="tt-preview-placeholder">
              <span className="tt-preview-placeholder-icon">▶</span>
              <span className="tt-preview-placeholder-text">9:16 Preview</span>
            </div>
          )}
          <div className="tt-preview-overlay">
            <div className="tt-preview-ui">
              <div className="tt-preview-sidebar">
                <div className="tt-preview-action">❤</div>
                <div className="tt-preview-action">💬</div>
                <div className="tt-preview-action">➤</div>
                <div className="tt-preview-action">⚑</div>
              </div>
              <div className="tt-preview-caption">
                <div className="tt-preview-handle">@marketer_pro</div>
                <div className="tt-preview-text">{displayCaption}</div>
                {tagLine && <div className="tt-preview-tags">{tagLine}</div>}
                <div className="tt-preview-sound">♪ Original sound</div>
              </div>
            </div>
          </div>
        </div>
        <div className="tt-preview-notch" />
        <div className="tt-preview-home" />
      </div>
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="tt-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="tt-toggle-input"
      />
      <span className="tt-toggle-track">
        <span className="tt-toggle-thumb" />
      </span>
      <span className="tt-toggle-label">{label}</span>
    </label>
  )
}

const DEFAULT_POST: TikTokPost = {
  format: 'video',
  durationTarget: 30,
  caption: '',
  hashtags: ['fyp', 'trending'],
  privacyLevel: 'PUBLIC_TO_EVERYONE',
  duetEnabled: true,
  stitchEnabled: true,
  commentEnabled: true,
  brandedContent: false,
  brandOrganicToggle: false,
  imageUrl: '',
  videoUrl: '',
  soundCredit: '',
}

export function TikTokStudioPanel() {
  const [post, setPost] = useState<TikTokPost>(DEFAULT_POST)
  const { briefId, adaptation, isSelected } = useContentBrief('tiktok')
  useEffect(() => {
    if (!briefId || !adaptation || !isSelected) return
    const body = [adaptation.copy.headline, adaptation.copy.body, adaptation.copy.cta].filter(Boolean).join('\n\n')
    setPost(p => ({ ...p, caption: body.slice(0, CAPTION_MAX), hashtags: adaptation.copy.hashtags ?? p.hashtags }))
  }, [briefId, adaptation, isSelected])

  const [hashtagInput, setHashtagInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<{ ok: boolean; message: string } | null>(null)

  function update<K extends keyof TikTokPost>(key: K, value: TikTokPost[K]) {
    setPost(p => ({ ...p, [key]: value }))
  }

  function addHashtag(tag: string) {
    const clean = tag.replace(/^#+/, '').trim().toLowerCase().replace(/\s+/g, '_')
    if (!clean || post.hashtags.includes(clean) || post.hashtags.length >= 30) return
    update('hashtags', [...post.hashtags, clean])
  }

  function removeHashtag(tag: string) {
    update('hashtags', post.hashtags.filter(t => t !== tag))
  }

  function onHashtagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault()
      addHashtag(hashtagInput)
      setHashtagInput('')
    }
  }

  const captionWithTags = post.caption + (post.hashtags.length ? '\n' + post.hashtags.map(t => `#${t}`).join(' ') : '')

  const generateCaption = useCallback(async () => {
    setGenerating(true)
    const r = await apiFetch<{ caption: string; hashtags: string[] }>(
      `${CAMPAIGN_API}/ai/tiktok-caption`,
      {
        method: 'POST',
        json: {
          durationTarget: post.durationTarget,
          format: post.format,
          existingHashtags: post.hashtags,
        },
      }
    )
    if (r.ok) {
      if (r.data.caption) update('caption', r.data.caption)
      if (r.data.hashtags?.length) {
        const merged = [...new Set([...post.hashtags, ...r.data.hashtags])].slice(0, 30)
        update('hashtags', merged)
      }
    }
    setGenerating(false)
  }, [post.durationTarget, post.format, post.hashtags])

  async function publish() {
    if (!captionWithTags.trim()) return
    setPublishing(true)
    setPublishResult(null)

    const r = await apiFetch<{ ok: boolean; publishId?: string; detail?: string }>(
      `${CAMPAIGN_API}/tiktok/publish`,
      {
        method: 'POST',
        json: {
          format: post.format,
          caption: captionWithTags.slice(0, CAPTION_MAX),
          privacyLevel: post.privacyLevel,
          duetEnabled: post.duetEnabled,
          stitchEnabled: post.stitchEnabled,
          commentEnabled: post.commentEnabled,
          brandedContent: post.brandedContent,
          imageUrl: post.imageUrl || undefined,
          videoUrl: post.videoUrl || undefined,
        },
      }
    )

    if (r.ok && r.data.ok) {
      setPublishResult({ ok: true, message: `Published! TikTok ID: ${r.data.publishId ?? '—'}` })
      setPost(DEFAULT_POST)
    } else {
      setPublishResult({ ok: false, message: r.data?.detail ?? 'Publish failed — check your TikTok connection.' })
    }
    setPublishing(false)
  }

  const totalChars = captionWithTags.length
  const overLimit = totalChars > CAPTION_MAX

  return (
    <div className="tt-root">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="tt-header">
        <div className="tt-header-left">
          <div className="tt-logo">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.02a8.17 8.17 0 004.78 1.52V7.1a4.85 4.85 0 01-1.01-.41z" />
            </svg>
          </div>
          <div>
            <div className="tt-title">TikTok Creative Studio</div>
            <div className="tt-subtitle">Creative Partner · Content Management Partner</div>
          </div>
        </div>
        <div className="tt-partner-badges">
          <span className="tt-badge tt-badge--creative">Creative</span>
          <span className="tt-badge tt-badge--mgmt">Content Mgmt</span>
        </div>
      </div>

      <div className="tt-layout">
        {/* ── Left: editor ─────────────────────────────────────────── */}
        <div className="tt-editor">
          {/* Format + Duration */}
          <section className="tt-section">
            <div className="tt-section-title">Format</div>
            <div className="tt-format-row">
              {(['video', 'photo_carousel'] as ContentFormat[]).map(f => (
                <button
                  key={f}
                  className={`tt-format-btn${post.format === f ? ' tt-format-btn--active' : ''}`}
                  onClick={() => update('format', f)}
                >
                  {f === 'video' ? '▶ Video' : '⊞ Photo Carousel'}
                </button>
              ))}
            </div>

            {post.format === 'video' && (
              <div className="tt-duration-row">
                <div className="tt-field-label">Target duration</div>
                <div className="tt-duration-chips">
                  {DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={`tt-duration-chip${post.durationTarget === opt.value ? ' tt-duration-chip--active' : ''}`}
                      onClick={() => update('durationTarget', opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Media URL */}
          <section className="tt-section">
            <div className="tt-section-title">
              {post.format === 'video' ? 'Video URL' : 'Image URL(s)'}
            </div>
            <input
              className="tt-input"
              type="url"
              placeholder={post.format === 'video' ? 'https://…/video.mp4' : 'https://…/image.jpg'}
              value={post.format === 'video' ? post.videoUrl : post.imageUrl}
              onChange={e => update(post.format === 'video' ? 'videoUrl' : 'imageUrl', e.target.value)}
            />
            {post.format === 'video' && (
              <div className="tt-field-hint">MP4 recommended · 9:16 ratio · up to 1 GB</div>
            )}
          </section>

          {/* Caption */}
          <section className="tt-section">
            <div className="tt-section-header">
              <div className="tt-section-title">Caption</div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <CharCount value={captionWithTags} max={CAPTION_MAX} />
                <button
                  className="tt-ai-btn"
                  onClick={generateCaption}
                  disabled={generating}
                >
                  {generating ? (
                    <><span className="tt-spinner" /> Generating…</>
                  ) : (
                    <>⚡ AI Caption</>
                  )}
                </button>
              </div>
            </div>
            <textarea
              className={`tt-textarea${overLimit ? ' tt-textarea--error' : ''}`}
              rows={4}
              placeholder="Write a compelling caption that hooks viewers in the first 3 seconds…"
              value={post.caption}
              onChange={e => update('caption', e.target.value)}
            />
            {overLimit && (
              <div className="tt-field-error">Caption + hashtags exceed 2,200 character limit</div>
            )}
          </section>

          {/* Hashtags */}
          <section className="tt-section">
            <div className="tt-section-title">Hashtags</div>
            <div className="tt-hashtag-input-row">
              <span className="tt-hashtag-prefix">#</span>
              <input
                className="tt-hashtag-input"
                placeholder="Add tag, press Enter…"
                value={hashtagInput}
                onChange={e => setHashtagInput(e.target.value)}
                onKeyDown={onHashtagKeyDown}
                maxLength={100}
              />
              <button
                className="tt-hashtag-add-btn"
                onClick={() => { addHashtag(hashtagInput); setHashtagInput('') }}
                disabled={!hashtagInput.trim()}
              >
                Add
              </button>
            </div>

            {post.hashtags.length > 0 && (
              <div className="tt-hashtag-pills">
                {post.hashtags.map(tag => (
                  <HashtagPill key={tag} tag={tag} onRemove={() => removeHashtag(tag)} />
                ))}
              </div>
            )}

            <div className="tt-trending-label">Trending</div>
            <div className="tt-trending-tags">
              {TRENDING_HASHTAGS.map(tag => (
                <TrendingTag
                  key={tag}
                  tag={tag}
                  active={post.hashtags.includes(tag)}
                  onToggle={() => post.hashtags.includes(tag) ? removeHashtag(tag) : addHashtag(tag)}
                />
              ))}
            </div>
          </section>

          {/* Sound credit */}
          <section className="tt-section">
            <div className="tt-section-title">Sound / Music Credit</div>
            <input
              className="tt-input"
              type="text"
              placeholder="e.g. Original sound by @username"
              value={post.soundCredit}
              onChange={e => update('soundCredit', e.target.value)}
            />
            <div className="tt-field-hint">Optional — helps with attribution and discovery</div>
          </section>

          {/* Privacy */}
          <section className="tt-section">
            <div className="tt-section-title">Who can view</div>
            <div className="tt-privacy-grid">
              {PRIVACY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`tt-privacy-btn${post.privacyLevel === opt.value ? ' tt-privacy-btn--active' : ''}`}
                  onClick={() => update('privacyLevel', opt.value)}
                >
                  <div className="tt-privacy-label">{opt.label}</div>
                  <div className="tt-privacy-desc">{opt.desc}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Interaction controls */}
          <section className="tt-section">
            <div className="tt-section-title">Interactions</div>
            <div className="tt-toggles">
              <Toggle checked={post.duetEnabled} onChange={v => update('duetEnabled', v)} label="Allow Duet" />
              <Toggle checked={post.stitchEnabled} onChange={v => update('stitchEnabled', v)} label="Allow Stitch" />
              <Toggle checked={post.commentEnabled} onChange={v => update('commentEnabled', v)} label="Allow Comments" />
            </div>
          </section>

          {/* Branded content disclosure */}
          <section className="tt-section">
            <div className="tt-section-title">Branded Content</div>
            <div className="tt-branded-info">
              TikTok requires disclosure for paid partnerships or brand promotions.
            </div>
            <div className="tt-toggles">
              <Toggle
                checked={post.brandedContent}
                onChange={v => update('brandedContent', v)}
                label="Paid partnership / Sponsored"
              />
              <Toggle
                checked={post.brandOrganicToggle}
                onChange={v => update('brandOrganicToggle', v)}
                label="Organic brand promotion"
              />
            </div>
          </section>

          {/* Publish */}
          <div className="tt-publish-row">
            <button
              className="tt-publish-btn"
              onClick={publish}
              disabled={publishing || overLimit || !captionWithTags.trim()}
            >
              {publishing ? (
                <><span className="tt-spinner" /> Publishing to TikTok…</>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ flexShrink: 0 }}>
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.02a8.17 8.17 0 004.78 1.52V7.1a4.85 4.85 0 01-1.01-.41z" />
                  </svg>
                  Publish to TikTok
                </>
              )}
            </button>
          </div>

          {publishResult && (
            <div className={`tt-result${publishResult.ok ? ' tt-result--ok' : ' tt-result--err'}`}>
              {publishResult.message}
            </div>
          )}
        </div>

        {/* ── Right: preview ───────────────────────────────────────── */}
        <div className="tt-preview-col">
          <div className="tt-preview-label">Live Preview · 9:16</div>
          <VerticalPreview
            caption={post.caption}
            hashtags={post.hashtags}
            imageUrl={post.format === 'video' ? '' : post.imageUrl}
          />

          {/* Partner eligibility checklist */}
          <div className="tt-checklist">
            <div className="tt-checklist-title">Partner Readiness</div>
            <CheckItem ok={post.caption.length > 0} label="Caption written" />
            <CheckItem ok={post.hashtags.length >= 3} label="3+ hashtags" />
            <CheckItem ok={post.format === 'video' ? !!post.videoUrl : !!post.imageUrl} label="Media URL provided" />
            <CheckItem ok={post.privacyLevel === 'PUBLIC_TO_EVERYONE'} label="Public visibility" />
            <CheckItem ok={!post.brandedContent || (post.brandedContent)} label="Disclosure complete" />
            <CheckItem ok={!overLimit} label="Within 2,200 char limit" />
          </div>
        </div>
      </div>
    </div>
  )
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`tt-check-item${ok ? ' tt-check-item--ok' : ''}`}>
      <span className="tt-check-icon">{ok ? '✓' : '○'}</span>
      <span className="tt-check-label">{label}</span>
    </div>
  )
}
