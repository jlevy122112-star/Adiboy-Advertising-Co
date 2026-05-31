import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

describe("Sanity check", () => {
  it("renders a div", () => {
    const { container } = render(<div data-testid="test">Hello</div>)
    expect(container).toBeTruthy()
  })

  it("finds text on screen", () => {
    render(<p>Marketer Pro</p>)
    expect(screen.getByText("Marketer Pro")).toBeTruthy()
  })
})