/**
 * Phase 9 — AI analysis of SERP results to produce a structured content brief.
 * Uses OpenAI Chat Completions. Falls back to a deterministic stub if no key.
 */

import type { SerpResult, KeywordIntent, SerpBrief } from "@home-link/marketer-pro-contract";

type AnalysisResult = {
  intent: KeywordIntent;
  competitorAngles: string[];
  contentGaps: Array<{ topic: string; reason: string }>;
  suggestedHeadline: string;
  suggestedAngle: string;
  suggestedOutline: string[];
  targetKeywords: string[];
  seoScore: number;
  seoScoreReason: string;
};

function buildPrompt(
  keyword: string,
  results: SerpResult[],
  industryVertical?: string,
  network?: string,
): string {
  const serpSummary = results
    .slice(0, 8)
    .map((r) => `${r.position}. [${r.domain}] ${r.title}\n   ${r.snippet}`)
    .join("\n");

  return `You are a senior SEO strategist and content brief specialist.

Keyword: "${keyword}"
${industryVertical ? `Industry: ${industryVertical}` : ""}
${network ? `Target platform: ${network}` : ""}

Current top SERP results:
${serpSummary}

Analyze these results and respond with ONLY a valid JSON object matching this exact shape:
{
  "intent": "informational" | "navigational" | "commercial" | "transactional",
  "competitorAngles": [string, ...],      // 3-5 angles the top results use
  "contentGaps": [{ "topic": string, "reason": string }, ...],  // 2-4 gaps not covered
  "suggestedHeadline": string,            // one strong headline for new content
  "suggestedAngle": string,               // 1-2 sentence unique angle
  "suggestedOutline": [string, ...],      // 4-6 section headings
  "targetKeywords": [string, ...],        // 5-8 related keywords to target
  "seoScore": number,                     // 0-100 difficulty to rank (100 = hardest)
  "seoScoreReason": string               // one sentence explaining the score
}`;
}

async function analyzeWithOpenAI(
  keyword: string,
  results: SerpResult[],
  industryVertical?: string,
  network?: string,
): Promise<AnalysisResult | null> {
  const key = (process.env.MARKETER_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY)?.trim();
  if (!key) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [{ role: "user", content: buildPrompt(keyword, results, industryVertical, network) }],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json() as { choices?: Array<{ message: { content: string } }> };
  const raw = data.choices?.[0]?.message.content?.trim() ?? "";

  try {
    const jsonStr = raw.startsWith("```") ? raw.replace(/```json?\n?/g, "").replace(/```$/g, "") : raw;
    return JSON.parse(jsonStr) as AnalysisResult;
  } catch { return null; }
}

function stubAnalysis(keyword: string, results: SerpResult[]): AnalysisResult {
  const domains = results.slice(0, 3).map((r) => r.domain);
  return {
    intent: "informational",
    competitorAngles: [
      `Comprehensive how-to guide format (used by ${domains[0] ?? "top sites"})`,
      "Listicle with numbered tips",
      "Expert comparison / versus angle",
    ],
    contentGaps: [
      { topic: `${keyword} for beginners`, reason: "Top results assume prior knowledge" },
      { topic: `${keyword} ROI and metrics`, reason: "No result quantifies business impact" },
    ],
    suggestedHeadline: `The Definitive ${keyword} Guide for 2026: Strategy, Examples & Results`,
    suggestedAngle: `Skip the theory — focus on what actually moves metrics for businesses using ${keyword} today.`,
    suggestedOutline: [
      `What is ${keyword} and why it matters now`,
      "Common mistakes and how to avoid them",
      "Step-by-step implementation",
      "Real-world examples and case studies",
      "How to measure success",
      "Next steps and resources",
    ],
    targetKeywords: [
      keyword,
      `${keyword} guide`,
      `${keyword} strategy`,
      `how to use ${keyword}`,
      `${keyword} examples`,
      `${keyword} tips`,
    ],
    seoScore: 58,
    seoScoreReason: "Moderate competition — established domains dominate but content gaps exist for differentiated angles.",
  };
}

export async function generateSerpBrief(args: {
  keyword: string;
  results: SerpResult[];
  industryVertical?: string;
  network?: string;
}): Promise<Pick<SerpBrief,
  "intent" | "competitorAngles" | "contentGaps" | "suggestedHeadline" |
  "suggestedAngle" | "suggestedOutline" | "targetKeywords" | "seoScore" | "seoScoreReason"
>> {
  const ai = await analyzeWithOpenAI(args.keyword, args.results, args.industryVertical, args.network);
  const analysis = ai ?? stubAnalysis(args.keyword, args.results);
  return {
    intent: analysis.intent,
    competitorAngles: analysis.competitorAngles,
    contentGaps: analysis.contentGaps,
    suggestedHeadline: analysis.suggestedHeadline,
    suggestedAngle: analysis.suggestedAngle,
    suggestedOutline: analysis.suggestedOutline,
    targetKeywords: analysis.targetKeywords,
    seoScore: analysis.seoScore,
    seoScoreReason: analysis.seoScoreReason,
  };
}
