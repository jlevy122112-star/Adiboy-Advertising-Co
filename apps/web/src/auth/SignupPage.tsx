import { useState, type FormEvent } from 'react'
import { useAuth } from './useAuth'
import './auth.css'

type Props = { onSwitchToLogin: () => void }

const ERROR_MESSAGES: Record<string, string> = {
  email_taken: 'That email is already registered.',
  rate_limited: 'Too many attempts. Please wait a minute.',
  invalid_body: 'Please check your details and try again.',
}

export function SignupPage({ onSwitchToLogin }: Props) {
  const { signup } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [tenantId, setTenantId] = useState(import.meta.env.VITE_TENANT_ID as string ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const err = await signup(email.trim().toLowerCase(), password, tenantId.trim())
    setLoading(false)
    if (err) setError(ERROR_MESSAGES[err] ?? `Signup failed: ${err}`)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-mark">M</span>
        </div>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Start with Marketer Pro</p>

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
              className="auth-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="password">Password</label>
            <input
              id="password"
              className="auth-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              autoComplete="new-password"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              className="auth-input"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat password"
              required
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="auth-error" role="alert">{error}</div>
          )}

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? <span className="auth-spinner" /> : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{' '}
          <button className="auth-link" type="button" onClick={onSwitchToLogin}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}
