/**
 * Server-side text chunking for brand memory ingest.
 *
 * Token counting: BPE (as used by OpenAI models) averages ~1.35 tokens per
 * English word. We use that multiplier so chunk sizes stay within real model
 * context windows without pulling in a tokenizer dependency. The denominator
 * for maxTokens/overlapTokens is adjusted accordingly so callers can still
 * think in model-token units.
 */

export interface ChunkTextByTokensConfig {
  readonly maxTokens: number;
  readonly overlapTokens: number;
}

export interface TextChunk {
  readonly chunkIndex: number;
  readonly text: string;
  /** Estimated BPE token count (words × 1.35, rounded up). */
  readonly tokenCount: number;
}

const BPE_TOKENS_PER_WORD = 1.35;

/** Estimate BPE token count for a word slice without a tokenizer dependency. */
function estimateTokens(wordCount: number): number {
  return Math.ceil(wordCount * BPE_TOKENS_PER_WORD);
}

/**
 * Split on whitespace and chunk so that estimated BPE token count per chunk
 * stays within maxTokens. Overlap repeats tail words between consecutive chunks.
 */
export function chunkTextByTokenWords(
  rawText: string,
  cfg: ChunkTextByTokensConfig,
): TextChunk[] {
  const words = rawText.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  // Convert token budget back to word budget using the BPE multiplier.
  const maxWords = Math.max(1, Math.floor(cfg.maxTokens / BPE_TOKENS_PER_WORD));
  const overlapWords = Math.min(
    Math.max(0, Math.floor(cfg.overlapTokens / BPE_TOKENS_PER_WORD)),
    Math.max(0, maxWords - 1),
  );
  const out: TextChunk[] = [];
  let start = 0;
  let chunkIndex = 0;
  while (start < words.length) {
    const end = Math.min(start + maxWords, words.length);
    const slice = words.slice(start, end);
    const text = slice.join(" ");
    const tokenCount = estimateTokens(slice.length);
    out.push({ chunkIndex, text, tokenCount });
    if (end >= words.length) {
      break;
    }
    const nextStart = Math.max(end - overlapWords, start + 1);
    start = nextStart;
    chunkIndex += 1;
  }
  return out;
}
