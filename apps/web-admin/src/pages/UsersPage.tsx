
import { useState, useEffect } from 'react';
import { Search, RefreshCw } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  level: number;
  generationsCount: number;
  createdAt: string;
  lastActiveAt: string | null;
}

const PLAN_BADGE: Record<AdminUser['plan'], { bg: string; text: string }> = {
  free:       { bg: 'rgba(100,116,139,0.15)', text: '#64748b' },
  pro:        { bg: 'rgba(201,168,76,0.15)',  text: '#c9a84c' },
  enterprise: { bg: 'rgba(30,144,255,0.15)',  text: '#1e90ff' },
};

const cell: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 13,
  color: '#94a3b8',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
};

const headerCell: React.CSSProperties = {
  ...cell,
  fontSize: 10,
  fontFamily: 'Courier Prime, monospace',
  letterSpacing: '0.15em',
  color: '#475569',
  textTransform: 'uppercase',
  background: 'rgba(255,255,255,0.02)',
};

export const UsersPage = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, letterSpacing: '0.15em', color: '#c9a84c', margin: 0 }}>
            USERS
          </h1>
          <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
            {users.length} total accounts
          </p>
        </div>
        <button
          onClick={fetchUsers}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', color: '#64748b', cursor: 'pointer', fontSize: 12 }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by email or name..."
          style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Table */}
      <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['User', 'Plan', 'Level', 'Generations', 'Last Active'].map(h => (
                <th key={h} style={headerCell}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ ...cell, textAlign: 'center', color: '#334155' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ ...cell, textAlign: 'center', color: '#334155' }}>No users found</td></tr>
            ) : filtered.map(user => (
              <tr key={user.id} style={{ cursor: 'default' }}>
                <td style={cell}>
                  <div style={{ fontWeight: 500, color: '#e2e8f0', fontSize: 13 }}>{user.name || '—'}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{user.email}</div>
                </td>
                <td style={cell}>
                  <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontFamily: 'Courier Prime, monospace', letterSpacing: '0.1em', textTransform: 'uppercase', background: PLAN_BADGE[user.plan].bg, color: PLAN_BADGE[user.plan].text }}>
                    {user.plan}
                  </span>
                </td>
                <td style={{ ...cell, fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#c9a84c' }}>
                  {user.level}
                </td>
                <td style={{ ...cell, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                  {user.generationsCount.toLocaleString()}
                </td>
                <td style={cell}>
                  {user.lastActiveAt
                    ? new Date(user.lastActiveAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
