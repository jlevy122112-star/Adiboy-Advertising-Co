/**
 * Minimal OpenAI Embeddings client for brand memory retrieval (no extra npm deps).
 * Returns a 1536-dim float array from text-embedding-ada-002 (or a compatible
 * model set via MARKETER_EMBEDDING_MODEL).
 */

const REQUEST_TIMEOUT_MS = 20_000;

export type OpenAiEmbeddingParams = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly input: string;
};

function extractEmbeddingVector(parsed: unknown): number[] | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const data = (parsed as Record<string, unknown>).data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  if (typeof first !== "object" || first === null) return null;
  const embedding = (first as Record<string, unknown>).embedding;
  if (!Array.isArray(embedding)) return null;
  for (const v of embedding) {
    if (typeof v !== "number") return null;
  }
  return embedding as number[];
}

export async function getOpenAiEmbedding(
  params: OpenAiEmbeddingParams,
): Promise<number[]> {
  const base = params.baseUrl.replace(/\/+$/, "");
  const url = `${base}/embeddings`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: params.model, input: params.input }),
    });
  } finally {
    clearTimeout(timer);
  }
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI Embeddings HTTP ${res.status}: ${raw.slice(0, 400)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("OpenAI Embeddings response was not valid JSON");
  }
  const vec = extractEmbeddingVector(parsed);
  if (!vec) {
    throw new Error("OpenAI Embeddings response missing embedding vector");
  }
  return vec;
}
