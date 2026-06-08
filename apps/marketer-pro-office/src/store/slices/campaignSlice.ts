import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Campaign, CampaignState } from '@/types/campaign.types'

const initialState: CampaignState = {
  campaigns: [],
  activeCampaign: null,
  loading: false,
  error: null,
}

const campaignSlice = createSlice({
  name: 'campaigns',
  initialState,
  reducers: {
    setCampaigns(state, action: PayloadAction<Campaign[]>) {
      state.campaigns = action.payload
    },
    addCampaign(state, action: PayloadAction<Campaign>) {
      state.campaigns.push(action.payload)
    },
    updateCampaign(state, action: PayloadAction<Campaign>) {
      const idx = state.campaigns.findIndex(c => c.id === action.payload.id)
      if (idx !== -1) {
        state.campaigns[idx] = action.payload
      }
      if (state.activeCampaign?.id === action.payload.id) {
        state.activeCampaign = action.payload
      }
    },
    deleteCampaign(state, action: PayloadAction<string>) {
      state.campaigns = state.campaigns.filter(c => c.id !== action.payload)
      if (state.activeCampaign?.id === action.payload) {
        state.activeCampaign = null
      }
    },
    setActiveCampaign(state, action: PayloadAction<Campaign | null>) {
      state.activeCampaign = action.payload
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
  },
})

export const {
  setCampaigns,
  addCampaign,
  updateCampaign,
  deleteCampaign,
  setActiveCampaign,
  setLoading,
  setError,
} = campaignSlice.actions
export default campaignSlice.reducer
