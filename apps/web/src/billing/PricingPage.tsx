import { useState } from 'react'
import { usePlan } from './usePlan'
import { UpgradeModal } from './UpgradeModal'
import { apiFetch } from '../hooks/useApi'
import './pricing.css'

const BILLING_API = import.meta.env.VITE_BILLING_API_ORIGIN as string ?? 'http://localhost:8806'

async function goToPortal(): Promise<void> {
  const res = await apiFetch<{ url: string }>(`${BILLING_API}/billing/portal`, { method: 'POST' })
  if (res.ok && res.data.url) window.location.href = res.data.url
  else alert('Could not open billing portal — contact support@marketer.pro')
}

const FREE_FEATURES = [
  '7-day content calendar',
  'Basic analytics',
  '1 social connection per network',
  '"Made with Marketer Pro" branding',
]

const PRO_FEATURES = [
  'Everything in Free',
  'Unlimited AI content generation',
  'Live publishing to all networks',
  'Autonomous agent campaigns',
  '30-day calendar window',
  'Predictive scheduling AI',
  'Sentiment analysis & listening',
  'SERP keyword research',
  'Remove "Made with Marketer Pro"',
  '5 social connections per network',
  'Team collaboration (up to 10 members)',
  'Standard analytics',
]

const ENT_FEATURES = [
  'Everything in Pro',
  '60-day calendar window',
  'Advanced analytics & reporting',
  '50 social connections per network',
  'Unlimited team members',
  'Custom brand theme & white-label',
  'Priority support & SLA',
  'Dedicated account manager',
  'Custom integrations',
  'SSO / SAML',
]

export function PricingPage() {
  const { plan } = usePlan()
  const [annual, setAnnual] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  async function handleManage() {
    setPortalLoading(true)
    await goToPortal()
    setPortalLoading(false)
  }

  const proPrice = annual ? 29 : 39
  const entPrice = annual ? 99 : 129

  return (
    <div className="pp-root">
      <div className="pp-header">
        <h1 className="pp-title">Simple, transparent pricing</h1>
        <p className="pp-sub">Start free. Upgrade when you're ready to grow.</p>
        {plan !== 'free' && (
          <button className="pp-manage-btn" onClick={handleManage} disabled={portalLoading}>
            {portalLoading ? 'Opening…' : '⚙ Manage subscription'}
          </button>
        )}

        <div className="pp-toggle">
          <button
            className={`pp-toggle-btn${!annual ? ' pp-toggle-btn--active' : ''}`}
            onClick={() => setAnnual(false)}
          >Monthly</button>
          <button
            className={`pp-toggle-btn${annual ? ' pp-toggle-btn--active' : ''}`}
            onClick={() => setAnnual(true)}
          >
            Annual
            <span className="pp-save-badge">Save 25%</span>
          </button>
        </div>
      </div>

      <div className="pp-grid">
        {/* Free */}
        <div className={`pp-card${plan === 'free' ? ' pp-card--current' : ''}`}>
          {plan === 'free' && <div className="pp-current-badge">Current plan</div>}
          <div className="pp-plan-name">Free</div>
          <div className="pp-price">
            <span className="pp-amount">$0</span>
            <span className="pp-period">/mo</span>
          </div>
          <p className="pp-plan-desc">For individuals getting started with social media planning.</p>
          <ul className="pp-features">
            {FREE_FEATURES.map(f => (
              <li key={f} className="pp-feature"><span className="pp-check">✓</span>{f}</li>
            ))}
          </ul>
          <button className="pp-cta pp-cta--free" disabled>
            {plan === 'free' ? 'Current plan' : 'Downgrade'}
          </button>
        </div>

        {/* Pro */}
        <div className={`pp-card pp-card--pro${plan === 'pro' ? ' pp-card--current' : ''}`}>
          <div className="pp-popular-badge">Most popular</div>
          {plan === 'pro' && <div className="pp-current-badge">Current plan</div>}
          <div className="pp-plan-name">Pro</div>
          <div className="pp-price">
            <span className="pp-amount">${proPrice}</span>
            <span className="pp-period">/mo</span>
          </div>
          {annual && <p className="pp-billed-note">Billed $348/year</p>}
          <p className="pp-plan-desc">For creators and small businesses ready to automate their marketing.</p>
          <ul className="pp-features">
            {PRO_FEATURES.map(f => (
              <li key={f} className="pp-feature"><span className="pp-check pp-check--pro">✓</span>{f}</li>
            ))}
          </ul>
          <button
            className="pp-cta pp-cta--pro"
            disabled={plan === 'pro' || plan === 'enterprise'}
            onClick={() => setShowModal(true)}
          >
            {plan === 'pro' ? 'Current plan' : plan === 'enterprise' ? 'Included' : `Start Pro — $${proPrice}/mo`}
          </button>
        </div>

        {/* Enterprise */}
        <div className={`pp-card pp-card--enterprise${plan === 'enterprise' ? ' pp-card--current' : ''}`}>
          {plan === 'enterprise' && <div className="pp-current-badge">Current plan</div>}
          <div className="pp-plan-name">Enterprise</div>
          <div className="pp-price">
            <span className="pp-amount">${entPrice}</span>
            <span className="pp-period">/mo</span>
          </div>
          {annual && <p className="pp-billed-note">Billed $1,188/year</p>}
          <p className="pp-plan-desc">For agencies and teams scaling content across many brands.</p>
          <ul className="pp-features">
            {ENT_FEATURES.map(f => (
              <li key={f} className="pp-feature"><span className="pp-check pp-check--ent">✓</span>{f}</li>
            ))}
          </ul>
          <button
            className="pp-cta pp-cta--enterprise"
            disabled={plan === 'enterprise'}
            onClick={() => alert('Contact us at enterprise@marketer.pro')}
          >
            {plan === 'enterprise' ? 'Current plan' : 'Contact Sales'}
          </button>
        </div>
      </div>

      <div className="pp-guarantee">
        <span className="pp-guarantee-icon">🛡</span>
        14-day money-back guarantee · Cancel anytime · No credit card required for Free
      </div>

      {showModal && <UpgradeModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
