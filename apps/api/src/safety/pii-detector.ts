import type { ScanFinding } from "@home-link/marketer-pro-contract";

const PII_PATTERNS: Array<{ pattern: RegExp; code: string; message: string; severity: ScanFinding["severity"] }> = [
  {
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    code: "pii_email", message: "Email address detected in content.", severity: "high",
  },
  {
    pattern: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    code: "pii_phone", message: "Phone number detected in content.", severity: "high",
  },
  {
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    code: "pii_ssn", message: "Possible SSN detected.", severity: "critical",
  },
  {
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    code: "pii_credit_card", message: "Possible credit card number detected.", severity: "critical",
  },
  {
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    code: "pii_ip_address", message: "IP address detected.", severity: "low",
  },
];

export function detectPii(text: string): ScanFinding[] {
  const findings: ScanFinding[] = [];
  for (const rule of PII_PATTERNS) {
    const matches = [...text.matchAll(rule.pattern)];
    for (const match of matches) {
      findings.push({
        type: "pii_detection",
        severity: rule.severity,
        code: rule.code,
        message: rule.message,
        snippet: match[0] ? `${match[0].slice(0, 6)}***` : null,
        offset: match.index ?? null,
        suggestion: "Remove or anonymize PII before publishing.",
      });
    }
  }
  return findings;
}
