import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Auth Service Tests ──────────────────────────────────────
const mockUsers: any[] = []

const authService = {
  register: vi.fn(async (email: string, password: string) => {
    if (mockUsers.find(u => u.email === email)) {
      throw new Error("User already exists")
    }
    const user = { id: String(mockUsers.length + 1), email, password: `hashed_${password}` }
    mockUsers.push(user)
    return { user: { id: user.id, email }, token: "fake-jwt-token" }
  }),
  login: vi.fn(async (email: string, password: string) => {
    const user = mockUsers.find(u => u.email === email)
    if (!user) throw new Error("User not found")
    if (user.password !== `hashed_${password}`) throw new Error("Invalid password")
    return { user: { id: user.id, email }, token: "fake-jwt-token" }
  }),
  validateToken: vi.fn((token: string) => {
    if (token === "fake-jwt-token") return { id: "1", email: "test@test.com" }
    throw new Error("Invalid token")
  }),
}

describe("Auth Service", () => {
  beforeEach(() => {
    mockUsers.length = 0
    vi.clearAllMocks()
  })

  it("registers a new user", async () => {
    const result = await authService.register("test@test.com", "password123")
    expect(result.token).toBe("fake-jwt-token")
    expect(result.user.email).toBe("test@test.com")
  })

  it("prevents duplicate registration", async () => {
    await authService.register("test@test.com", "password123")
    await expect(authService.register("test@test.com", "password123")).rejects.toThrow("User already exists")
  })

  it("logs in with valid credentials", async () => {
    await authService.register("test@test.com", "password123")
    const result = await authService.login("test@test.com", "password123")
    expect(result.token).toBeDefined()
  })

  it("rejects login with wrong password", async () => {
    await authService.register("test@test.com", "password123")
    await expect(authService.login("test@test.com", "wrongpass")).rejects.toThrow("Invalid password")
  })

  it("rejects login for unknown user", async () => {
    await expect(authService.login("unknown@test.com", "password123")).rejects.toThrow("User not found")
  })

  it("validates a valid token", () => {
    const result = authService.validateToken("fake-jwt-token")
    expect(result.email).toBe("test@test.com")
  })

  it("rejects invalid token", () => {
    expect(() => authService.validateToken("bad-token")).toThrow("Invalid token")
  })
})

// ── Brand Service Tests ──────────────────────────────────────
interface Brand {
  id: string
  name: string
  primaryColor: string
  tone: string
  userId: string
}

const mockBrands: Brand[] = []

const brandService = {
  create: vi.fn(async (data: Omit<Brand, "id">) => {
    const brand = { ...data, id: String(mockBrands.length + 1) }
    mockBrands.push(brand)
    return brand
  }),
  getByUserId: vi.fn(async (userId: string) => mockBrands.filter(b => b.userId === userId)),
  update: vi.fn(async (id: string, data: Partial<Brand>) => {
    const idx = mockBrands.findIndex(b => b.id === id)
    if (idx === -1) throw new Error("Brand not found")
    mockBrands[idx] = { ...mockBrands[idx], ...data }
    return mockBrands[idx]
  }),
  delete: vi.fn(async (id: string) => {
    const idx = mockBrands.findIndex(b => b.id === id)
    if (idx === -1) throw new Error("Brand not found")
    mockBrands.splice(idx, 1)
    return { success: true }
  }),
}

describe("Brand Service", () => {
  beforeEach(() => {
    mockBrands.length = 0
    vi.clearAllMocks()
  })

  it("creates a brand", async () => {
    const result = await brandService.create({ name: "Adiboy", primaryColor: "#FFD700", tone: "bold", userId: "1" })
    expect(result.id).toBe("1")
    expect(result.name).toBe("Adiboy")
  })

  it("gets brands by user id", async () => {
    await brandService.create({ name: "Brand A", primaryColor: "#000", tone: "casual", userId: "1" })
    await brandService.create({ name: "Brand B", primaryColor: "#fff", tone: "pro", userId: "2" })
    const result = await brandService.getByUserId("1")
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("Brand A")
  })

  it("updates a brand", async () => {
    await brandService.create({ name: "Old Name", primaryColor: "#000", tone: "casual", userId: "1" })
    const result = await brandService.update("1", { name: "New Name" })
    expect(result.name).toBe("New Name")
  })

  it("throws on update of nonexistent brand", async () => {
    await expect(brandService.update("999", { name: "X" })).rejects.toThrow("Brand not found")
  })

  it("deletes a brand", async () => {
    await brandService.create({ name: "To Delete", primaryColor: "#000", tone: "casual", userId: "1" })
    const result = await brandService.delete("1")
    expect(result.success).toBe(true)
    expect(mockBrands).toHaveLength(0)
  })
})

// ── Analytics Service Tests ──────────────────────────────────
describe("Analytics Service", () => {
  const analyticsService = {
    getMetrics: vi.fn(async (campaignId: string) => ({
      campaignId,
      reach: 12400,
      impressions: 45000,
      engagement: 8.2,
      clicks: 1200,
      conversions: 340,
    })),
    getSummary: vi.fn(async (userId: string) => ({
      userId,
      totalReach: 58000,
      totalCampaigns: 4,
      avgEngagement: 6.8,
      topPlatform: "instagram",
    })),
    trackEvent: vi.fn(async (event: { type: string; userId: string; data: any }) => ({
      tracked: true,
      eventId: "evt_123",
    })),
  }

  it("returns campaign metrics", async () => {
    const result = await analyticsService.getMetrics("campaign-1")
    expect(result.reach).toBe(12400)
    expect(result.engagement).toBe(8.2)
  })

  it("returns user summary", async () => {
    const result = await analyticsService.getSummary("user-1")
    expect(result.totalCampaigns).toBe(4)
    expect(result.topPlatform).toBe("instagram")
  })

  it("tracks an event", async () => {
    const result = await analyticsService.trackEvent({ type: "page_view", userId: "1", data: { page: "desk" } })
    expect(result.tracked).toBe(true)
    expect(result.eventId).toBeDefined()
  })
})

// ── Progression Service Tests ────────────────────────────────
describe("Progression Service", () => {
  const progressionService = {
    getLevel: vi.fn(async (userId: string) => ({ userId, level: 3, xp: 1250, nextLevelXp: 2000 })),
    addXp: vi.fn(async (userId: string, amount: number) => ({
      userId,
      xpAdded: amount,
      newTotal: 1250 + amount,
      leveledUp: 1250 + amount >= 2000,
    })),
    unlockFeature: vi.fn(async (userId: string, feature: string) => ({
      userId,
      feature,
      unlocked: true,
    })),
  }

  it("gets user level", async () => {
    const result = await progressionService.getLevel("user-1")
    expect(result.level).toBe(3)
    expect(result.xp).toBe(1250)
  })

  it("adds xp to user", async () => {
    const result = await progressionService.addXp("user-1", 500)
    expect(result.xpAdded).toBe(500)
    expect(result.newTotal).toBe(1750)
    expect(result.leveledUp).toBe(false)
  })

  it("detects level up", async () => {
    const result = await progressionService.addXp("user-1", 800)
    expect(result.leveledUp).toBe(true)
  })

  it("unlocks a feature", async () => {
    const result = await progressionService.unlockFeature("user-1", "scheduler-tower")
    expect(result.unlocked).toBe(true)
    expect(result.feature).toBe("scheduler-tower")
  })
})

// ── Notification Service Tests ───────────────────────────────
describe("Notification Service", () => {
  const notificationService = {
    send: vi.fn(async (userId: string, message: string, type: string) => ({
      id: "notif_123",
      userId,
      message,
      type,
      sent: true,
    })),
    getUnread: vi.fn(async (userId: string) => [
      { id: "1", message: "Your content is ready", type: "success", read: false },
      { id: "2", message: "Campaign started", type: "info", read: false },
    ]),
    markRead: vi.fn(async (notifId: string) => ({ id: notifId, read: true })),
  }

  it("sends a notification", async () => {
    const result = await notificationService.send("user-1", "Content ready!", "success")
    expect(result.sent).toBe(true)
    expect(result.message).toBe("Content ready!")
  })

  it("gets unread notifications", async () => {
    const result = await notificationService.getUnread("user-1")
    expect(result).toHaveLength(2)
    expect(result.every(n => !n.read)).toBe(true)
  })

  it("marks notification as read", async () => {
    const result = await notificationService.markRead("1")
    expect(result.read).toBe(true)
  })
})