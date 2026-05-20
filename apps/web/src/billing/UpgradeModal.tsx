import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../hooks/useApi'
import { openExternal } from '../lib/browser'
import './pricing.css'

const BILLING_API = import.meta.env.VITE_BILLING_API_ORIGIN as string ?? 'http://localhost:8806'

interface Props {
  onClose: () => void
  feature?: string
}

async function startCheckout(priceId: string, annual: boolean): Promise<void> {
  const res = await apiFetch<{ url: string }>(`${BILLING_API}/billing/checkout`, {
    method: 'POST',
    json: { priceId: priceId || undefined, annual },
  })
  if (res.ok && res.data.url) {
    openExternal(res.data.url)
  } else {
    alert('Checkout unavailable — please contact support@marketer.pro')
  }
}

export function UpgradeModal({ onClose, feature }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [annual, setAnnual] = useState(false)
  const [loading, setLoading] = useState<'pro' | 'ent' | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function onBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  async function handlePro() {
    setLoading('pro')
    const priceId = annual
      ? (import.meta.env.VITE_STRIPE_PRICE_PRO_ANNUAL as string ?? '')
      : (import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY as string ?? '')
    await startCheckout(priceId, annual)
    setLoading(null)
  }

  async function handleEnt() {
    setLoading('ent')
    const priceId = annual
      ? (import.meta.env.VITE_STRIPE_PRICE_ENT_ANNUAL as string ?? '')
      : (import.meta.env.VITE_STRIPE_PRICE_ENT_MONTHLY as string ?? '')
    await startCheckout(priceId, annual)
    setLoading(null)
  }

  const proPrice = annual ? 29 : 39
  const entPrice = annual ? 99 : 129

  return (
    <div className="um-backdrop" onClick={onBackdrop} role="dialog" aria-modal="true">
      <div className="um-dialog" ref={dialogRef}>
        <button className="um-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="um-header">
          <div className="um-lock-icon">⚡</div>
          <h2 className="um-title">Upgrade to unlock</h2>
          {feature && <p className="um-feature-name">{feature}</p>}
          <p className="um-subtitle">
            Get full AI generation, live publishing, autonomous campaigns, and more.
          </p>
        </div>

        {/* Annual toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <div className="pp-toggle">
            <button className={`pp-toggle-btn${!annual ? ' pp-toggle-btn--active' : ''}`} onClick={() => setAnnual(false)}>Monthly</button>
            <button className={`pp-toggle-btn${annual ? ' pp-toggle-btn--active' : ''}`} onClick={() => setAnnual(true)}>
              Annual <span className="pp-save-badge">Save 25%</span>
            </button>
          </div>
        </div>

        <div className="um-plans">
          {/* Pro */}
          <div className="um-plan um-plan--pro">
            <div className="um-plan-badge">Most popular</div>
            <div className="um-plan-name">Pro</div>
            <div className="um-plan-price">
              <span className="um-plan-amount">${proPrice}</span>
              <span className="um-plan-period">/mo</span>
            </div>
            <div className="um-plan-annual">{annual ? 'Billed $348/year' : 'or $29/mo billed annually'}</div>
            <ul className="um-features">
              <li>✓ Unlimited AI content generation</li>
              <li>✓ Live publishing to all networks</li>
              <li>✓ Autonomous agent campaigns</li>
              <li>✓ 30-day calendar window</li>
              <li>✓ Predictive scheduling AI</li>
              <li>✓ Sentiment analysis</li>
              <li>✓ Remove "Made with Marketer Pro"</li>
              <li>✓ 5 social connections per network</li>
            </ul>
            <button className="um-cta um-cta--pro" onClick={handlePro} disabled={loading !== null}>
              {loading === 'pro' ? 'Redirecting…' : `Start Pro — $${proPrice}/mo`}
            </button>
          </div>

          {/* Enterprise */}
          <div className="um-plan um-plan--enterprise">
            <div className="um-plan-name">Enterprise</div>
            <div className="um-plan-price">
              <span className="um-plan-amount">${entPrice}</span>
              <span className="um-plan-period">/mo</span>
            </div>
            <div className="um-plan-annual">{annual ? 'Billed $1,188/year' : 'or $99/mo billed annually'}</div>
            <ul className="um-features">
              <li>✓ Everything in Pro</li>
              <li>✓ 60-day calendar window</li>
              <li>✓ Advanced analytics</li>
              <li>✓ 50 connections per network</li>
              <li>✓ Priority support</li>
              <li>✓ Custom brand theme</li>
              <li>✓ Dedicated account manager</li>
              <li>✓ SLA guarantee</li>
            </ul>
            <button className="um-cta um-cta--enterprise" onClick={handleEnt} disabled={loading !== null}>
              {loading === 'ent' ? 'Redirecting…' : `Start Enterprise — $${entPrice}/mo`}
            </button>
          </div>
        </div>

        <p className="um-footer">
          Cancel anytime. 14-day money-back guarantee. Secure checkout via Stripe.
        </p>
      </div>
    </div>
  )
}
