import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  duration?: number
}

interface UiState {
  toasts: Toast[]
  isLoading: boolean
  activeModal: string | null
  sidebarOpen: boolean
}

const initialState: UiState = {
  toasts: [],
  isLoading: false,
  activeModal: null,
  sidebarOpen: false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    addToast(state, action: PayloadAction<Toast>) {
      state.toasts.push(action.payload)
    },
    removeToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter(t => t.id !== action.payload)
    },
    setGlobalLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload
    },
    setActiveModal(state, action: PayloadAction<string | null>) {
      state.activeModal = action.payload
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen
    },
  },
})

export const { addToast, removeToast, setGlobalLoading, setActiveModal, toggleSidebar } = uiSlice.actions
export default uiSlice.reducer
