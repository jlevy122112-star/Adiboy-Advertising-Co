import type { AutonomousRun } from "@home-link/marketer-pro-contract";

export interface CampaignPlan {
  title: string;
  objective: string;
  platforms: string[];
  postCount: number;
  contentAngles: string[];
}

export async function runCampaignPlanner(run: AutonomousRun): Promise<CampaignPlan> {
  const apiKey = process.env.MARKETER_OPENAI_API_KEY?.trim() ?? process.env.OPENAI_API_KEY?.trim();
  const networks = run.request.platforms.join(", ");

  if (!apiKey) return stubPlan(run);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.7,
        messages: [{
          role: "system",
          content: `You are a campaign planner. Return JSON: { title, objective, platforms: string[], postCount: number, contentAngles: string[] }`,
        }, {
          role: "user",
          content: `Plan a ${run.request.scope} campaign for networks: ${networks}. Keep it concise and actionable.`,
        }],
      }),
    });
    if (!res.ok) return stubPlan(run);
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(raw) as CampaignPlan;
  } catch { return stubPlan(run); }
}

function stubPlan(run: AutonomousRun): CampaignPlan {
  return {
    title: `Autonomous Campaign — ${run.request.platforms.join(", ")}`,
    objective: "awareness",
    platforms: run.request.platforms,
    postCount: run.request.scope === "full_campaign" ? 5 : 1,
    contentAngles: ["value proposition", "social proof", "call to action"],
  };
}
