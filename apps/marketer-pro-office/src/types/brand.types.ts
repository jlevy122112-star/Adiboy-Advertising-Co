export interface Brand {
  id: string
  workspaceId: string
  name: string
  tagline?: string
  logoUrl?: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  voice: BrandVoice
  industry: string
  targetAudience: string
  createdAt: string
  updatedAt: string
}

export interface BrandVoice {
  tone: 'professional' | 'casual' | 'witty' | 'inspirational' | 'authoritative'
  formality: 'formal' | 'semi-formal' | 'informal'
  personality: string[]
  bannedWords: string[]
  preferredPhrases: string[]
}

export interface BrandState {
  brand: Brand | null
  loading: boolean
  error: string | null
  setupComplete: boolean
}
