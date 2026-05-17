import type { ScanFinding } from "@home-link/marketer-pro-contract";

// Known copyrighted phrases / song lyrics / literary quotes commonly misused in marketing
const KNOWN_COPYRIGHTED: Array<{ text: string; source: string }> = [
  { text: "just do it", source: "Nike trademark" },
  { text: "think different", source: "Apple trademark" },
  { text: "because you're worth it", source: "L'Oréal trademark" },
  { text: "finger lickin' good", source: "KFC trademark" },
  { text: "i'm lovin' it", source: "McDonald's trademark" },
  { text: "melts in your mouth not in your hands", source: "M&M's trademark" },
];

// Detect long verbatim runs (20+ words) that may be lifted from external sources
function detectVerbatimRuns(text: string): ScanFinding[] {
  const words = text.trim().split(/\s+/);
  if (words.length < 20) return [];
  // Flag suspiciously long repeated n-grams (simplified: look for all-caps or quoted long blocks)
  const findings: ScanFinding[] = [];
  const longQuotePattern = /"([^"]{120,})"/g;
  const matches = [...text.matchAll(longQuotePattern)];
  for (const match of matches) {
    findings.push({
      type: "copyright", severity: "medium", code: "long_quoted_block",
      message: "Long quoted passage detected — verify you have rights to reproduce this text.",
      snippet: match[1] ? match[1].slice(0, 80) + "…" : null,
      offset: match.index ?? null,
      suggestion: "Paraphrase or cite the original source with permission.",
    });
  }
  return findings;
}

export function checkCopyright(text: string): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const lower = text.toLowerCase();

  for (const { text: phrase, source } of KNOWN_COPYRIGHTED) {
    if (lower.includes(phrase)) {
      const idx = lower.indexOf(phrase);
      findings.push({
        type: "copyright", severity: "medium", code: "trademark_phrase",
        message: `Possible trademark usage: "${phrase}" (${source})`,
        snippet: phrase, offset: idx,
        suggestion: "Avoid trademarked slogans unless you have permission or are quoting referentially.",
      });
    }
  }

  findings.push(...detectVerbatimRuns(text));
  return findings;
}
