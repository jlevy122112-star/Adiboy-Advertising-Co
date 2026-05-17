import type { SentimentAnalysis } from "@home-link/marketer-pro-contract";

export type { SentimentAnalysis };

const SYSTEM_PROMPT = `You are a social media sentiment analyst for a marketing platform.
Analyze the comment and return ONLY valid JSON matching this exact shape:
{
  "score": "positive"|"negative"|"neutral"|"mixed",
  "confidence": 0.0-1.0,
  "topics": ["up to 5 short topic labels"],
  "isNegativeSignal": true|false,
  "brandSafetyFlags": [] or subset of ["hate_speech","misinformation","spam","competitor_attack","pii_exposure","inappropriate_content","legal_risk"],
  "suggestedResponse": "short suggested reply or null"
}
isNegativeSignal = true when sentiment is negative AND it could damage brand reputation or requires action.
suggestedResponse should be concise, empathetic, on-brand. null if comment needs no response.`;

export async function analyzeCommentSentiment(body: string): Promise<SentimentAnalysis> {
  const apiKey = process.env.MARKETER_OPENAI_API_KEY?.trim() ?? process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return stubAnalysis(body);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: `Comment: ${body.slice(0, 500)}` },
        ],
      }),
    });

    if (!res.ok) return stubAnalysis(body);

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as SentimentAnalysis;
    return parsed;
  } catch {
    return stubAnalysis(body);
  }
}

function stubAnalysis(body: string): SentimentAnalysis {
  const lower = body.toLowerCase();
  const isNeg = /hate|terrible|awful|worst|scam|fraud|fake|spam|disgusting|horrible/.test(lower);
  const isPos = /love|great|amazing|excellent|best|awesome|perfect|fantastic/.test(lower);
  const score = isNeg ? "negative" : isPos ? "positive" : "neutral";
  return {
    score,
    confidence: 0.65,
    topics: extractTopics(body),
    isNegativeSignal: isNeg,
    brandSafetyFlags: /hate|slur|racist|sexist/.test(lower) ? ["hate_speech"] : [],
    suggestedResponse: isNeg ? "Thank you for your feedback. We'd love to make this right — please DM us." : null,
  };
}

function extractTopics(body: string): string[] {
  const map: Record<string, string> = {
    price: "pricing", cost: "pricing", expensive: "pricing", cheap: "pricing",
    quality: "quality", great: "quality", bad: "quality",
    service: "customer service", support: "customer service", help: "customer service",
    product: "product", feature: "product",
    delivery: "shipping", shipping: "shipping", late: "shipping",
    bug: "bugs", broken: "bugs", error: "bugs",
  };
  const found = new Set<string>();
  const words = body.toLowerCase().split(/\W+/);
  for (const w of words) {
    const topic = map[w];
    if (topic) found.add(topic);
    if (found.size >= 3) break;
  }
  return Array.from(found);
}
