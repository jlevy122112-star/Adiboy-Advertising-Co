/**
 * P4 — route each publish job to a network-specific implementation.
 * With `DATABASE_URL`, loads `schedule_entries` before publishing; stubs remain until SDK calls land.
 */

import {
  classifyPublishNetwork,
  type PublishJobPayload,
  type PublishJobResult,
  type PublishNetworkSlug,
} from "@home-link/marketer-pro-queue";
import {
  type ScheduleEntryRow,
  resolveScheduleEntryForPublish,
} from "../db/schedule-entry.js";
import { computeAdaptedPublishCopy } from "./publish-copy-adaptation.js";
import { instagramPublishProvider } from "./providers/instagram.js";
import { linkedinPublishProvider } from "./providers/linkedin.js";
import { metaPublishProvider } from "./providers/meta.js";
import { stubProviderResult } from "./providers/stub.js";
import { tiktokPublishProvider } from "./providers/tiktok.js";
import type { PublishProviderInput } from "./providers/types.js";
import { xPublishProvider } from "./providers/x.js";
import { youtubePublishProvider } from "./providers/youtube.js";

/** Same shape as {@link PublishRunnerContext} in `publish-execute.ts`. */
export interface PublishDispatchContext {
  readonly jobId?: string;
  readonly attempt: number;
}

type PublishHandler = (
  payload: PublishJobPayload,
  context: PublishDispatchContext,
  row: ScheduleEntryRow | undefined,
) => Promise<PublishJobResult>;

function toProviderInput(
  payload: PublishJobPayload,
  context: PublishDispatchContext,
  row: ScheduleEntryRow | undefined,
  adaptedCopy?: PublishProviderInput["adaptedCopy"],
): PublishProviderInput {
  return { payload, context, row, adaptedCopy };
}

function buildHandler(
  route: PublishNetworkSlug | "generic",
  impl: (input: PublishProviderInput) => Promise<PublishJobResult>,
): PublishHandler {
  return async (payload, context, row) => {
    const adaptedCopy = computeAdaptedPublishCopy(payload, route);
    return impl(toProviderInput(payload, context, row, adaptedCopy));
  };
}

const handlers: Record<PublishNetworkSlug | "generic", PublishHandler> = {
  meta: buildHandler("meta", (input) => metaPublishProvider.publish(input)),
  instagram: buildHandler("instagram", (input) => instagramPublishProvider.publish(input)),
  x: buildHandler("x", (input) => xPublishProvider.publish(input)),
  tiktok: buildHandler("tiktok", (input) => tiktokPublishProvider.publish(input)),
  linkedin: buildHandler("linkedin", (input) => linkedinPublishProvider.publish(input)),
  youtube: buildHandler("youtube", (input) => youtubePublishProvider.publish(input)),
  generic: buildHandler("generic", async (input) =>
    stubProviderResult("generic", input),
  ),
};

function dispatchWithRow(
  payload: PublishJobPayload,
  context: PublishDispatchContext,
  row: ScheduleEntryRow | undefined,
): Promise<PublishJobResult> {
  const effectiveNetwork =
    payload.network ?? row?.network ?? undefined;
  const route = classifyPublishNetwork(effectiveNetwork);
  return handlers[route](payload, context, row);
}

export async function dispatchPublishByNetwork(
  payload: PublishJobPayload,
  context: PublishDispatchContext,
): Promise<PublishJobResult> {
  const resolved = await resolveScheduleEntryForPublish(payload);

  switch (resolved.mode) {
    case "no_database":
      return dispatchWithRow(payload, context, undefined);
    case "not_found":
      return {
        ok: false,
        detail: "schedule_entry_not_found_in_postgres",
      };
    case "error":
      return {
        ok: false,
        detail: `postgres_query_failed:${resolved.message.slice(0, 400)}`,
      };
    case "ok":
      return dispatchWithRow(payload, context, resolved.row);
    default: {
      const _exhaustive: never = resolved;
      return _exhaustive;
    }
  }
}
