import { useState, useCallback } from 'react'
import { useBrand } from './useBrand'
import { supabase } from '@/services/api/supabase.client'
import type { PlatformId } from '@/types/platform.types'
import type { ContentType } from '@/types/campaign.types'
import type { Brand } from '@/types/brand.types'

interface GenerateParams {
  platform: PlatformId
  contentType: ContentType
  brief: string
}

interface GeneratedContent {
  caption: string
  hashtags: string[]
  altText?: string
  suggestedMediaPrompt?: string
}

function buildBrandContext(brand: Brand | null): string {
  if (!brand) return ''

  const parts: string[] = [
    `Brand: ${brand.name}`,
    brand.tagline ? `Tagline: ${brand.tagline}` : '',
    `Industry: ${brand.industry}`,
    `Target audience: ${brand.targetAudience}`,
    `Voice: ${brand.voice.tone}, ${brand.voice.formality}`,
    brand.voice.personality.length > 0
      ? `Personality traits: ${brand.voice.personality.join(', ')}`
      : '',
    brand.voice.preferredPhrases.length > 0
      ? `Preferred phrases: ${brand.voice.preferredPhrases.join(', ')}`
      : '',
    brand.voice.bannedWords.length > 0
      ? `Avoid these words: ${brand.voice.bannedWords.join(', ')}`
      : '',
  ]

  return parts.filter(Boolean).join('\n')
}

export function useAIGenerator() {
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<GeneratedContent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { brand } = useBrand()

  const generate = useCallback(async ({ platform, contentType, brief }: GenerateParams) => {
    setGenerating(true)
    setError(null)
    setResult(null)

    try {
      const brandContext = buildBrandContext(brand)

      const { data, error: fnError } = await supabase.functions.invoke<GeneratedContent>(
        'generate-content',
        {
          body: {
            platform,
            contentType,
            brief,
            brandContext,
          },
        },
      )

      if (fnError) throw fnError
      if (!data) throw new Error('No content returned from generator')

      setResult(data)
      return data
    } catch (err) {
      const message = (err as Error).message ?? 'Generation failed'
      setError(message)
      throw err
    } finally {
      setGenerating(false)
    }
  }, [brand])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
    setGenerating(false)
  }, [])

  return { generating, result, error, generate, reset }
}
