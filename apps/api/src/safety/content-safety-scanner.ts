import type { ContentScanResult, ContentScanType, ScanFinding, ScanRequest } from "@home-link/marketer-pro-contract";
import { maxSeverity } from "@home-link/marketer-pro-contract";
import { randomUUID } from "crypto";
import { detectClaims } from "./claim-detector.js";
import { detectPii } from "./pii-detector.js";
import { detectRegulatedContent } from "./regulated-content.js";
import { scanBrandSafety } from "./brand-safety-scanner.js";
import { checkCopyright } from "./copyright-checker.js";
import { autoRemediate } from "./auto-remediator.js";

export async function runContentScan(
  req: ScanRequest & { workspaceId: string },
): Promise<ContentScanResult> {
  const types: ContentScanType[] = req.contentTypes ?? [
    "claim_detection", "pii_detection", "brand_safety", "regulated_content", "copyright",
  ];
  const findings: ScanFinding[] = [];

  if (types.includes("claim_detection")) findings.push(...detectClaims(req.text));
  if (types.includes("pii_detection")) findings.push(...detectPii(req.text));
  if (types.includes("regulated_content")) findings.push(...detectRegulatedContent(req.text));
  if (types.includes("brand_safety")) findings.push(...scanBrandSafety(req.text, {}));
  if (types.includes("copyright")) findings.push(...checkCopyright(req.text));

  const severities = findings.map(f => f.severity);
  const overallSeverity = severities.length > 0 ? maxSeverity(severities) : "clean";
  const passed = overallSeverity !== "critical" && overallSeverity !== "high";

  let remediatedText: string | null = null;
  if (req.autoRemediate && findings.length > 0) {
    remediatedText = await autoRemediate(req.text, findings);
  }

  return {
    id: randomUUID(),
    workspaceId: req.workspaceId,
    entityType: req.entityType ?? null,
    entityId: req.entityId ?? null,
    scannedText: req.text,
    contentTypes: types,
    findings,
    overallSeverity,
    passed,
    remediatedText,
    scannedAt: new Date().toISOString(),
  };
}
