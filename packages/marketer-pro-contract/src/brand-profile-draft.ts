import {
  BrandIntelligenceProfileSchema,
  type BrandIntelligenceProfile,
} from "./brand-intelligence.js";

/** `localStorage` key for browser draft persistence (Phase 1 → Phase 2 handoff). */
export const BRAND_PROFILE_DRAFT_STORAGE_KEY =
  "marketer-pro.brand-profile-draft.v1" as const;

/** Minimal storage surface (browser `localStorage`, in-memory tests, etc.). */
export interface BrandProfileDraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readBrandProfileDraft(
  storage: BrandProfileDraftStorage,
  key: string = BRAND_PROFILE_DRAFT_STORAGE_KEY,
): BrandIntelligenceProfile | null {
  const raw = storage.getItem(key);
  if (raw == null || raw.trim() === "") return null;
  try {
    const data: unknown = JSON.parse(raw);
    return BrandIntelligenceProfileSchema.parse(data);
  } catch {
    return null;
  }
}

export function writeBrandProfileDraft(
  storage: BrandProfileDraftStorage,
  profile: BrandIntelligenceProfile,
  key: string = BRAND_PROFILE_DRAFT_STORAGE_KEY,
): void {
  const parsed = BrandIntelligenceProfileSchema.parse(profile);
  storage.setItem(key, JSON.stringify(parsed));
}

export function clearBrandProfileDraft(
  storage: BrandProfileDraftStorage,
  key: string = BRAND_PROFILE_DRAFT_STORAGE_KEY,
): void {
  storage.removeItem(key);
}
