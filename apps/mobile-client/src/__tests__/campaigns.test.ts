import { describe, it, expect, vi } from "vitest"

type CampaignStatus = "active" | "planning" | "completed" | "paused"

interface Campaign {
  id: string
  name: string
  status: CampaignStatus
  reach: number
  engagement: number
}

const mockCampaigns: Campaign[] = [
  { id: "1", name: "Summer Drop", status: "active", reach: 12400, engagement: 8.2 },
  { id: "2", name: "Brand Refresh", status: "planning", reach: 0, engagement: 0 },
  { id: "3", name: "Q1 Push", status: "completed", reach: 45000, engagement: 6.1 },
  { id: "4", name: "Collab Series", status: "paused", reach: 3200, engagement: 4.5 },
]

const campaignService = {
  getAll: vi.fn(() => Promise.resolve(mockCampaigns)),
  getByStatus: vi.fn((status: CampaignStatus) =>
    Promise.resolve(mockCampaigns.filter(c => c.status === status))
  ),
  getById: vi.fn((id: string) =>
    Promise.resolve(mockCampaigns.find(c => c.id === id) ?? null)
  ),
  create: vi.fn((campaign: Omit<Campaign, "id">) =>
    Promise.resolve({ ...campaign, id: "5" })
  ),
}

describe("Campaign Service", () => {
  it("returns all campaigns", async () => {
    const result = await campaignService.getAll()
    expect(result).toHaveLength(4)
  })

  it("filters by active status", async () => {
    const result = await campaignService.getByStatus("active")
    expect(result.every(c => c.status === "active")).toBe(true)
  })

  it("filters by planning status", async () => {
    const result = await campaignService.getByStatus("planning")
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("Brand Refresh")
  })

  it("finds campaign by id", async () => {
    const result = await campaignService.getById("1")
    expect(result?.name).toBe("Summer Drop")
  })

  it("returns null for unknown id", async () => {
    const result = await campaignService.getById("999")
    expect(result).toBeNull()
  })

  it("creates a new campaign", async () => {
    const newCampaign = { name: "New Campaign", status: "planning" as CampaignStatus, reach: 0, engagement: 0 }
    const result = await campaignService.create(newCampaign)
    expect(result.id).toBe("5")
    expect(result.name).toBe("New Campaign")
  })
})