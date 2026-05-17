import type { GeneratedBrief } from "./brief-generator.js";

export interface ComplianceResult {
  passed: boolean;
  flags: string[];
  sanitizedBody?: string;
}

const BANNED_PATTERNS = [
  /\b(guaranteed|100%\s*safe|risk.?free|get.?rich)\b/i,
  /\b(cure|treat|diagnose|prevent)\b/i,
  /\b(investment\s+advice|financial\s+advice)\b/i,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, // email PII
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,             // phone PII
];

const FLAG_LABELS = [
  "unsubstantiated guarantee",
  "medical/health claim",
  "financial advice",
  "PII: email address",
  "PII: phone number",
];

export async function runComplianceReview(brief: GeneratedBrief): Promise<ComplianceResult> {
  const text = `${brief.headline} ${brief.body} ${brief.cta}`;
  const flags: string[] = [];

  BANNED_PATTERNS.forEach((pattern, i) => {
    if (pattern.test(text)) flags.push(FLAG_LABELS[i]!);
  });

  // Strip PII from body if found
  let sanitizedBody = brief.body;
  if (flags.some(f => f.startsWith("PII"))) {
    sanitizedBody = brief.body
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[phone removed]");
  }

  return {
    passed: flags.length === 0,
    flags,
    sanitizedBody: flags.length > 0 ? sanitizedBody : undefined,
  };
}
