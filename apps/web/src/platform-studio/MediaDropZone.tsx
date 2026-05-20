import { useRef, useState, useCallback, type ReactNode } from 'react'
import './MediaDropZone.css'

export type MediaItem = {
  id: string
  url: string       // objectURL or remote URL
  type: 'image' | 'video'
  file?: File
  altText: string
  name: string
}

function mkId() { return Math.random().toString(36).slice(2, 10) }

function fileToMediaItem(file: File): Promise<MediaItem> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const type = file.type.startsWith('video/') ? 'video' : 'image'
    resolve({ id: mkId(), url, type, file, altText: '', name: file.name })
  })
}

interface DropZoneProps {
  items: MediaItem[]
  onChange: (items: MediaItem[]) => void
  maxItems?: number
  accept?: string
  aspectHint?: string   // e.g. "1:1 or 4:5"
  placeholder?: string
  className?: string
  children?: ReactNode
}

export function MediaDropZone({
  items,
  onChange,
  maxItems = 10,
  accept = 'image/*,video/*',
  aspectHint,
  placeholder = 'Drop media here or click to browse',
  className = '',
}: DropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const addFiles = useCallback(async (files: File[]) => {
    const eligible = files
      .filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))
      .slice(0, maxItems - items.length)
    if (!eligible.length) return
    const newItems = await Promise.all(eligible.map(fileToMediaItem))
    onChange([...items, ...newItems])
  }, [items, maxItems, onChange])

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current++
    if (dragCounter.current === 1) setDragging(true)
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }
  function onDragOver(e: React.DragEvent) { e.preventDefault() }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current = 0
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    void addFiles(files)
  }
  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    void addFiles(files)
    e.target.value = ''
  }

  const isEmpty = items.length === 0
  const atMax = items.length >= maxItems

  return (
    <div className={`mdz-root ${className}`}>
      {isEmpty ? (
        <div
          className={`mdz-zone${dragging ? ' mdz-zone--over' : ''}`}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
          aria-label="Upload media"
        >
          <div className="mdz-zone-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
              <path d="M12 12v9M8 17l4-4 4 4" />
            </svg>
          </div>
          <div className="mdz-zone-text">{dragging ? 'Drop to add' : placeholder}</div>
          {aspectHint && <div className="mdz-zone-hint">{aspectHint}</div>}
        </div>
      ) : (
        <SortableMediaGrid
          items={items}
          onChange={onChange}
          onAddMore={!atMax ? () => inputRef.current?.click() : undefined}
          maxItems={maxItems}
          dragging={dragging}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        />
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={maxItems > 1}
        style={{ display: 'none' }}
        onChange={onInputChange}
      />
    </div>
  )
}

interface GridProps {
  items: MediaItem[]
  onChange: (items: MediaItem[]) => void
  onAddMore?: () => void
  maxItems: number
  dragging: boolean
  onDragEnter: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}

function SortableMediaGrid({ items, onChange, onAddMore, maxItems, dragging, onDragEnter, onDragLeave, onDragOver, onDrop }: GridProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const [editAlt, setEditAlt] = useState<number | null>(null)

  function onItemDragStart(e: React.DragEvent, i: number) {
    setDragIdx(i)
    e.dataTransfer.effectAllowed = 'move'
  }
  function onItemDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    e.stopPropagation()
    if (i !== overIdx) setOverIdx(i)
  }
  function onItemDrop(e: React.DragEvent, targetIdx: number) {
    e.stopPropagation()
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); setOverIdx(null); return }
    const next = [...items]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(targetIdx, 0, moved)
    onChange(next)
    setDragIdx(null)
    setOverIdx(null)
  }
  function onItemDragEnd() { setDragIdx(null); setOverIdx(null) }

  function removeItem(i: number) {
    const item = items[i]
    if (item?.file) URL.revokeObjectURL(item.url)
    onChange(items.filter((_, idx) => idx !== i))
  }

  function updateAlt(i: number, text: string) {
    const next = items.map((it, idx) => idx === i ? { ...it, altText: text } : it)
    onChange(next)
  }

  return (
    <div
      className={`mdz-grid${dragging ? ' mdz-grid--over' : ''}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {items.map((item, i) => (
        <div
          key={item.id}
          className={`mdz-thumb${dragIdx === i ? ' mdz-thumb--dragging' : ''}${overIdx === i && dragIdx !== i ? ' mdz-thumb--over' : ''}`}
          draggable
          onDragStart={e => onItemDragStart(e, i)}
          onDragOver={e => onItemDragOver(e, i)}
          onDrop={e => onItemDrop(e, i)}
          onDragEnd={onItemDragEnd}
        >
          {item.type === 'image'
            ? <img src={item.url} alt={item.altText || item.name} className="mdz-thumb-img" />
            : <video src={item.url} className="mdz-thumb-img" muted />
          }
          {i === 0 && <span className="mdz-cover-badge">Cover</span>}
          <div className="mdz-thumb-actions">
            <button
              className="mdz-thumb-btn mdz-thumb-btn--alt"
              title="Edit alt text"
              onClick={() => setEditAlt(editAlt === i ? null : i)}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
            <button
              className="mdz-thumb-btn mdz-thumb-btn--remove"
              title="Remove"
              onClick={() => removeItem(i)}
            >×</button>
          </div>
          <div className="mdz-drag-handle" title="Drag to reorder">⠿</div>
          {editAlt === i && (
            <div className="mdz-alt-editor" onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                className="mdz-alt-input"
                placeholder="Alt text for accessibility…"
                value={item.altText}
                onChange={e => updateAlt(i, e.target.value)}
                onBlur={() => setEditAlt(null)}
                onKeyDown={e => e.key === 'Enter' && setEditAlt(null)}
                maxLength={250}
              />
            </div>
          )}
        </div>
      ))}
      {onAddMore && (
        <button className="mdz-add-btn" onClick={onAddMore} title={`Add media (${items.length}/${maxItems})`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
    </div>
  )
}
