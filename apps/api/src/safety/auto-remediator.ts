import type { ScanFinding } from "@home-link/marketer-pro-contract";

const OPENAI_BASE = "https://api.openai.com";
const TIMEOUT_MS = 30_000;

function buildPrompt(text: string, findings: ScanFinding[]): string {
  const issues = findings.map(f =>
    `- [${f.code}] ${f.message}${f.snippet ? ` (snippet: "${f.snippet}")` : ""}`
  ).join("\n");
  return `You are a marketing compliance editor. Rewrite the text below to fix these issues while preserving the original meaning and tone.\n\nISSUES:\n${issues}\n\nORIGINAL TEXT:\n${text}\n\nReturn ONLY the rewritten text, no explanation.`;
}

async function callOpenAI(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`${OPENAI_BASE}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function applyStubRemediation(text: string, findings: ScanFinding[]): string {
  let result = text;
  for (const f of findings) {
    if (f.snippet && f.code === "pii_email") {
      result = result.replace(new RegExp(escapeRegex(f.snippet.replace(/\*+/, "")), "gi"), "[email removed]");
    } else if (f.snippet && f.code === "pii_phone") {
      result = result.replace(new RegExp(escapeRegex(f.snippet.replace(/\*+/, "")), "gi"), "[phone removed]");
    } else if (f.snippet && f.code === "trademark_phrase") {
      result = result.replace(new RegExp(`\\b${escapeRegex(f.snippet)}\\b`, "gi"), "[slogan removed]");
    }
  }
  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function autoRemediate(text: string, findings: ScanFinding[]): Promise<string> {
  if (findings.length === 0) return text;
  const result = await callOpenAI(buildPrompt(text, findings));
  return result ?? applyStubRemediation(text, findings);
}
