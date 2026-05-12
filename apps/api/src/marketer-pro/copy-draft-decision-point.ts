/**
 * Canonical decision point for approving generated copy body (Phase 2).
 */

import type { DecisionPoint } from "@home-link/marketer-pro-contract";

export const COPY_BODY_APPROVAL_POINT: DecisionPoint = {
  id: "generation.copy.body",
  label: "Primary copy body",
  description:
    "Approve or edit the generated copy body before scheduling or publishing.",
  stage: "generation",
  controlMode: "ai_suggest_user_confirm",
  required: true,
  allowMultiSelect: false,
  allowCustomValue: true,
  allowRegenerate: true,
  allowSaveAsPreset: false,
  options: [],
};
