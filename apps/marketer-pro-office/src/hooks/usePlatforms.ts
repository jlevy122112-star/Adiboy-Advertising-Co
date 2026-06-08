import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/store'
import {
  connectPlatform as connectPlatformAction,
  disconnectPlatform as disconnectPlatformAction,
  setConnecting,
  setError,
} from '@/store/slices/platformSlice'
import { supabase } from '@/services/api/supabase.client'
import type { PlatformId } from '@/types/platform.types'

interface OAuthTokenResponse {
  accountName: string
  accountAvatar?: string
  accessToken: string
  tokenExpiry: string
}

export function usePlatforms() {
  const dispatch = useAppDispatch()
  const { platforms, connecting, error } = useAppSelector(s => s.platforms)

  const connectPlatform = useCallback(async (platform: PlatformId, oauthCode: string) => {
    dispatch(setConnecting(platform))
    dispatch(setError(null))
    try {
      const { data, error: fnError } = await supabase.functions.invoke<OAuthTokenResponse>(
        'oauth-callback',
        { body: { platform, code: oauthCode } },
      )

      if (fnError) throw fnError
      if (!data) throw new Error('No token data returned')

      dispatch(connectPlatformAction({
        id: platform,
        accountName: data.accountName,
        accountAvatar: data.accountAvatar,
        accessToken: data.accessToken,
        tokenExpiry: data.tokenExpiry,
      }))
    } catch (err) {
      dispatch(setError((err as Error).message))
      throw err
    }
  }, [dispatch])

  const disconnectPlatform = useCallback(async (platform: PlatformId) => {
    dispatch(setError(null))
    try {
      await supabase.functions.invoke('oauth-callback', {
        body: { platform, action: 'disconnect' },
      })
      dispatch(disconnectPlatformAction(platform))
    } catch (err) {
      dispatch(setError((err as Error).message))
      throw err
    }
  }, [dispatch])

  const getConnectedPlatforms = useCallback(() => {
    return Object.values(platforms).filter(p => p.connected)
  }, [platforms])

  const isConnected = useCallback((platform: PlatformId) => {
    return platforms[platform]?.connected ?? false
  }, [platforms])

  return {
    platforms,
    connecting,
    error,
    connectPlatform,
    disconnectPlatform,
    getConnectedPlatforms,
    isConnected,
  }
}
