import type { AutonomousRun } from "@home-link/marketer-pro-contract";
import type { CampaignPlan } from "./campaign-planner.js";

export interface GeneratedBrief {
  network: string;
  headline: string;
  body: string;
  cta: string;
  hashtags: string[];
  imagePrompt: string;
}

export async function runBriefGenerator(
  run: AutonomousRun,
  plan: CampaignPlan,
  network: string,
): Promise<GeneratedBrief> {
  const apiKey = process.env.MARKETER_OPENAI_API_KEY?.trim() ?? process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return stubBrief(network, plan);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.8,
        messages: [{
          role: "system",
          content: `You are a social media copywriter. Return JSON: { network, headline, body, cta, hashtags: string[], imagePrompt }`,
        }, {
          role: "user",
          content: `Write a ${network} post for campaign "${plan.title}". Angle: ${plan.contentAngles[0]}. Objective: ${plan.objective}. Keep body under 280 chars for X, 2200 for others.`,
        }],
      }),
    });
    if (!res.ok) return stubBrief(network, plan);
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    return { ...stubBrief(network, plan), ...(JSON.parse(raw) as Partial<GeneratedBrief>) };
  } catch { return stubBrief(network, plan); }
}

function stubBrief(network: string, plan: CampaignPlan): GeneratedBrief {
  return {
    network,
    headline: `${plan.title} — Now Live`,
    body: `We're excited to share something new. ${plan.contentAngles[0] ?? "Check it out"} and see why our community loves it.`,
    cta: "Learn More",
    hashtags: ["marketing", "growth", network.toLowerCase()],
    imagePrompt: `Professional marketing image for ${plan.title}, clean modern design, brand colors`,
  };
}
