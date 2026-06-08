import { useEffect, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/store'
import { setUser, setSession, setLoading, setError, logout as logoutAction } from '@/store/slices/authSlice'
import * as authApi from '@/services/api/auth.api'
import type { User } from '@/types/auth.types'

function mapSupabaseUser(supabaseUser: NonNullable<Awaited<ReturnType<typeof authApi.getSession>> extends infer S ? S extends { user: infer U } ? U : never : never>): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    fullName: (supabaseUser.user_metadata?.full_name as string | undefined) ?? '',
    avatarUrl: (supabaseUser.user_metadata?.avatar_url as string | undefined) ?? undefined,
    planTier: 'free',
    createdAt: supabaseUser.created_at,
  }
}

export function useAuth() {
  const dispatch = useAppDispatch()
  const { user, session, loading, error } = useAppSelector(s => s.auth)

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      dispatch(setLoading(true))
      try {
        const supabaseSession = await authApi.getSession()
        if (!mounted) return
        if (supabaseSession) {
          dispatch(setSession({
            accessToken: supabaseSession.access_token,
            refreshToken: supabaseSession.refresh_token,
            expiresAt: supabaseSession.expires_at ?? 0,
          }))
          dispatch(setUser(mapSupabaseUser(supabaseSession.user)))
        }
      } catch (err) {
        if (mounted) dispatch(setError((err as Error).message))
      } finally {
        if (mounted) dispatch(setLoading(false))
      }
    }

    bootstrap()

    const subscription = authApi.onAuthStateChange((_event, supabaseSession) => {
      if (!mounted) return
      if (supabaseSession) {
        dispatch(setSession({
          accessToken: supabaseSession.access_token,
          refreshToken: supabaseSession.refresh_token,
          expiresAt: supabaseSession.expires_at ?? 0,
        }))
        dispatch(setUser(mapSupabaseUser(supabaseSession.user)))
      } else {
        dispatch(logoutAction())
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [dispatch])

  const login = useCallback(async (email: string, password: string) => {
    dispatch(setLoading(true))
    dispatch(setError(null))
    try {
      const { session: s, user: u } = await authApi.signIn(email, password)
      if (s) {
        dispatch(setSession({
          accessToken: s.access_token,
          refreshToken: s.refresh_token,
          expiresAt: s.expires_at ?? 0,
        }))
      }
      if (u) dispatch(setUser(mapSupabaseUser(u)))
    } catch (err) {
      dispatch(setError((err as Error).message))
      throw err
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch])

  const signup = useCallback(async (email: string, password: string, name: string) => {
    dispatch(setLoading(true))
    dispatch(setError(null))
    try {
      const { session: s, user: u } = await authApi.signUp(email, password, name)
      if (s) {
        dispatch(setSession({
          accessToken: s.access_token,
          refreshToken: s.refresh_token,
          expiresAt: s.expires_at ?? 0,
        }))
      }
      if (u) dispatch(setUser(mapSupabaseUser(u)))
    } catch (err) {
      dispatch(setError((err as Error).message))
      throw err
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch])

  const logout = useCallback(async () => {
    dispatch(setLoading(true))
    try {
      await authApi.signOut()
      dispatch(logoutAction())
    } catch (err) {
      dispatch(setError((err as Error).message))
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch])

  const loginWithGoogle = useCallback(async () => {
    dispatch(setError(null))
    try {
      await authApi.signInWithGoogle()
    } catch (err) {
      dispatch(setError((err as Error).message))
      throw err
    }
  }, [dispatch])

  const loginWithApple = useCallback(async () => {
    dispatch(setError(null))
    try {
      await authApi.signInWithApple()
    } catch (err) {
      dispatch(setError((err as Error).message))
      throw err
    }
  }, [dispatch])

  return { user, session, loading, error, login, signup, logout, loginWithGoogle, loginWithApple }
}
