import type { PlatformAdaptationResult } from "@home-link/marketer-pro-contract";
import type {
  PublishJobPayload,
  PublishJobResult,
  PublishNetworkSlug,
} from "@home-link/marketer-pro-queue";
import type { ScheduleEntryRow } from "../../db/schedule-entry.js";
import type { PublishDispatchContext } from "../publish-dispatch.js";

export interface PublishProviderInput {
  readonly payload: PublishJobPayload;
  readonly context: PublishDispatchContext;
  readonly row: ScheduleEntryRow | undefined;
  /** Present when `payload.copy` was adapted for the resolved publish route. */
  readonly adaptedCopy?: PlatformAdaptationResult;
}

export interface PublishProviderAdapter {
  readonly network: PublishNetworkSlug;
  publish(input: PublishProviderInput): Promise<PublishJobResult>;
}
