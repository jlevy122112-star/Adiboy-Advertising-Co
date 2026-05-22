import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import { LoginPage } from './LoginPage'
import { SignupPage } from './SignupPage'
import { OnboardingWizard, ONBOARDING_DONE_KEY } from '../onboarding/OnboardingWizard'
import { useToast } from '../components/Toast'
import { storageGet } from '../lib/storage'

const TENANT_ID = import.meta.env.VITE_TENANT_ID as string | undefined

type Props = { children: ReactNode }

// ─── Loading Spinner ────────────────────────────────────────────────────────
// All values use CSS custom properties so they adapt to theme changes
// and can be overridden at the root level without touching this component.
const spinnerStyles = `
  @keyframes auth-spin {
    to { transform: rotate(360deg); }
  }
  .auth-loading-root {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    background: var(--color-bg-base, #0f172a);
  }
  .auth-spinner {
    width: var(--spinner-size, 2rem);
    height: var(--spinner-size, 2rem);
    border: var(--spinner-border, 3px) solid var(--color-spinner-track, #334155);
    border-top-color: var(--color-accent, #6366f1);
    border-radius: 50%;
    animation: auth-spin 0.7s linear infinite;
    display: block;
  }

  /* ─── Auth Nav Injector ─────────────────────────────────────────────────── */
  .auth-user-menu {
    position: fixed;
    /*
     * Use logical CSS + safe-area-inset so notched/Dynamic-Island devices
     * don't clip the menu.  Falls back gracefully on browsers that don't
     * support env().
     */
    top: calc(var(--nav-height, 3.625rem) / 2 - 0.875rem);
    inset-inline-end: calc(
      var(--auth-nav-inset-end, 3.5rem) +
      env(safe-area-inset-right, 0px)
    );
    z-index: var(--z-nav-overlay, 200);   /* sits inside nav layer, below modals */
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .auth-user-email {
    max-width: min(160px, 30vw);          /* collapses on narrow screens */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-sm, 0.8125rem);
    color: var(--color-text-muted);
  }

  .auth-logout-btn {
    font-size: var(--text-sm, 0.8125rem);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border-radius: var(--radius-sm, 0.25rem);
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .auth-logout-btn:hover {
    background: var(--color-bg-subtle);
  }

  /* ─── Responsive overrides ──────────────────────────────────────────────── */
  @media (max-width: 480px) {
    .auth-user-email {
      display: none;          /* hide email on very small screens; icon/button stays */
    }
    .auth-user-menu {
      inset-inline-end: calc(
        var(--auth-nav-inset-end-mobile, 1rem) +
        env(safe-area-inset-right, 0px)
      );
    }
  }
`

// ─── AuthGuard ───────────────────────────────────────────────────────────────
export function AuthGuard({ children }: Props) {
  const { state, logout } = useAuth()
  const toast = useToast()
  const [view, setView] = useState<'login' | 'signup'>('login')
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)
  const prevStatusRef = useRef(state.status)

  useEffect(() => {
    storageGet(ONBOARDING_DONE_KEY).then(val => setOnboardingDone(!!val))
  }, [])

  useEffect(() => {
    if (prevStatusRef.current === 'authenticated' && state.status === 'unauthenticated') {
      toast('Session expired. Please sign in again.', 'warning')
    }
    prevStatusRef.current = state.status
  }, [state.status])

  // ── Loading state ──────────────────────────────────────────────────────────
  if (state.status === 'loading' || onboardingDone === null) {
    return (
      <>
        <style>{spinnerStyles}</style>
        <div className="auth-loading-root">
          <span className="auth-spinner" role="status" aria-label="Loading…" />
        </div>
      </>
    )
  }

  // ── Unauthenticated ────────────────────────────────────────────────────────
  if (state.status === 'unauthenticated') {
    if (view === 'signup') return <SignupPage onSwitchToLogin={() => setView('login')} />
    return <LoginPage onSwitchToSignup={() => setView('signup')} />
  }

  // ── Onboarding ─────────────────────────────────────────────────────────────
  if (!onboardingDone) {
    return (
      <OnboardingWizard
        tenantId={TENANT_ID ?? state.user.tenantId ?? 'demo'}
        onComplete={() => setOnboardingDone(true)}
      />
    )
  }

  // ── Authenticated ──────────────────────────────────────────────────────────
  return (
    <>
      <style>{spinnerStyles}</style>
      {children}
      {/* Hidden data bridge for nav — read by CSS [data-*] selectors */}
      <div
        id="auth-user-bar"
        data-email={state.user.email}
        data-role={state.user.role}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      <AuthNavInjector email={state.user.email} onLogout={logout} />
    </>
  )
}

// ─── AuthNavInjector ──────────────────────────────────────────────────────────
//
// Renders a logout button + email into the top-right of the fixed nav bar.
//
// Z-index strategy:
//   --z-nav-overlay (200) → lives inside the nav layer
//   Modals use --z-modal (1000) → always stack above this
//   No conflict with UpgradeModal, PostEditModal, or ConfirmModal.
//
function AuthNavInjector({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Defer one tick so the nav DOM is painted before we inject
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (!mounted) return null

  return (
    <div className="auth-user-menu">
      <span className="auth-user-email" title={email}>
        {email}
      </span>
      <button className="auth-logout-btn" type="button" onClick={onLogout}>
        Sign out
      </button>
    </div>
  )
}
