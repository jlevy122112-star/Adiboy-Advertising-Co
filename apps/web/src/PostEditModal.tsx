import type { PlannedPost } from './calendar/calendarTypes.js'
import type { CalendarApiConfig } from './calendar/calendarApi.js'

interface Props {
  post: PlannedPost
  dayKey: string
  onClose: () => void
  onSaved: (id: string, newTitle: string, network: PlannedPost['network']) => void
  onDeleted: (id: string, dayKey: string) => void
  apiConfig: CalendarApiConfig | null
}

export function PostEditModal({ post, dayKey, onClose, onSaved, onDeleted, apiConfig: _apiConfig }: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#1a1a2e', borderRadius: 16, padding: 24, minWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, color: '#e8e8f0', fontSize: 16 }}>Edit Post</span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>{post.title}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => { onSaved(post.id, post.title, post.network); onClose() }}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontSize: 13 }}
          >Save</button>
          <button
            type="button"
            onClick={() => { if (window.confirm('Delete this post?')) { onDeleted(post.id, dayKey); onClose() } }}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,80,80,0.4)', background: 'transparent', color: '#ff5050', cursor: 'pointer', fontSize: 13 }}
          >Delete</button>
        </div>
      </div>
    </div>
  )
}
