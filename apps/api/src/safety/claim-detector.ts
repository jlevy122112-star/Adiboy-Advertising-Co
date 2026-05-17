import type { ScanFinding } from "@home-link/marketer-pro-contract";

const ABSOLUTE_CLAIMS: Array<{ pattern: RegExp; code: string; message: string }> = [
  { pattern: /\b(guaranteed|100%\s+guaranteed|absolute guarantee)\b/gi, code: "absolute_guarantee", message: "Absolute guarantee claims are legally risky and mislead consumers." },
  { pattern: /\b(always\s+works?|never\s+fails?|zero\s+risk|risk[- ]free)\b/gi, code: "absolute_performance", message: "Absolute performance claims require substantiation." },
  { pattern: /\b(best\s+in\s+(class|world|industry)|#\s*1\s+in\s+\w+|number\s+one\s+in)\b/gi, code: "superlative_claim", message: "Superlative claims require third-party evidence." },
  { pattern: /\b(proven\s+to|clinically\s+proven|scientifically\s+proven)\b/gi, code: "unverified_proof", message: "Proof claims require published studies — link the source or remove." },
  { pattern: /\b(instant\s+results?|results?\s+overnight|immediate\s+results?)\b/gi, code: "instant_results", message: "Instant-result claims are rarely substantiated." },
  { pattern: /\b(earn\s+\$[\d,]+\s+per\s+(day|week|month)|make\s+money\s+(fast|quickly|overnight))\b/gi, code: "financial_guarantee", message: "Guaranteed-income claims violate FTC guidelines." },
];

export function detectClaims(text: string): ScanFinding[] {
  const findings: ScanFinding[] = [];
  for (const rule of ABSOLUTE_CLAIMS) {
    const matches = [...text.matchAll(rule.pattern)];
    for (const match of matches) {
      findings.push({
        type: "claim_detection",
        severity: "medium",
        code: rule.code,
        message: rule.message,
        snippet: match[0] ?? null,
        offset: match.index ?? null,
        suggestion: "Qualify the claim with evidence or soften the language (e.g., 'typically', 'in our tests').",
      });
    }
  }
  return findings;
}
