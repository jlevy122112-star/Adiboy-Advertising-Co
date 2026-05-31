import { describe, it, expect, vi } from "vitest"

type Scene = "vault" | "reactor" | "desk" | "campaign" | "analytics" | "forge"

const stateMachine = {
  current: "vault" as Scene,
  transitions: {
    vault: ["reactor"],
    reactor: ["desk"],
    desk: ["campaign", "analytics", "forge"],
    campaign: ["desk"],
    analytics: ["desk"],
    forge: ["desk"],
  } as Record<Scene, Scene[]>,
  transition(to: Scene): boolean {
    const allowed = this.transitions[this.current]
    if (allowed.includes(to)) {
      this.current = to
      return true
    }
    return false
  },
  reset() {
    this.current = "vault"
  }
}

describe("Cinematic State Machine", () => {
  it("starts at vault scene", () => {
    stateMachine.reset()
    expect(stateMachine.current).toBe("vault")
  })

  it("transitions from vault to reactor", () => {
    stateMachine.reset()
    const result = stateMachine.transition("reactor")
    expect(result).toBe(true)
    expect(stateMachine.current).toBe("reactor")
  })

  it("transitions from reactor to desk", () => {
    stateMachine.reset()
    stateMachine.transition("reactor")
    const result = stateMachine.transition("desk")
    expect(result).toBe(true)
    expect(stateMachine.current).toBe("desk")
  })

  it("blocks invalid transitions", () => {
    stateMachine.reset()
    const result = stateMachine.transition("desk")
    expect(result).toBe(false)
    expect(stateMachine.current).toBe("vault")
  })

  it("allows desk to navigate to all departments", () => {
    stateMachine.reset()
    stateMachine.transition("reactor")
    stateMachine.transition("desk")
    expect(stateMachine.transition("campaign")).toBe(true)
    stateMachine.transition("desk")
    expect(stateMachine.transition("analytics")).toBe(true)
    stateMachine.transition("desk")
    expect(stateMachine.transition("forge")).toBe(true)
  })
})