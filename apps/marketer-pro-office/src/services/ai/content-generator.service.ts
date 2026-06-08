import Anthropic from '@anthropic-ai/sdk'
import type { Brand } from '@/types/brand.types'
import { buildBrandContext, injectBrandVoice } from './brand-injector.service'
import { PLATFORM_LIMITS } from './platform-optimizer.service'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

export interface ContentGenerationInput {
  brand: Brand
  platform: string
  contentType: string
  brief: string
  tone?: string
}

export interface GeneratedContent {
  caption: string
  hashtags: string[]
  altText: string
}

const PLATFORM_SYSTEM_GUIDANCE: Record<string, string> = {
  instagram: `Instagram best practices:
- Character limit: ${PLATFORM_LIMITS.instagram.captionLimit} chars (aim for 138–150 for preview)
- Use 5–10 hashtags for best reach; place at end or in first comment
- Lead with a hook in the first line (shown before "more" cutoff)
- Emoji usage encouraged to improve engagement
- Call to action in the last line`,

  tiktok: `TikTok best practices:
- Character limit: ${PLATFORM_LIMITS.tiktok.captionLimit} chars — be very concise
- Use 3–5 trending hashtags
- Match the energy of short-form video content
- Conversational, punchy language
- Strong hook in first sentence`,

  twitter: `X (Twitter) best practices:
- Character limit: ${PLATFORM_LIMITS.twitter.captionLimit} chars — every word counts
- Use 1–2 hashtags maximum; more hurts engagement
- Direct, punchy, shareable
- Ask questions or make bold statements to drive replies`,

  linkedin: `LinkedIn best practices:
- Character limit: ${PLATFORM_LIMITS.linkedin.captionLimit} chars
- Professional yet approachable tone
- Lead with value or insight; first 3 lines show before "see more"
- Use 3–5 professional hashtags
- Tell a story or share a concrete lesson
- End with a question to spark comments`,

  youtube: `YouTube best practices:
- Description limit: ${PLATFORM_LIMITS.youtube.captionLimit} chars
- First 157 chars shown in search results — make them count
- Include primary keyword naturally in first sentence
- Add timestamps for longer videos
- 3–5 hashtags added at the very end
- Include links and calls to action`,

  facebook: `Facebook best practices:
- Character limit: ${PLATFORM_LIMITS.facebook.captionLimit} chars (keep under 300 for best reach)
- Use 1–2 hashtags; Facebook deprioritises hashtag-heavy posts
- Storytelling format works well
- Ask a question to drive comments
- Tag relevant pages where appropriate`,

  pinterest: `Pinterest best practices:
- Description limit: ${PLATFORM_LIMITS.pinterest.captionLimit} chars
- Use keyword-rich descriptions for search discovery
- Describe exactly what is in the image
- Include a clear call to action
- 2–5 relevant hashtags at the end`,

  threads: `Threads best practices:
- Character limit: ${PLATFORM_LIMITS.threads.captionLimit} chars
- Conversational and authentic
- Engage-bait questions or hot takes perform well
- 0–3 hashtags
- Reply threads extend your reach`,
}

function buildSystemPrompt(input: ContentGenerationInput): string {
  const platformGuidance =
    PLATFORM_SYSTEM_GUIDANCE[input.platform.toLowerCase()] ??
    `Platform: ${input.platform}. Write engaging, platform-appropriate content.`

  const brandContext = buildBrandContext(input.brand)

  return `You are an expert social media content writer specialising in crafting high-converting copy for brands.

${brandContext}

${platformGuidance}

Your job:
1. Write a caption that fits within the character limit, sounds authentically human, and reflects the brand voice above.
2. Suggest an array of hashtags (strings without the # symbol) appropriate for the platform.
3. Write concise alt text for the image/visual that is descriptive and accessible (max 125 chars).

Always return valid JSON in exactly this shape and nothing else:
{
  "caption": "<caption text>",
  "hashtags": ["hashtag1", "hashtag2"],
  "altText": "<alt text>"
}`
}

function buildUserPrompt(input: ContentGenerationInput): string {
  const toneInstruction = input.tone ? `\nTone override: ${input.tone}` : ''
  const basePrompt = `Content brief: ${input.brief}
Platform: ${input.platform}
Content type: ${input.contentType}${toneInstruction}

Generate the caption, hashtags, and alt text for this content.`

  return injectBrandVoice(basePrompt, input.brand)
}

export async function generateContent(input: ContentGenerationInput): Promise<GeneratedContent> {
  const systemPrompt = buildSystemPrompt(input)
  const userPrompt = buildUserPrompt(input)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content returned from AI')
  }

  const raw = textBlock.text.trim()
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from AI response')
  }

  const parsed = JSON.parse(jsonMatch[0]) as unknown
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('caption' in parsed) ||
    !('hashtags' in parsed) ||
    !('altText' in parsed)
  ) {
    throw new Error('AI response missing required fields')
  }

  const result = parsed as { caption: unknown; hashtags: unknown; altText: unknown }

  return {
    caption: typeof result.caption === 'string' ? result.caption : '',
    hashtags: Array.isArray(result.hashtags)
      ? result.hashtags.filter((h): h is string => typeof h === 'string')
      : [],
    altText: typeof result.altText === 'string' ? result.altText : '',
  }
}
