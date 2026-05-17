import type { ScanFinding } from "@home-link/marketer-pro-contract";

const DEFAULT_HATE_PATTERNS = [
  /\b(hate|slur|racist|sexist|homophob|transphob)\w*\b/gi,
];

const DEFAULT_SPAM_PATTERNS = [
  /\b(click\s+here\s+now|limited\s+time\s+only|act\s+now|buy\s+now|free\s+money|you\s+have\s+won)\b/gi,
];

export interface BrandSafetyConfig {
  forbiddenPhrases?: string[];
  forbiddenPatterns?: RegExp[];
  competitorNames?: string[];
}

export function scanBrandSafety(text: string, config: BrandSafetyConfig = {}): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const lower = text.toLowerCase();

  // Hate speech / harmful content
  for (const pattern of DEFAULT_HATE_PATTERNS) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      findings.push({
        type: "brand_safety", severity: "critical", code: "harmful_content",
        message: "Potentially harmful or discriminatory language detected.",
        snippet: match[0] ?? null, offset: match.index ?? null,
        suggestion: "Remove or rephrase to avoid discriminatory language.",
      });
    }
  }

  // Spam signals
  for (const pattern of DEFAULT_SPAM_PATTERNS) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      findings.push({
        type: "brand_safety", severity: "medium", code: "spam_signal",
        message: "Spam-like language may trigger platform filters.",
        snippet: match[0] ?? null, offset: match.index ?? null,
        suggestion: "Rewrite with less aggressive call-to-action language.",
      });
    }
  }

  // Forbidden phrases from brand config
  for (const phrase of (config.forbiddenPhrases ?? [])) {
    if (lower.includes(phrase.toLowerCase())) {
      const idx = lower.indexOf(phrase.toLowerCase());
      findings.push({
        type: "brand_safety", severity: "high", code: "forbidden_phrase",
        message: `Brand forbidden phrase detected: "${phrase}"`,
        snippet: phrase, offset: idx,
        suggestion: `Remove "${phrase}" — it's in your brand compliance rules.`,
      });
    }
  }

  // Custom patterns
  for (const pattern of (config.forbiddenPatterns ?? [])) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      findings.push({
        type: "brand_safety", severity: "high", code: "custom_pattern",
        message: "Custom brand safety pattern matched.",
        snippet: match[0] ?? null, offset: match.index ?? null,
        suggestion: "Review against your brand compliance rules.",
      });
    }
  }

  // Competitor mentions
  for (const name of (config.competitorNames ?? [])) {
    if (lower.includes(name.toLowerCase())) {
      const idx = lower.indexOf(name.toLowerCase());
      findings.push({
        type: "brand_safety", severity: "low", code: "competitor_mention",
        message: `Competitor name mentioned: "${name}"`,
        snippet: name, offset: idx,
        suggestion: "Review whether the competitor mention is intentional and appropriate.",
      });
    }
  }

  return findings;
}
