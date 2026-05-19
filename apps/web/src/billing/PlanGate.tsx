import { useState, type ReactNode } from 'react'
import { usePlan } from './usePlan'
import { UpgradeModal } from './UpgradeModal'
import type { PlanTier } from '../auth/useAuth'
import './pricing.css'

interface Props {
  requiredPlan: PlanTier
  feature?: string
  children: ReactNode
}

const PLAN_RANK: Record<PlanTier, number> = { free: 0, pro: 1, enterprise: 2 }

export function PlanGate({ requiredPlan, feature, children }: Props) {
  const { plan } = usePlan()
  const [showModal, setShowModal] = useState(false)

  if (PLAN_RANK[plan] >= PLAN_RANK[requiredPlan]) return <>{children}</>

  return (
    <>
      <div className="pg-gate">
        <div className="pg-lock">⚡</div>
        <p className="pg-title">{feature ?? 'Pro feature'}</p>
        <p className="pg-desc">
          This feature requires a <strong>{requiredPlan}</strong> plan or higher.
        </p>
        <button className="pg-upgrade-btn" onClick={() => setShowModal(true)}>
          Upgrade to {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)}
        </button>
      </div>
      {showModal && <UpgradeModal feature={feature} onClose={() => setShowModal(false)} />}
    </>
  )
}
