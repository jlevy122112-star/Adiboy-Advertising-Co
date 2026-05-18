import { useState, type FormEvent } from 'react'
import { useAuth } from './useAuth'
import './auth.css'

type Props = { onSwitchToSignup: () => void }

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  rate_limited: 'Too many attempts. Please wait a minute.',
  user_not_found: 'No account found with that email.',
}

export function LoginPage({ onSwitchToSignup }: Props) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [password, setPassword] = useState('')
  const [tenantId, setTenantId] = useState(import.meta.env.VITE_TENANT_ID as string ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailError = emailTouched && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? 'Enter a valid email address.' : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEmailTouched(true)
    if (emailError) return
    setLoading(true)
    const err = await login(email.trim().toLowerCase(), password, tenantId.trim())
    setLoading(false)
    if (err) setError(ERROR_MESSAGES[err] ?? `Login failed: ${err}`)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-mark">M</span>
        </div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to Marketer Pro</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {!import.meta.env.VITE_TENANT_ID && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="tenantId">Workspace ID</label>
              <input
                id="tenantId"
                className="auth-input"
                type="text"
                value={tenantId}
                onChange={e => setTenantId(e.target.value)}
                placeholder="your-workspace-id"
                required
                autoComplete="organization"
              />
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label" htmlFor="email">Email</label>
            <input
              id="email"
              className={`auth-input${emailError ? ' auth-input--error' : ''}`}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              placeholder="you@company.com"
              required
              autoComplete="email"
              autoFocus
            />
            {emailError && <span className="auth-field-error">{emailError}</span>}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="auth-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="auth-error" role="alert">{error}</div>
          )}

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? <span className="auth-spinner" /> : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account?{' '}
          <button className="auth-link" type="button" onClick={onSwitchToSignup}>
            Create one
          </button>
        </p>
      </div>
    </div>
  )
}
