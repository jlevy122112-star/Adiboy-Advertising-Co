import { useState, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import { LoginPage } from './LoginPage'
import { SignupPage } from './SignupPage'

type Props = { children: ReactNode }

export function AuthGuard({ children }: Props) {
  const { state, logout } = useAuth()
  const [view, setView] = useState<'login' | 'signup'>('login')

  if (state.status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f172a' }}>
        <span style={{ width: 32, height: 32, border: '3px solid #334155', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'auth-spin 0.7s linear infinite', display: 'block' }} />
      </div>
    )
  }

  if (state.status === 'unauthenticated') {
    if (view === 'signup') return <SignupPage onSwitchToLogin={() => setView('login')} />
    return <LoginPage onSwitchToSignup={() => setView('signup')} />
  }

  return (
    <>
      {children}
      {/* User badge injected into nav via CSS data-auth */}
      <div id="auth-user-bar" data-email={state.user.email} data-role={state.user.role} style={{ display: 'none' }} />
      <script dangerouslySetInnerHTML={{ __html: '' }} />
      {/* Expose logout globally for nav button */}
      <AuthNavInjector email={state.user.email} onLogout={logout} />
    </>
  )
}

function AuthNavInjector({ email, onLogout }: { email: string; onLogout: () => void }) {
  // Mount a logout button into the existing nav bar
  const [mounted, setMounted] = useState(false)

  if (!mounted) {
    // First render — try to inject into nav
    setTimeout(() => setMounted(true), 0)
  }

  return (
    <div
      className="auth-user-menu"
      style={{ position: 'fixed', top: '0.75rem', right: '3.5rem', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
    >
      <span className="auth-user-email" title={email}>{email}</span>
      <button className="auth-logout-btn" type="button" onClick={onLogout}>Sign out</button>
    </div>
  )
}
