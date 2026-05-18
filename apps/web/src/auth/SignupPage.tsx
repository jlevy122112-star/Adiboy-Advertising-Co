import { useState, type FormEvent } from 'react'
import { useAuth } from './useAuth'
import './auth.css'

type Props = { onSwitchToLogin: () => void }

const ERROR_MESSAGES: Record<string, string> = {
  email_taken: 'That email is already registered.',
  rate_limited: 'Too many attempts. Please wait a minute.',
  invalid_body: 'Please check your details and try again.',
}

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' }
  if (score <= 2) return { score, label: 'Fair', color: '#f59e0b' }
  if (score <= 3) return { score, label: 'Good', color: '#3b82f6' }
  return { score, label: 'Strong', color: '#22c55e' }
}

export function SignupPage({ onSwitchToLogin }: Props) {
  const { signup } = useAuth()
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [tenantId, setTenantId] = useState(import.meta.env.VITE_TENANT_ID as string ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailError = emailTouched && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? 'Enter a valid email address.' : null
  const confirmError = confirmTouched && confirm && confirm !== password
    ? 'Passwords do not match.' : null
  const strength = password ? passwordStrength(password) : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEmailTouched(true)
    setConfirmTouched(true)
    if (emailError || confirmError) return
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
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
            {strength && (
              <div className="auth-strength">
                <div className="auth-strength-bars">
                  {[1,2,3,4].map(i => (
                    <div
                      key={i}
                      className="auth-strength-bar"
                      style={{ background: i <= strength.score ? strength.color : '#334155' }}
                    />
                  ))}
                </div>
                <span className="auth-strength-label" style={{ color: strength.color }}>{strength.label}</span>
              </div>
            )}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              className={`auth-input${confirmError ? ' auth-input--error' : ''}`}
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onBlur={() => setConfirmTouched(true)}
              placeholder="Repeat password"
              required
              autoComplete="new-password"
            />
            {confirmError && <span className="auth-field-error">{confirmError}</span>}
          </div>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? <span className="auth-spinner" /> : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{' '}
          <button className="auth-link" type="button" onClick={onSwitchToLogin}>Sign in</button>
        </p>
      </div>
    </div>
  )
}
