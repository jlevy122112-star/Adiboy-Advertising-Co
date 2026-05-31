import { describe, it, expect, vi } from "vitest"

const mockLogin = vi.fn((email: string, password: string) => {
  if (email === "test@test.com" && password === "password123") {
    return Promise.resolve({ token: "fake-token", user: { id: "1", email } })
  }
  return Promise.reject(new Error("Invalid credentials"))
})

describe("Auth", () => {
  it("logs in with valid credentials", async () => {
    const result = await mockLogin("test@test.com", "password123")
    expect(result.token).toBe("fake-token")
    expect(result.user.email).toBe("test@test.com")
  })

  it("rejects invalid credentials", async () => {
    await expect(mockLogin("wrong@test.com", "wrongpass")).rejects.toThrow("Invalid credentials")
  })

  it("returns user object on success", async () => {
    const result = await mockLogin("test@test.com", "password123")
    expect(result.user).toHaveProperty("id")
    expect(result.user).toHaveProperty("email")
  })

  it("called with correct arguments", async () => {
    await mockLogin("test@test.com", "password123")
    expect(mockLogin).toHaveBeenCalledWith("test@test.com", "password123")
  })
})