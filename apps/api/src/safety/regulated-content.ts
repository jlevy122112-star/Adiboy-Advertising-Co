import type { ScanFinding } from "@home-link/marketer-pro-contract";

const MEDICAL_PATTERNS: Array<{ pattern: RegExp; code: string; message: string }> = [
  { pattern: /\b(cures?|heals?|treats?\s+\w+|eliminates?\s+(disease|condition|cancer|diabetes|arthritis))\b/gi, code: "medical_cure_claim", message: "Medical cure claims require FDA clearance and physician review." },
  { pattern: /\b(FDA[- ]approved|FDA[- ]cleared|medically\s+proven)\b/gi, code: "fda_claim", message: "FDA claims must be accurate and verifiable — confirm before publishing." },
  { pattern: /\b(diagnose|prevent\s+(cancer|diabetes|heart\s+disease|alzheimer))\b/gi, code: "medical_diagnosis_claim", message: "Disease-prevention claims require clinical substantiation." },
];

const FINANCIAL_PATTERNS: Array<{ pattern: RegExp; code: string; message: string }> = [
  { pattern: /\b(guaranteed\s+(returns?|profit|income)|no[- ]risk\s+investment)\b/gi, code: "financial_guarantee", message: "Guaranteed investment return claims violate SEC/FINRA rules." },
  { pattern: /\b(get\s+rich\s+quick|double\s+your\s+(money|investment)\s+in)\b/gi, code: "get_rich_quick", message: "Get-rich-quick language triggers FTC enforcement risk." },
];

const LEGAL_PATTERNS: Array<{ pattern: RegExp; code: string; message: string }> = [
  { pattern: /\b(this\s+(is|constitutes?)\s+legal\s+advice|i\s+am\s+your\s+(lawyer|attorney))\b/gi, code: "legal_advice_claim", message: "Legal advice claims create liability — add 'not legal advice' disclaimer." },
];

const SUPPLEMENT_PATTERNS: Array<{ pattern: RegExp; code: string; message: string }> = [
  { pattern: /\b(this\s+statement\s+has\s+not\s+been\s+evaluated|not\s+intended\s+to\s+diagnose)\b/gi, code: "fda_disclaimer_present", message: "FDA supplement disclaimer present — ensure it's prominent." },
  { pattern: /\b(weight\s+loss\s+guaranteed|lose\s+\d+\s+pounds?\s+in)\b/gi, code: "weight_loss_claim", message: "Specific weight-loss claims require substantiation under FTC guidelines." },
];

export function detectRegulatedContent(text: string): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const allPatterns = [
    ...MEDICAL_PATTERNS.map(p => ({ ...p, severity: "high" as const })),
    ...FINANCIAL_PATTERNS.map(p => ({ ...p, severity: "high" as const })),
    ...LEGAL_PATTERNS.map(p => ({ ...p, severity: "medium" as const })),
    ...SUPPLEMENT_PATTERNS.map(p => ({ ...p, severity: "medium" as const })),
  ];
  for (const rule of allPatterns) {
    const matches = [...text.matchAll(rule.pattern)];
    for (const match of matches) {
      findings.push({
        type: "regulated_content",
        severity: rule.severity,
        code: rule.code,
        message: rule.message,
        snippet: match[0] ?? null,
        offset: match.index ?? null,
        suggestion: "Add required disclaimer or rewrite to remove the regulated claim.",
      });
    }
  }
  return findings;
}
