import type { Brand, BrandVoice } from '@/types/brand.types'

function formatList(items: string[], label: string): string {
  if (!items.length) return ''
  return `${label}: ${items.join(', ')}`
}

function toneDescription(tone: BrandVoice['tone']): string {
  const map: Record<BrandVoice['tone'], string> = {
    professional: 'polished and authoritative, suited to business audiences',
    casual: 'relaxed and friendly, like talking to a knowledgeable friend',
    witty: 'clever, playful, and lightly humorous without being flippant',
    inspirational: 'motivating and uplifting, focused on possibility and aspiration',
    authoritative: 'confident and expert, backed by credibility and data',
  }
  return map[tone]
}

function formalityDescription(formality: BrandVoice['formality']): string {
  const map: Record<BrandVoice['formality'], string> = {
    formal: 'Use complete sentences, avoid contractions, and maintain professional distance.',
    'semi-formal': 'Balance professionalism with approachability. Contractions are fine.',
    informal: 'Conversational and warm. Contractions, short sentences, and slang are welcome.',
  }
  return map[formality]
}

export function buildBrandContext(brand: Brand): string {
  const { voice } = brand

  const parts: string[] = [
    `Brand: ${brand.name}`,
    brand.tagline ? `Tagline: "${brand.tagline}"` : '',
    `Industry: ${brand.industry}`,
    `Target audience: ${brand.targetAudience}`,
    '',
    '— Brand Voice —',
    `Tone: ${voice.tone} — ${toneDescription(voice.tone)}`,
    `Formality: ${formalityDescription(voice.formality)}`,
    voice.personality.length ? `Personality traits: ${voice.personality.join(', ')}` : '',
    formatList(voice.bannedWords, 'Never use these words/phrases'),
    formatList(voice.preferredPhrases, 'Preferred phrases to use'),
    '',
    '— Visual Identity —',
    `Primary colour: ${brand.primaryColor}`,
    `Secondary colour: ${brand.secondaryColor}`,
    `Accent colour: ${brand.accentColor}`,
  ]

  return parts.filter(Boolean).join('\n')
}

export function injectBrandVoice(prompt: string, brand: Brand): string {
  const { voice } = brand

  const injections: string[] = []

  if (voice.bannedWords.length) {
    injections.push(`IMPORTANT — Do not use any of these words or phrases: ${voice.bannedWords.join(', ')}.`)
  }

  if (voice.preferredPhrases.length) {
    injections.push(`Where natural, incorporate these brand phrases: ${voice.preferredPhrases.join(', ')}.`)
  }

  if (voice.personality.length) {
    injections.push(`The writing should feel: ${voice.personality.join(', ')}.`)
  }

  injections.push(`Overall tone: ${voice.tone}. Formality: ${voice.formality}.`)

  if (!injections.length) return prompt

  return `${prompt.trimEnd()}

Brand voice reminders:
${injections.join('\n')}`
}
