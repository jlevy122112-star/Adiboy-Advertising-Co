import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

describe("Button", () => {
  it("renders with label", () => {
    render(<button>Click Me</button>)
    expect(screen.getByText("Click Me")).toBeTruthy()
  })
  it("renders disabled state", () => {
    render(<button disabled>Click Me</button>)
    expect(screen.getByText("Click Me").closest("button")).toHaveProperty("disabled", true)
  })
})

describe("Card", () => {
  it("renders children", () => {
    render(<div className="card"><span>Card Content</span></div>)
    expect(screen.getByText("Card Content")).toBeTruthy()
  })
})

describe("Modal", () => {
  it("renders when open", () => {
    render(<div role="dialog"><p>Modal Content</p></div>)
    expect(screen.getByRole("dialog")).toBeTruthy()
  })
  it("renders content inside", () => {
    render(<div role="dialog"><p>Hello Modal</p></div>)
    expect(screen.getByText("Hello Modal")).toBeTruthy()
  })
})