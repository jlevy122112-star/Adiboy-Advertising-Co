import { useState, useCallback } from 'react'
import { useBrand } from './useBrand'
import { generateContent } from '@/services/ai/content-generator.service'
import { buildBrandContext } from '@/services/ai/brand-injector.service'
import type { PlatformId } from '@/types/platform.types'
import type { ContentType } from '@/types/campaign.types'
import type { GeneratedContent } from '@/services/ai/content-generator.service'

interface GenerateParams {
  platform: PlatformId
  contentType: ContentType
  brief: string
  tone?: string
}

export function useAIGenerator() {
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<GeneratedContent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { brand } = useBrand()

  const generate = useCallback(async ({ platform, contentType, brief, tone }: GenerateParams) => {
    if (!brand) {
      const msg = 'Brand not set up. Complete brand setup before generating content.'
      setError(msg)
      throw new Error(msg)
    }

    setGenerating(true)
    setError(null)
    setResult(null)

    try {
      const generated = await generateContent({ brand, platform, contentType, brief, tone })
      setResult(generated)
      return generated
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

  const brandContext = brand ? buildBrandContext(brand) : null

  return { generating, result, error, brandContext, generate, reset }
}
