import type {
  PublishJobResult,
  PublishNetworkSlug,
} from "@home-link/marketer-pro-queue";
import type {
  PublishProviderAdapter,
  PublishProviderInput,
} from "./types.js";

export function stubProviderResult(
  network: PublishNetworkSlug | "generic",
  input: PublishProviderInput,
): PublishJobResult {
  const idPart = input.row?.id ?? input.payload.scheduleEntryId;
  const db = input.row ? "_db_loaded" : "";
  const adapt =
    input.adaptedCopy !== undefined
      ? `_adapted:w=${input.adaptedCopy.warnings.length}`
      : "";
  return {
    ok: true,
    detail: `p4_stub_${network}_wire_sdk${db}${adapt}`,
    externalId: `${network}:${idPart}`,
  };
}

export function createStubProviderAdapter(
  network: PublishNetworkSlug,
): PublishProviderAdapter {
  return {
    network,
    async publish(input) {
      return stubProviderResult(network, input);
    },
  };
}
