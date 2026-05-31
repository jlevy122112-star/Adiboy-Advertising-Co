
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { UsersPage } from './pages/UsersPage';
import { RewardsTuningPage } from './pages/RewardsTuningPage';
import { FeatureFlagsPage } from './pages/FeatureFlagsPage';
import { Users, Trophy, Flag, Shield } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/admin/users',   label: 'Users',    icon: Users  },
  { path: '/admin/rewards', label: 'Rewards',  icon: Trophy },
  { path: '/admin/flags',   label: 'Flags',    icon: Flag   },
];

const AdminLayout = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', minHeight: '100vh', background: '#050810', color: '#e2e8f0', fontFamily: 'DM Sans, sans-serif' }}>
    {/* Sidebar */}
    <aside style={{ width: 220, borderRight: '1px solid rgba(255,255,255,0.06)', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ padding: '0 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={16} color="#c9a84c" />
          <span style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.15em', color: '#c9a84c', fontSize: 16 }}>
            ADMIN
          </span>
        </div>
        <p style={{ fontSize: 10, color: '#475569', marginTop: 4, fontFamily: 'Courier Prime, monospace', letterSpacing: '0.15em' }}>
          MARKETER PRO OFFICE
        </p>
      </div>
      {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 20px',
            margin: '0 8px',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 13,
            color: isActive ? '#c9a84c' : '#64748b',
            background: isActive ? 'rgba(201,168,76,0.08)' : 'transparent',
            border: isActive ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
            transition: 'all 0.15s',
          })}
        >
          <Icon size={15} />
          {label}
        </NavLink>
      ))}
    </aside>

    {/* Main */}
    <main style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
      {children}
    </main>
  </div>
);

export const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/admin/users" replace />} />
      <Route path="/admin/users"   element={<AdminLayout><UsersPage /></AdminLayout>} />
      <Route path="/admin/rewards" element={<AdminLayout><RewardsTuningPage /></AdminLayout>} />
      <Route path="/admin/flags"   element={<AdminLayout><FeatureFlagsPage /></AdminLayout>} />
      <Route path="*"              element={<Navigate to="/admin/users" replace />} />
    </Routes>
  </BrowserRouter>
);
