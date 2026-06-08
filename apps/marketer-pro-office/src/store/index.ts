import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux'

import authReducer from './slices/authSlice'
import brandReducer from './slices/brandSlice'
import campaignReducer from './slices/campaignSlice'
import calendarReducer from './slices/calendarSlice'
import platformReducer from './slices/platformSlice'
import billingReducer from './slices/billingSlice'
import uiReducer from './slices/uiSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    brand: brandReducer,
    campaigns: campaignReducer,
    calendar: calendarReducer,
    platforms: platformReducer,
    billing: billingReducer,
    ui: uiReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
