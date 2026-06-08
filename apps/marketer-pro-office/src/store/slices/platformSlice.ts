import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Platform, PlatformId, PlatformState } from '@/types/platform.types'
import { PLATFORM_IDS, PLATFORMS_CONFIG } from '@/config/platforms.config'

const buildInitialPlatforms = (): Record<PlatformId, Platform> => {
  return PLATFORM_IDS.reduce((acc, id) => {
    acc[id] = {
      ...PLATFORMS_CONFIG[id],
      connected: false,
    }
    return acc
  }, {} as Record<PlatformId, Platform>)
}

const initialState: PlatformState = {
  platforms: buildInitialPlatforms(),
  connecting: null,
  error: null,
}

const platformSlice = createSlice({
  name: 'platforms',
  initialState,
  reducers: {
    connectPlatform(state, action: PayloadAction<Pick<Platform, 'id' | 'accountName' | 'accountAvatar' | 'accessToken' | 'tokenExpiry'>>) {
      const { id, ...rest } = action.payload
      state.platforms[id] = {
        ...state.platforms[id],
        ...rest,
        connected: true,
      }
      state.connecting = null
      state.error = null
    },
    disconnectPlatform(state, action: PayloadAction<PlatformId>) {
      const id = action.payload
      state.platforms[id] = {
        ...state.platforms[id],
        connected: false,
        accountName: undefined,
        accountAvatar: undefined,
        accessToken: undefined,
        tokenExpiry: undefined,
      }
    },
    setConnecting(state, action: PayloadAction<PlatformId | null>) {
      state.connecting = action.payload
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
      state.connecting = null
    },
  },
})

export const { connectPlatform, disconnectPlatform, setConnecting, setError } = platformSlice.actions
export default platformSlice.reducer
