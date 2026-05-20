import { useState, useRef, type KeyboardEvent } from 'react'
import './HashtagBuilder.css'

export interface HashtagBuilderProps {
  tags: string[]
  onChange: (tags: string[]) => void
  maxTags?: number
  suggestions?: string[]       // trending / AI-suggested tags
  platform?: string
  className?: string
}

function clean(raw: string) {
  return raw.replace(/^#+/, '').replace(/\s+/g, '').toLowerCase()
}

export function HashtagBuilder({
  tags,
  onChange,
  maxTags = 30,
  suggestions = [],
  platform,
  className = '',
}: HashtagBuilderProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function add(raw: string) {
    const tag = clean(raw)
    if (!tag || tags.includes(tag) || tags.length >= maxTags) return
    onChange([...tags, tag])
    setInput('')
  }

  function remove(tag: string) {
    onChange(tags.filter(t => t !== tag))
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault()
      add(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  const filtered = suggestions.filter(s => !tags.includes(clean(s)))

  return (
    <div className={`hb-root ${className}`}>
      <div
        className="hb-field"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map(tag => (
          <span key={tag} className="hb-tag">
            <span className="hb-tag-hash">#</span>{tag}
            <button
              className="hb-tag-remove"
              onClick={e => { e.stopPropagation(); remove(tag) }}
              aria-label={`Remove #${tag}`}
            >×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="hb-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => input && add(input)}
          placeholder={tags.length === 0 ? 'Add hashtags…' : ''}
          disabled={tags.length >= maxTags}
        />
      </div>

      <div className="hb-meta">
        <span className="hb-count">
          {tags.length}/{maxTags}
          {platform && <span className="hb-platform"> · {platform}</span>}
        </span>
        {tags.length > 0 && (
          <button className="hb-clear" onClick={() => onChange([])}>Clear all</button>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="hb-suggestions">
          <span className="hb-sugg-label">Trending</span>
          <div className="hb-sugg-list">
            {filtered.slice(0, 12).map(s => (
              <button
                key={s}
                className="hb-sugg-pill"
                onClick={() => add(s)}
                disabled={tags.length >= maxTags}
              >
                <span className="hb-sugg-plus">+</span>#{clean(s)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
