import {
  adaptCopyToPlatform,
  type PlatformAdaptationResult,
  type PublishableNetwork,
} from "@home-link/marketer-pro-contract";
import type {
  PublishJobPayload,
  PublishNetworkSlug,
} from "@home-link/marketer-pro-queue";

/**
 * Maps a P4 publish route bucket to a `PublishableNetwork` limit key.
 * `meta` (Facebook Graph page publishing) uses Facebook primary limits here.
 */
export function publishRouteToPublishableNetwork(
  route: PublishNetworkSlug | "generic",
): PublishableNetwork | null {
  switch (route) {
    case "meta":
      return "facebook";
    case "instagram":
      return "instagram";
    case "x":
      return "x";
    case "tiktok":
      return "tiktok";
    case "linkedin":
      return "linkedin";
    case "youtube":
      return "youtube";
    default:
      return null;
  }
}

/**
 * When the job carries `copy`, deterministically adapts it for the route’s
 * network limits. Returns `undefined` when there is no copy, no routable
 * network (`generic`), or adaptation is not applicable.
 */
export function computeAdaptedPublishCopy(
  payload: PublishJobPayload,
  route: PublishNetworkSlug | "generic",
): PlatformAdaptationResult | undefined {
  if (payload.copy === undefined) return undefined;
  const network = publishRouteToPublishableNetwork(route);
  if (network === null) return undefined;
  return adaptCopyToPlatform({ source: payload.copy, network });
}
