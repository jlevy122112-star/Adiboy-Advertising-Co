import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { User, Session, AuthState } from '@/types/auth.types'

const initialState: AuthState = {
  user: null,
  session: null,
  loading: false,
  error: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload
    },
    setSession(state, action: PayloadAction<Session | null>) {
      state.session = action.payload
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
    logout(state) {
      state.user = null
      state.session = null
      state.loading = false
      state.error = null
    },
  },
})

export const { setUser, setSession, setLoading, setError, logout } = authSlice.actions
export default authSlice.reducer
