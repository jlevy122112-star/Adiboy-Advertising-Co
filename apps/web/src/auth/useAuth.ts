import { useState, useEffect, useCallback, useRef } from 'react'

const AUTH_API = import.meta.env.VITE_AUTH_API_ORIGIN as string ?? 'http://localhost:8798'

export type AuthUser = {
  id: string
  email: string
  role: string
  tenantId: string
  emailVerified: boolean
}

type Tokens = {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: AuthUser; accessToken: string }
  | { status: 'unauthenticated' }

const TOKEN_KEY = 'mp_refresh_token'

function saveRefreshToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token) } catch { /* storage unavailable */ }
}

function loadRefreshToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

function clearRefreshToken() {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* storage unavailable */ }
}

async function apiRefresh(refreshToken: string): Promise<{ tokens: Tokens } | null> {
  const res = await fetch(`${AUTH_API}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) return null
  return res.json() as Promise<{ tokens: Tokens }>
}

let _accessToken: string | null = null
let _refreshPromise: Promise<string | null> | null = null

export function getAccessToken(): string | null {
  return _accessToken
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleRefresh = useCallback((expiresInS: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    const delay = Math.max((expiresInS - 60) * 1000, 10_000)
    refreshTimerRef.current = setTimeout(() => silentRefresh(), delay)
  }, [])

  const silentRefresh = useCallback(async () => {
    const stored = loadRefreshToken()
    if (!stored) { setState({ status: 'unauthenticated' }); return }

    if (_refreshPromise) { await _refreshPromise; return }
    _refreshPromise = (async () => {
      const data = await apiRefresh(stored)
      if (!data) {
        clearRefreshToken()
        _accessToken = null
        setState({ status: 'unauthenticated' })
        return null
      }
      _accessToken = data.tokens.accessToken
      saveRefreshToken(data.tokens.refreshToken)
      scheduleRefresh(data.tokens.expiresIn)
      return data.tokens.accessToken
    })()
    const tok = await _refreshPromise
    _refreshPromise = null
    return tok
  }, [scheduleRefresh])

  const fetchMe = useCallback(async (accessToken: string) => {
    const res = await fetch(`${AUTH_API}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const { user } = await res.json() as { user: AuthUser }
    return user
  }, [])

  useEffect(() => {
    const stored = loadRefreshToken()
    if (!stored) { setState({ status: 'unauthenticated' }); return }

    apiRefresh(stored).then(async data => {
      if (!data) {
        clearRefreshToken()
        setState({ status: 'unauthenticated' })
        return
      }
      _accessToken = data.tokens.accessToken
      saveRefreshToken(data.tokens.refreshToken)
      scheduleRefresh(data.tokens.expiresIn)
      const user = await fetchMe(data.tokens.accessToken)
      if (!user) { setState({ status: 'unauthenticated' }); return }
      setState({ status: 'authenticated', user, accessToken: data.tokens.accessToken })
    })

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [])

  const login = useCallback(async (email: string, password: string, tenantId: string): Promise<string | null> => {
    const res = await fetch(`${AUTH_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, tenantId }),
    })
    if (!res.ok) {
      const { error } = await res.json() as { error: string }
      return error
    }
    const { user, tokens } = await res.json() as { user: AuthUser; tokens: Tokens }
    _accessToken = tokens.accessToken
    saveRefreshToken(tokens.refreshToken)
    scheduleRefresh(tokens.expiresIn)
    setState({ status: 'authenticated', user, accessToken: tokens.accessToken })
    return null
  }, [scheduleRefresh])

  const signup = useCallback(async (email: string, password: string, tenantId: string): Promise<string | null> => {
    const res = await fetch(`${AUTH_API}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, tenantId }),
    })
    if (!res.ok) {
      const { error } = await res.json() as { error: string }
      return error
    }
    const { user, tokens } = await res.json() as { user: AuthUser; tokens: Tokens }
    _accessToken = tokens.accessToken
    saveRefreshToken(tokens.refreshToken)
    scheduleRefresh(tokens.expiresIn)
    setState({ status: 'authenticated', user, accessToken: tokens.accessToken })
    return null
  }, [scheduleRefresh])

  const logout = useCallback(async () => {
    const stored = loadRefreshToken()
    clearRefreshToken()
    _accessToken = null
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    setState({ status: 'unauthenticated' })
    if (stored) {
      fetch(`${AUTH_API}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: stored }),
      }).catch(() => {})
    }
  }, [])

  return { state, login, signup, logout, silentRefresh }
}
