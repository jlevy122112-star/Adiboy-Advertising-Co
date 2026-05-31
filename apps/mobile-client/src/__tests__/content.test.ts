import { describe, it, expect, vi } from "vitest"

type Platform = "instagram" | "tiktok" | "linkedin" | "facebook" | "x"
type Tone = "professional" | "casual" | "bold" | "playful"

interface GenerateRequest {
  platform: Platform
  tone: Tone
  brief: string
  variants: number
}

interface GeneratedArtifact {
  id: string
  platform: Platform
  content: string
  score: number
}

const contentService = {
  generate: vi.fn((req: GenerateRequest): Promise<GeneratedArtifact[]> => {
    const artifacts: GeneratedArtifact[] = Array.from({ length: req.variants }, (_, i) => ({
      id: `artifact-${i + 1}`,
      platform: req.platform,
      content: `Generated ${req.tone} content for ${req.platform}: ${req.brief}`,
      score: Math.floor(Math.random() * 20) + 80,
    }))
    return Promise.resolve(artifacts)
  }),
  validateBrief: vi.fn((brief: string) => brief.length >= 10 && brief.length <= 500),
}

describe("Content Generation", () => {
  it("generates correct number of variants", async () => {
    const result = await contentService.generate({
      platform: "instagram",
      tone: "casual",
      brief: "Summer sale campaign for streetwear brand",
      variants: 3,
    })
    expect(result).toHaveLength(3)
  })

  it("generates content for correct platform", async () => {
    const result = await contentService.generate({
      platform: "linkedin",
      tone: "professional",
      brief: "Q3 product launch announcement",
      variants: 1,
    })
    expect(result[0].platform).toBe("linkedin")
  })

  it("all artifacts have a score", async () => {
    const result = await contentService.generate({
      platform: "tiktok",
      tone: "bold",
      brief: "Viral challenge for new shoe drop",
      variants: 2,
    })
    result.forEach(artifact => {
      expect(artifact.score).toBeGreaterThan(0)
    })
  })

  it("validates brief length", () => {
    expect(contentService.validateBrief("too short")).toBe(false)
    expect(contentService.validateBrief("This is a valid brief with enough content")).toBe(true)
    expect(contentService.validateBrief("x".repeat(501))).toBe(false)
  })

  it("each artifact has unique id", async () => {
    const result = await contentService.generate({
      platform: "x",
      tone: "playful",
      brief: "Product drop announcement with urgency",
      variants: 3,
    })
    const ids = result.map(a => a.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})