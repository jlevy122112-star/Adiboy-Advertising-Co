import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Brand, BrandState } from '@/types/brand.types'

const initialState: BrandState = {
  brand: null,
  loading: false,
  error: null,
  setupComplete: false,
}

const brandSlice = createSlice({
  name: 'brand',
  initialState,
  reducers: {
    setBrand(state, action: PayloadAction<Brand | null>) {
      state.brand = action.payload
    },
    updateBrand(state, action: PayloadAction<Partial<Brand>>) {
      if (state.brand) {
        state.brand = { ...state.brand, ...action.payload }
      }
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
    setSetupComplete(state, action: PayloadAction<boolean>) {
      state.setupComplete = action.payload
    },
  },
})

export const { setBrand, updateBrand, setLoading, setError, setSetupComplete } = brandSlice.actions
export default brandSlice.reducer
