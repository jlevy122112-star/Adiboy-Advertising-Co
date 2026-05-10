/**
 * P4 — canonical outbound publish routes (worker + API agree on these slugs).
 * Unknown values still validate on the job payload (`network` is a loose string)
 * but routing treats them as **`generic`** until you add SDK wiring.
 */

export const PUBLISH_NETWORK_SLUGS = [
  "meta",
  "instagram",
  "x",
  "tiktok",
  "linkedin",
  "youtube",
] as const;

export type PublishNetworkSlug = (typeof PUBLISH_NETWORK_SLUGS)[number];

const SLUG_SET = new Set<string>(PUBLISH_NETWORK_SLUGS);

/** Common synonyms → canonical slug (Graph API, X rename, etc.). */
const SYNONYMS: Record<string, PublishNetworkSlug> = {
  facebook: "meta",
  fb: "meta",
  twitter: "x",
};

export function isPublishNetworkSlug(value: string): value is PublishNetworkSlug {
  return SLUG_SET.has(value);
}

/**
 * Maps free-form `payload.network` to a routing bucket. **`generic`** =
 * smoke/test/unknown — use a catch-all publisher until the network is modeled.
 */
export function classifyPublishNetwork(
  raw: string | undefined,
): PublishNetworkSlug | "generic" {
  if (raw === undefined || raw.trim() === "") {
    return "generic";
  }
  const key = raw.trim().toLowerCase();
  const mapped = SYNONYMS[key];
  if (mapped !== undefined) {
    return mapped;
  }
  if (isPublishNetworkSlug(key)) {
    return key;
  }
  return "generic";
}
