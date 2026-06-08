import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/store'
import { setPlan, setSubscription, setLoading, setError } from '@/store/slices/billingSlice'
import { supabase } from '@/services/api/supabase.client'

type PlanTier = 'free' | 'pro' | 'enterprise'

const FEATURE_GATES: Record<string, PlanTier[]> = {
  ai_generation: ['pro', 'enterprise'],
  live_publishing: ['pro', 'enterprise'],
  autonomous_mode: ['pro', 'enterprise'],
  analytics_standard: ['pro', 'enterprise'],
  analytics_advanced: ['enterprise'],
  calendar_30d: ['pro', 'enterprise'],
  calendar_60d: ['enterprise'],
  multi_connections: ['pro', 'enterprise'],
  white_label: ['enterprise'],
  team_members: ['enterprise'],
}

const TIER_RANK: Record<PlanTier, number> = { free: 0, pro: 1, enterprise: 2 }

export function useBilling() {
  const dispatch = useAppDispatch()
  const { planTier, subscriptionId, currentPeriodEnd, loading, error } = useAppSelector(s => s.billing)
  const workspaceId = useAppSelector(s => s.auth.user?.id)

  const isPro = planTier === 'pro' || planTier === 'enterprise'
  const isEnterprise = planTier === 'enterprise'

  const canAccess = useCallback((feature: string): boolean => {
    const required = FEATURE_GATES[feature]
    if (!required) return true
    return required.some(tier => TIER_RANK[planTier] >= TIER_RANK[tier])
  }, [planTier])

  const upgradeToPro = useCallback(async () => {
    if (!workspaceId) return
    dispatch(setLoading(true))
    dispatch(setError(null))
    try {
      const { data, error: fnError } = await supabase.functions.invoke<{
        checkoutUrl: string
      }>('billing-checkout', {
        body: { workspaceId, plan: 'pro' },
      })
      if (fnError) throw fnError
      if (!data?.checkoutUrl) throw new Error('No checkout URL returned')
      window.location.href = data.checkoutUrl
    } catch (err) {
      dispatch(setError((err as Error).message))
      throw err
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch, workspaceId])

  const openBillingPortal = useCallback(async () => {
    if (!workspaceId) return
    dispatch(setLoading(true))
    dispatch(setError(null))
    try {
      const { data, error: fnError } = await supabase.functions.invoke<{
        portalUrl: string
      }>('billing-portal', {
        body: { workspaceId },
      })
      if (fnError) throw fnError
      if (!data?.portalUrl) throw new Error('No portal URL returned')
      window.open(data.portalUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      dispatch(setError((err as Error).message))
      throw err
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch, workspaceId])

  const syncBillingStatus = useCallback(async () => {
    if (!workspaceId) return
    dispatch(setLoading(true))
    dispatch(setError(null))
    try {
      const { data, error: fnError } = await supabase.functions.invoke<{
        planTier: PlanTier
        subscriptionId: string | null
        currentPeriodEnd: string | null
      }>('billing-status', {
        body: { workspaceId },
      })
      if (fnError) throw fnError
      if (!data) throw new Error('No billing status returned')
      dispatch(setPlan(data.planTier))
      if (data.subscriptionId && data.currentPeriodEnd) {
        dispatch(setSubscription({
          subscriptionId: data.subscriptionId,
          currentPeriodEnd: data.currentPeriodEnd,
        }))
      }
    } catch (err) {
      dispatch(setError((err as Error).message))
      throw err
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch, workspaceId])

  return {
    planTier,
    isPro,
    isEnterprise,
    loading,
    error,
    subscriptionId,
    currentPeriodEnd,
    canAccess,
    upgradeToPro,
    openBillingPortal,
    syncBillingStatus,
  }
}
