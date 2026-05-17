import { useState, useEffect, useCallback } from 'react'
import './team.css'

const API_ORIGIN = (import.meta.env.VITE_TEAM_API_ORIGIN as string | undefined) ?? 'http://localhost:8806'

type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'client'
type MemberStatus = 'active' | 'invited' | 'suspended'
type ReviewStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'changes_requested'
type NotifType = string

interface Member {
  id: string; userId: string; email: string; displayName: string;
  role: WorkspaceRole; status: MemberStatus; invitedAt: string; joinedAt: string | null;
}

interface Assignment {
  id: string; entityType: string; entityId: string; assigneeId: string;
  dueAt: string | null; status: ReviewStatus; note: string | null; createdAt: string;
}

interface Approval {
  id: string; entityType: string; entityId: string; step: number; reviewerId: string;
  status: ReviewStatus; comment: string | null; decidedAt: string | null; createdAt: string;
}

interface Comment {
  id: string; entityType: string; entityId: string; authorId: string;
  authorName: string; body: string; parentId: string | null; createdAt: string; editedAt: string | null;
}

interface Notification {
  id: string; type: NotifType; entityType: string | null; entityId: string | null;
  title: string; body: string; readAt: string | null; createdAt: string;
}

interface HistoryEntry {
  id: string; actorName: string; action: string; field: string | null;
  oldValue: string | null; newValue: string | null; createdAt: string;
}

type Tab = 'members' | 'reviews' | 'approvals' | 'comments' | 'notifications' | 'history'

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export function TeamPanel({ tenantId, userId }: { tenantId: string; userId?: string }) {
  const [tab, setTab] = useState<Tab>('members')
  const [members, setMembers] = useState<Member[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(false)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('editor')
  const [inviting, setInviting] = useState(false)

  const [commentText, setCommentText] = useState('')
  const [commentEntityType, setCommentEntityType] = useState('schedule_entry')
  const [commentEntityId, setCommentEntityId] = useState('')
  const [sendingComment, setSendingComment] = useState(false)

  const [historyEntityType, setHistoryEntityType] = useState('schedule_entry')
  const [historyEntityId, setHistoryEntityId] = useState('')

  const headers = { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId }

  const load = useCallback(async (t: Tab) => {
    setLoading(true)
    try {
      if (t === 'members') {
        const r = await fetch(`${API_ORIGIN}/members`, { headers })
        if (r.ok) setMembers((await r.json() as { members: Member[] }).members ?? [])
      } else if (t === 'reviews' && userId) {
        const r = await fetch(`${API_ORIGIN}/assignments/mine?userId=${userId}`, { headers })
        if (r.ok) setAssignments((await r.json() as { assignments: Assignment[] }).assignments ?? [])
      } else if (t === 'approvals' && userId) {
        const r = await fetch(`${API_ORIGIN}/approvals/mine?userId=${userId}`, { headers })
        if (r.ok) setApprovals((await r.json() as { approvals: Approval[] }).approvals ?? [])
      } else if (t === 'notifications' && userId) {
        const r = await fetch(`${API_ORIGIN}/notifications?userId=${userId}&limit=30`, { headers })
        if (r.ok) setNotifications((await r.json() as { notifications: Notification[] }).notifications ?? [])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [tenantId, userId])

  useEffect(() => { load(tab) }, [tab, load])

  async function sendInvite() {
    if (!inviteEmail || inviting) return
    setInviting(true)
    try {
      const fakeUserId = `invited_${inviteEmail.replace(/[^a-z0-9]/gi, '_')}`
      await fetch(`${API_ORIGIN}/members/invite`, {
        method: 'POST', headers,
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, userId: fakeUserId }),
      })
      setInviteEmail('')
      await load('members')
    } catch { /* ignore */ }
    finally { setInviting(false) }
  }

  async function changeMemberRole(memberUserId: string, role: WorkspaceRole) {
    await fetch(`${API_ORIGIN}/members/${memberUserId}/role`, {
      method: 'PUT', headers, body: JSON.stringify({ role }),
    })
    await load('members')
  }

  async function removeMember(memberUserId: string) {
    await fetch(`${API_ORIGIN}/members/${memberUserId}`, { method: 'DELETE', headers })
    await load('members')
  }

  async function updateAssignment(id: string, status: ReviewStatus) {
    await fetch(`${API_ORIGIN}/assignments/${id}`, {
      method: 'PUT', headers, body: JSON.stringify({ status }),
    })
    await load('reviews')
  }

  async function decideApproval(id: string, status: 'approved' | 'rejected') {
    await fetch(`${API_ORIGIN}/approvals/${id}`, {
      method: 'PUT', headers, body: JSON.stringify({ status }),
    })
    await load('approvals')
  }

  async function sendComment() {
    if (!commentText || !commentEntityId || sendingComment) return
    setSendingComment(true)
    try {
      await fetch(`${API_ORIGIN}/comments`, {
        method: 'POST', headers,
        body: JSON.stringify({
          entityType: commentEntityType, entityId: commentEntityId,
          authorId: userId ?? 'unknown', authorName: 'You', text: commentText,
        }),
      })
      setCommentText('')
      const r = await fetch(
        `${API_ORIGIN}/comments?entityType=${commentEntityType}&entityId=${commentEntityId}`, { headers },
      )
      if (r.ok) setComments((await r.json() as { comments: Comment[] }).comments ?? [])
    } catch { /* ignore */ }
    finally { setSendingComment(false) }
  }

  async function markRead(id: string) {
    await fetch(`${API_ORIGIN}/notifications/${id}/read`, { method: 'PUT', headers })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
  }

  async function markAllRead() {
    if (!userId) return
    await fetch(`${API_ORIGIN}/notifications/read-all?userId=${userId}`, { method: 'PUT', headers })
    setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
  }

  const unreadCount = notifications.filter(n => !n.readAt).length

  const TABS: { id: Tab; label: string }[] = [
    { id: 'members', label: 'Members' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'approvals', label: 'Approvals' },
    { id: 'comments', label: 'Comments' },
    { id: 'notifications', label: unreadCount > 0 ? `Notifs (${unreadCount})` : 'Notifs' },
    { id: 'history', label: 'History' },
  ]

  return (
    <div className="tm-root">
      <div className="tm-header">
        <h2 className="tm-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Team
        </h2>
        <button className="tm-reload-btn" onClick={() => load(tab)}>Refresh</button>
      </div>

      {/* Tab bar */}
      <div className="tm-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tm-tab${tab === t.id ? ' tm-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="tm-empty"><div className="tm-empty-text">Loading…</div></div>}

      {/* ── Members ── */}
      {!loading && tab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {/* Invite form */}
          <div className="tm-invite-form">
            <div className="tm-section-title">Invite Member</div>
            <input
              type="email" placeholder="Email address"
              value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as WorkspaceRole)}>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
              <option value="client">Client</option>
            </select>
            <button className="tm-invite-btn" onClick={sendInvite} disabled={!inviteEmail || inviting}>
              {inviting ? 'Inviting…' : 'Send Invite'}
            </button>
          </div>

          <div className="tm-section-title">Workspace Members ({members.length})</div>
          {members.length === 0
            ? <div className="tm-empty"><div className="tm-empty-icon">👥</div><div className="tm-empty-text">No members yet.</div></div>
            : (
              <div className="tm-member-list">
                {members.map(m => (
                  <div key={m.id} className="tm-member">
                    <div className="tm-avatar">{initials(m.displayName)}</div>
                    <div className="tm-member-info">
                      <div className="tm-member-name">{m.displayName}</div>
                      <div className="tm-member-email">{m.email}</div>
                    </div>
                    <span className={`tm-role-badge tm-role--${m.role}`}>{m.role}</span>
                    <span className={`tm-status-dot tm-status-dot--${m.status}`} title={m.status} />
                    {m.role !== 'owner' && (
                      <select
                        value={m.role}
                        onChange={e => changeMemberRole(m.userId, e.target.value as WorkspaceRole)}
                        style={{ fontSize: '0.6rem', border: '1px solid var(--border)', borderRadius: '4px', background: 'none', color: 'var(--text)', cursor: 'pointer' }}
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                        <option value="client">Client</option>
                      </select>
                    )}
                    {m.role !== 'owner' && (
                      <button className="tm-action-btn tm-action-btn--danger" onClick={() => removeMember(m.userId)}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* ── Reviews ── */}
      {!loading && tab === 'reviews' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="tm-section-title">My Review Queue</div>
          {assignments.length === 0
            ? <div className="tm-empty"><div className="tm-empty-icon">✅</div><div className="tm-empty-text">No pending reviews.</div></div>
            : (
              <div className="tm-item-list">
                {assignments.map(a => (
                  <div key={a.id} className="tm-item">
                    <div className="tm-item-header">
                      <span className="tm-item-type">{a.entityType.replace('_', ' ')}</span>
                      <span className="tm-item-id">{a.entityId}</span>
                      <span className={`tm-status-badge tm-status--${a.status}`}>{a.status.replace('_', ' ')}</span>
                    </div>
                    {a.note && <div className="tm-item-note">{a.note}</div>}
                    {a.dueAt && <div style={{ fontSize: '0.58rem', opacity: 0.45 }}>Due {fmtTime(a.dueAt)}</div>}
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      <button className="tm-action-btn" onClick={() => updateAssignment(a.id, 'in_review')}>Start Review</button>
                      <button className="tm-action-btn" onClick={() => updateAssignment(a.id, 'approved')}>Approve</button>
                      <button className="tm-action-btn tm-action-btn--danger" onClick={() => updateAssignment(a.id, 'changes_requested')}>Request Changes</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* ── Approvals ── */}
      {!loading && tab === 'approvals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="tm-section-title">Pending Approvals</div>
          {approvals.length === 0
            ? <div className="tm-empty"><div className="tm-empty-icon">🔖</div><div className="tm-empty-text">No pending approvals.</div></div>
            : (
              <div className="tm-item-list">
                {approvals.map(a => (
                  <div key={a.id} className="tm-item">
                    <div className="tm-item-header">
                      <span className="tm-item-type">{a.entityType.replace('_', ' ')}</span>
                      <span className="tm-item-id">{a.entityId}</span>
                      <span style={{ fontSize: '0.57rem', opacity: 0.4 }}>Step {a.step}</span>
                      <span className={`tm-status-badge tm-status--${a.status}`}>{a.status}</span>
                    </div>
                    {a.comment && <div className="tm-item-note">{a.comment}</div>}
                    {a.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button className="tm-action-btn" onClick={() => decideApproval(a.id, 'approved')}>Approve</button>
                        <button className="tm-action-btn tm-action-btn--danger" onClick={() => decideApproval(a.id, 'rejected')}>Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* ── Comments ── */}
      {!loading && tab === 'comments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div className="tm-section-title">Comments</div>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            <select
              value={commentEntityType}
              onChange={e => setCommentEntityType(e.target.value)}
              style={{ fontSize: '0.65rem', border: '1px solid var(--border)', borderRadius: '5px', background: 'none', color: 'var(--text)', padding: '0.2rem 0.4rem' }}
            >
              <option value="schedule_entry">Post</option>
              <option value="campaign">Campaign</option>
              <option value="brief">Brief</option>
              <option value="run">Run</option>
            </select>
            <input
              type="text" placeholder="Entity ID…"
              value={commentEntityId} onChange={e => setCommentEntityId(e.target.value)}
              style={{ flex: 1, fontSize: '0.65rem', border: '1px solid var(--border)', borderRadius: '5px', background: 'none', color: 'var(--text)', padding: '0.2rem 0.4rem' }}
            />
            <button className="tm-reload-btn" onClick={async () => {
              if (!commentEntityId) return
              const r = await fetch(`${API_ORIGIN}/comments?entityType=${commentEntityType}&entityId=${commentEntityId}`, { headers })
              if (r.ok) setComments((await r.json() as { comments: Comment[] }).comments ?? [])
            }}>Load</button>
          </div>

          {comments.length === 0
            ? <div className="tm-empty"><div className="tm-empty-icon">💬</div><div className="tm-empty-text">No comments. Load an entity above.</div></div>
            : (
              <div className="tm-comments">
                {comments.map(c => (
                  <div key={c.id} className="tm-comment">
                    <div className="tm-comment-avatar">{initials(c.authorName)}</div>
                    <div className="tm-comment-body">
                      <div className="tm-comment-author">{c.authorName}</div>
                      <div className="tm-comment-text">{c.body}</div>
                      <div className="tm-comment-meta">{fmtTime(c.createdAt)}{c.editedAt ? ' (edited)' : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          }

          <div className="tm-comment-input-row">
            <textarea
              className="tm-comment-input" rows={2}
              placeholder="Add a comment…"
              value={commentText} onChange={e => setCommentText(e.target.value)}
            />
            <button className="tm-comment-send" onClick={sendComment} disabled={!commentText || !commentEntityId || sendingComment}>
              {sendingComment ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {/* ── Notifications ── */}
      {!loading && tab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="tm-section-title">Notifications ({unreadCount} unread)</div>
            {unreadCount > 0 && (
              <button className="tm-reload-btn" onClick={markAllRead}>Mark all read</button>
            )}
          </div>
          {notifications.length === 0
            ? <div className="tm-empty"><div className="tm-empty-icon">🔔</div><div className="tm-empty-text">No notifications yet.</div></div>
            : (
              <div className="tm-notif-list">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className={`tm-notif${!n.readAt ? ' tm-notif--unread' : ''}`}
                    onClick={() => !n.readAt && markRead(n.id)}
                  >
                    <div className={`tm-notif-dot${n.readAt ? ' tm-notif-dot--read' : ''}`} />
                    <div className="tm-notif-body">
                      <div className="tm-notif-title">{n.title}</div>
                      <div className="tm-notif-text">{n.body}</div>
                    </div>
                    <div className="tm-notif-time">{fmtTime(n.createdAt)}</div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* ── History ── */}
      {!loading && tab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div className="tm-section-title">Change History</div>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            <select
              value={historyEntityType}
              onChange={e => setHistoryEntityType(e.target.value)}
              style={{ fontSize: '0.65rem', border: '1px solid var(--border)', borderRadius: '5px', background: 'none', color: 'var(--text)', padding: '0.2rem 0.4rem' }}
            >
              <option value="schedule_entry">Post</option>
              <option value="campaign">Campaign</option>
              <option value="brief">Brief</option>
              <option value="run">Run</option>
            </select>
            <input
              type="text" placeholder="Entity ID…"
              value={historyEntityId} onChange={e => setHistoryEntityId(e.target.value)}
              style={{ flex: 1, fontSize: '0.65rem', border: '1px solid var(--border)', borderRadius: '5px', background: 'none', color: 'var(--text)', padding: '0.2rem 0.4rem' }}
            />
            <button className="tm-reload-btn" onClick={async () => {
              if (!historyEntityId) return
              const r = await fetch(`${API_ORIGIN}/history?entityType=${historyEntityType}&entityId=${historyEntityId}`, { headers })
              if (r.ok) setHistory((await r.json() as { history: HistoryEntry[] }).history ?? [])
            }}>Load</button>
          </div>
          {history.length === 0
            ? <div className="tm-empty"><div className="tm-empty-icon">📋</div><div className="tm-empty-text">Enter an entity ID above to load history.</div></div>
            : (
              <div className="tm-history">
                {history.map(e => (
                  <div key={e.id} className="tm-history-entry">
                    <span className="tm-history-actor">{e.actorName}</span>
                    <span className="tm-history-action">
                      {e.action}{e.field ? ` · ${e.field}` : ''}
                      {e.newValue ? `: ${e.newValue}` : ''}
                    </span>
                    <span className="tm-history-time">{fmtTime(e.createdAt)}</span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}
