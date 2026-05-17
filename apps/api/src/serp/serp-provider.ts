/**
 * SERP provider abstraction.
 * Primary: SerpAPI (SERPAPI_KEY env var)
 * Fallback: stub results for dev/test
 */

import type { SerpResult } from "@home-link/marketer-pro-contract";

export type SerpFetchResult =
  | { ok: true; results: SerpResult[] }
  | { ok: false; error: string };

async function fetchViaSerpApi(keyword: string): Promise<SerpFetchResult> {
  const key = process.env.SERPAPI_KEY?.trim();
  if (!key) return { ok: false, error: "SERPAPI_KEY not set" };

  const params = new URLSearchParams({
    q: keyword,
    api_key: key,
    engine: "google",
    num: "10",
    output: "json",
  });

  const res = await fetch(`https://serpapi.com/search?${params}`);
  if (!res.ok) return { ok: false, error: `SerpAPI ${res.status}` };

  const data = await res.json() as {
    organic_results?: Array<{
      position: number;
      title: string;
      link: string;
      snippet?: string;
    }>;
  };

  const results: SerpResult[] = (data.organic_results ?? []).slice(0, 10).map((r) => ({
    position: r.position,
    title: r.title ?? "",
    url: r.link ?? "",
    snippet: r.snippet ?? "",
    domain: (() => { try { return new URL(r.link ?? "").hostname.replace(/^www\./, ""); } catch { return r.link ?? ""; } })(),
  }));

  return { ok: true, results };
}

function stubResults(keyword: string): SerpResult[] {
  return [
    { position: 1, title: `The Complete Guide to ${keyword}`, url: "https://example.com/guide", snippet: `Everything you need to know about ${keyword} in one place.`, domain: "example.com" },
    { position: 2, title: `${keyword}: Best Practices for 2026`, url: "https://blog.example.com/best-practices", snippet: `Top tips and strategies for ${keyword} that actually work.`, domain: "blog.example.com" },
    { position: 3, title: `How to Get Started with ${keyword}`, url: "https://startups.example.com/how-to", snippet: `A beginner-friendly walkthrough of ${keyword}.`, domain: "startups.example.com" },
    { position: 4, title: `${keyword} vs Alternatives — Honest Comparison`, url: "https://review.example.com/compare", snippet: `We compared ${keyword} side-by-side with the top alternatives.`, domain: "review.example.com" },
    { position: 5, title: `Why ${keyword} Matters for Your Business`, url: "https://business.example.com/why", snippet: `ROI, case studies, and real-world results from ${keyword}.`, domain: "business.example.com" },
  ];
}

export async function fetchSerpResults(keyword: string): Promise<SerpFetchResult> {
  if (process.env.SERPAPI_KEY?.trim()) {
    return fetchViaSerpApi(keyword);
  }
  return { ok: true, results: stubResults(keyword) };
}
