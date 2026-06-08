import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

type PlanTier = 'free' | 'pro' | 'enterprise'

interface BillingState {
  planTier: PlanTier
  subscriptionId: string | null
  currentPeriodEnd: string | null
  loading: boolean
  error: string | null
}

const initialState: BillingState = {
  planTier: 'free',
  subscriptionId: null,
  currentPeriodEnd: null,
  loading: false,
  error: null,
}

const billingSlice = createSlice({
  name: 'billing',
  initialState,
  reducers: {
    setPlan(state, action: PayloadAction<PlanTier>) {
      state.planTier = action.payload
    },
    setSubscription(state, action: PayloadAction<{ subscriptionId: string; currentPeriodEnd: string }>) {
      state.subscriptionId = action.payload.subscriptionId
      state.currentPeriodEnd = action.payload.currentPeriodEnd
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
  },
})

export const { setPlan, setSubscription, setLoading, setError } = billingSlice.actions
export default billingSlice.reducer
