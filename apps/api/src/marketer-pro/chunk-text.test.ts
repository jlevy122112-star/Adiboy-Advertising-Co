import { describe, expect, it } from "vitest";

import { chunkTextByTokenWords } from "./chunk-text.js";

describe("chunkTextByTokenWords", () => {
  it("returns one chunk when text fits maxTokens", () => {
    const chunks = chunkTextByTokenWords("one two three", {
      maxTokens: 10,
      overlapTokens: 0,
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.tokenCount).toBe(5); // ceil(3 words * 1.35 BPE multiplier)
  });

  it("splits when longer than maxTokens and applies overlap", () => {
    const words = Array.from({ length: 20 }, (_, i) => `w${i}`).join(" ");
    const chunks = chunkTextByTokenWords(words, {
      maxTokens: 8,
      overlapTokens: 2,
    });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.chunkIndex).toBe(0);
    expect(chunks.every((c) => c.text.length > 0)).toBe(true);
  });

  it("returns empty array for whitespace-only input", () => {
    expect(
      chunkTextByTokenWords("   \n\t  ", { maxTokens: 50, overlapTokens: 0 }),
    ).toEqual([]);
  });
});
