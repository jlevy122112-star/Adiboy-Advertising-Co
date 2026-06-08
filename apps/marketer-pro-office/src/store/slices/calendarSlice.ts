import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Post } from '@/types/campaign.types'

type ViewMode = 'month' | 'week' | 'day'

interface CalendarState {
  posts: Post[]
  selectedDate: string | null
  viewMode: ViewMode
  loading: boolean
}

const initialState: CalendarState = {
  posts: [],
  selectedDate: null,
  viewMode: 'month',
  loading: false,
}

const calendarSlice = createSlice({
  name: 'calendar',
  initialState,
  reducers: {
    setPosts(state, action: PayloadAction<Post[]>) {
      state.posts = action.payload
    },
    addPost(state, action: PayloadAction<Post>) {
      state.posts.push(action.payload)
    },
    updatePost(state, action: PayloadAction<Post>) {
      const idx = state.posts.findIndex(p => p.id === action.payload.id)
      if (idx !== -1) {
        state.posts[idx] = action.payload
      }
    },
    deletePost(state, action: PayloadAction<string>) {
      state.posts = state.posts.filter(p => p.id !== action.payload)
    },
    setSelectedDate(state, action: PayloadAction<string | null>) {
      state.selectedDate = action.payload
    },
    setViewMode(state, action: PayloadAction<ViewMode>) {
      state.viewMode = action.payload
    },
  },
})

export const {
  setPosts,
  addPost,
  updatePost,
  deletePost,
  setSelectedDate,
  setViewMode,
} = calendarSlice.actions
export default calendarSlice.reducer
