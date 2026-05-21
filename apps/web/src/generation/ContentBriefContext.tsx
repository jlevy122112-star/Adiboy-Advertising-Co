import { createContext, useContext, useState, type ReactNode } from 'react'

export type BriefTone = 'professional' | 'casual' | 'enthusiastic' | 'educational' | 'promotional'

export interface PlatformCopy {
  headline?: string
  body: string
  cta?: string
  hashtags: string[]
}

export interface PlatformWarning {
  message: string
  severity: 'info' | 'warn'
}

export interface PlatformAdaptation {
  copy: PlatformCopy
  warnings: PlatformWarning[]
}

export interface MasterBrief {
  id: string
  topic: string
  tone: BriefTone
  rawHeadline: string
  rawBody: string
  rawCta: string
  rawHashtags: string[]
  media: unknown[]
  selectedPlatforms: string[]
  adaptations: Record<string, PlatformAdaptation>
  generatedAt: Date
}

const LIMITS: Record<string, { bodyMax: number; hashtagMax: number }> = {
  instagram: { bodyMax: 2200, hashtagMax: 30 },
  facebook:  { bodyMax: 63206, hashtagMax: 10 },
  x:         { bodyMax: 280,   hashtagMax: 3  },
  tiktok:    { bodyMax: 2200,  hashtagMax: 20 },
  linkedin:  { bodyMax: 3000,  hashtagMax: 10 },
  youtube:   { bodyMax: 5000,  hashtagMax: 15 },
  pinterest: { bodyMax: 500,   hashtagMax: 20 },
  snapchat:  { bodyMax: 250,   hashtagMax: 5  },
}

export function buildAdaptations(
  headline: string,
  body: string,
  cta: string,
  hashtags: string[],
  platforms: string[],
): Record<string, PlatformAdaptation> {
  const result: Record<string, PlatformAdaptation> = {}
  for (const platform of platforms) {
    const lim = LIMITS[platform] ?? { bodyMax: 2200, hashtagMax: 30 }
    const adapted: PlatformCopy = {
      headline,
      body: body.slice(0, lim.bodyMax),
      cta,
      hashtags: hashtags.slice(0, lim.hashtagMax),
    }
    const warnings: PlatformWarning[] = []
    if (body.length > lim.bodyMax) {
      warnings.push({ message: `Body truncated to ${lim.bodyMax} chars`, severity: 'warn' })
    }
    result[platform] = { copy: adapted, warnings }
  }
  return result
}

interface ContentBriefCtx {
  brief: MasterBrief | null
  setBrief: (b: MasterBrief) => void
  clearBrief: () => void
}

const Ctx = createContext<ContentBriefCtx>({
  brief: null,
  setBrief: () => {},
  clearBrief: () => {},
})

export function ContentBriefProvider({ children }: { children: ReactNode }) {
  const [brief, setBrief] = useState<MasterBrief | null>(null)
  return (
    <Ctx.Provider value={{ brief, setBrief, clearBrief: () => setBrief(null) }}>
      {children}
    </Ctx.Provider>
  )
}

export function useContentBriefContext() {
  return useContext(Ctx)
}

export interface ContentBriefCtxWithPlatform {
  brief: MasterBrief | null
  setBrief: (b: MasterBrief) => void
  clearBrief: () => void
  briefId: string | null
  adaptation: PlatformAdaptation | null
  isSelected: boolean
}

export function useContentBrief(_platform?: string): ContentBriefCtxWithPlatform {
  const ctx = useContext(Ctx)
  const adaptation = _platform ? (ctx.brief?.adaptations[_platform] ?? null) : null
  const isSelected = _platform ? (ctx.brief?.selectedPlatforms.includes(_platform) ?? false) : false
  return {
    brief: ctx.brief,
    setBrief: ctx.setBrief,
    clearBrief: ctx.clearBrief,
    briefId: ctx.brief?.id ?? null,
    adaptation,
    isSelected,
  }
}
