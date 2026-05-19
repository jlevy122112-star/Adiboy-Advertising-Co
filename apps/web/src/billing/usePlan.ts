import { useAuth, type PlanTier } from '../auth/useAuth'

export function usePlan(): { plan: PlanTier; isPro: boolean; isEnterprise: boolean; isFree: boolean } {
  const { state } = useAuth()
  const plan: PlanTier = state.status === 'authenticated' ? state.user.plan : 'free'
  return {
    plan,
    isFree: plan === 'free',
    isPro: plan === 'pro' || plan === 'enterprise',
    isEnterprise: plan === 'enterprise',
  }
}
