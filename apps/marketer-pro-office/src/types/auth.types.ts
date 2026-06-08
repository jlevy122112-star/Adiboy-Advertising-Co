export interface User {
  id: string
  email: string
  fullName: string
  avatarUrl?: string
  planTier: 'free' | 'pro' | 'enterprise'
  createdAt: string
}

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
}

export interface Session {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface SignUpCredentials extends LoginCredentials {
  fullName: string
}
