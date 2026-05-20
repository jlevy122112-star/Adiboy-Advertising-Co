/**
 * ContentBriefContext — shared state for the "write once, publish everywhere" flow.
 *
 * The generator produces one MasterBrief. adaptCopyToPlatform() (from the contract,
 * runs client-side instantly) produces per-platform AdaptedDrafts. Each studio
 * calls useContentBrief('instagram') to receive its pre-filled content and shows
 * an "AI-generated" badge with a visible edit affordance.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import {
  adaptCopyToPlatform,
  type PlatformAdaptationResult,
  type PublishableNetwork,
} from '@home-link/marketer-pro-contract'
import type { MediaItem } from '../platform-studio/MediaDropZone'

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface MasterBrief {
  /** Changes on every generation — studios use this to detect new content. */
  id: string
  topic: string
  tone: BriefTone
  rawHeadline: string
  rawBody: string
  rawCta: string
  rawHashtags: string[]
  media: MediaItem[]
  selectedPlatforms: PublishableNetwork[]
  /** Keyed by network — populated synchronously after generation. */
  adaptations: Partial<Record<PublishableNetwork, PlatformAdaptationResult>>
  generatedAt: Date
}

export type BriefTone =
  | 'professional'
  | 'casual'
  | 'enthusiastic'
  | 'educational'
  | 'promotional'

export interface PlatformDraftReadyPayload {
  network: PublishableNetwork
  caption: string
  hashtags: string[]
  scheduledAt: Date | null
}

interface ContentBriefContextValue {
  brief: MasterBrief | null
  setBrief: (brief: MasterBrief | null) => void
  clearBrief: () => void
  getAdaptation: (network: PublishableNetwork) => PlatformAdaptationResult | null
  /** Studios call this when user clicks Publish. Aggregated by the generator UI. */
  registerReadyDraft: (payload: PlatformDraftReadyPayload) => void
  readyDrafts: PlatformDraftReadyPayload[]
}

/* -------------------------------------------------------------------------- */
/*  Context                                                                    */
/* -------------------------------------------------------------------------- */

const ContentBriefContext = createContext<ContentBriefContextValue>({
  brief: null,
  setBrief: () => {},
  clearBrief: () => {},
  getAdaptation: () => null,
  registerReadyDraft: () => {},
  readyDrafts: [],
})

export function ContentBriefProvider({ children }: { children: ReactNode }) {
  const [brief, setBriefState] = useState<MasterBrief | null>(null)
  const [readyDrafts, setReadyDrafts] = useState<PlatformDraftReadyPayload[]>([])

  const setBrief = useCallback((b: MasterBrief | null) => {
    setBriefState(b)
    setReadyDrafts([])
  }, [])

  const clearBrief = useCallback(() => {
    setBriefState(null)
    setReadyDrafts([])
  }, [])

  const getAdaptation = useCallback(
    (network: PublishableNetwork): PlatformAdaptationResult | null =>
      brief?.adaptations[network] ?? null,
    [brief],
  )

  const registerReadyDraft = useCallback((payload: PlatformDraftReadyPayload) => {
    setReadyDrafts(prev => {
      const without = prev.filter(d => d.network !== payload.network)
      return [...without, payload]
    })
  }, [])

  return (
    <ContentBriefContext.Provider
      value={{ brief, setBrief, clearBrief, getAdaptation, registerReadyDraft, readyDrafts }}
    >
      {children}
    </ContentBriefContext.Provider>
  )
}

/* -------------------------------------------------------------------------- */
/*  Hooks                                                                      */
/* -------------------------------------------------------------------------- */

/** Use inside the generator UI — full context access. */
export function useContentBriefContext() {
  return useContext(ContentBriefContext)
}

/**
 * Use inside a platform studio. Returns the adapted draft for that network
 * so the studio can pre-fill its form when a new brief arrives.
 */
export function useContentBrief(network: PublishableNetwork) {
  const { brief, getAdaptation, registerReadyDraft } = useContext(ContentBriefContext)
  return {
    briefId: brief?.id ?? null,
    adaptation: getAdaptation(network),
    media: brief?.media ?? [],
    selectedPlatforms: brief?.selectedPlatforms ?? [],
    isSelected: brief?.selectedPlatforms.includes(network) ?? false,
    registerReadyDraft,
  }
}

/* -------------------------------------------------------------------------- */
/*  Helper — build adaptations synchronously from a raw brief                 */
/* -------------------------------------------------------------------------- */

export function buildAdaptations(
  rawHeadline: string,
  rawBody: string,
  rawCta: string,
  rawHashtags: string[],
  platforms: PublishableNetwork[],
): Partial<Record<PublishableNetwork, PlatformAdaptationResult>> {
  const source = {
    headline: rawHeadline || undefined,
    body: rawBody || undefined,
    cta: rawCta || undefined,
    hashtags: rawHashtags.length ? rawHashtags : undefined,
  }
  const adaptations: Partial<Record<PublishableNetwork, PlatformAdaptationResult>> = {}
  for (const network of platforms) {
    adaptations[network] = adaptCopyToPlatform({ source, network })
  }
  return adaptations
}
