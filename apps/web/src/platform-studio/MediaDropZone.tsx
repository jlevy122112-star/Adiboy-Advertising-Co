export interface MediaItem {
  id: string
  file?: File
  url: string
  alt: string
  altText?: string
  name?: string
  type: 'image' | 'video'
}

interface Props {
  items: MediaItem[]
  onChange: (items: MediaItem[]) => void
  maxItems?: number
  accept?: string
  aspectHint?: string
}

export function MediaDropZone({ items, onChange, maxItems = 10, accept = 'image/*,video/*', aspectHint }: Props) {
  function handleFiles(files: FileList | null) {
    if (!files) return
    const newItems: MediaItem[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file) continue
      newItems.push({
        id: Math.random().toString(36).slice(2),
        file,
        url: URL.createObjectURL(file),
        alt: file.name,
        altText: file.name,
        name: file.name,
        type: file.type.startsWith('video') ? 'video' : 'image',
      })
    }
    onChange([...items, ...newItems].slice(0, maxItems))
  }

  return (
    <div
      style={{ border: '2px dashed rgba(255,255,255,0.15)', borderRadius: 10, padding: 20, textAlign: 'center', color: '#888', cursor: 'pointer', position: 'relative' }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
    >
      {aspectHint && <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>{aspectHint}</div>}
      <input
        type="file"
        multiple
        accept={accept}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
        onChange={e => handleFiles(e.target.files)}
      />
      {items.length === 0
        ? <span>Drop files here or click to upload</span>
        : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {items.map(item => (
              <div key={item.id} style={{ position: 'relative' }}>
                <img src={item.url} alt={item.alt} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6 }} />
                <button
                  type="button"
                  onClick={() => onChange(items.filter(i => i.id !== item.id))}
                  style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer' }}
                >×</button>
              </div>
            ))}
            {items.length < maxItems && <span style={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 6, fontSize: 24, color: '#666' }}>+</span>}
          </div>
        )
      }
    </div>
  )
}
