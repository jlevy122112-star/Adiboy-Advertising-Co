import { useState } from 'react'

interface Props {
  tags: string[]
  onChange: (tags: string[]) => void
  max?: number
  maxTags?: number
  platform?: string
  suggestions?: string[]
}

export function HashtagBuilder({ tags, onChange, max, maxTags, platform: _platform, suggestions = [] }: Props) {
  const limit = maxTags ?? max ?? 30
  const [input, setInput] = useState('')

  function add(raw: string) {
    const tag = raw.replace(/^#/, '').trim()
    if (!tag || tags.includes(tag) || tags.length >= limit) return
    onChange([...tags, tag])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input) } }}
          placeholder={`Add hashtag (${tags.length}/${limit})`}
          style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#e8e8f0', fontSize: 13 }}
        />
        <button
          type="button"
          onClick={() => add(input)}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.08)', color: '#e8e8f0', cursor: 'pointer', fontSize: 13 }}
        >Add</button>
      </div>
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {suggestions.slice(0, 8).filter(s => !tags.includes(s)).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#888', cursor: 'pointer', fontSize: 11 }}
            >+{s}</button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {tags.map(tag => (
          <span
            key={tag}
            style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(124,58,237,0.15)', color: '#c084fc', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            #{tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter(t => t !== tag))}
              style={{ background: 'none', border: 'none', color: '#c084fc', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}
            >×</button>
          </span>
        ))}
      </div>
    </div>
  )
}
