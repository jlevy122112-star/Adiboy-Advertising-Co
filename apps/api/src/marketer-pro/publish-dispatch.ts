/**
 * P4 — route each publish job to a network-specific implementation.
 * With `DATABASE_URL`, loads `schedule_entries` before publishing; stubs remain until SDK calls land.
 */

import type {
  PublishJobPayload,
  PublishJobResult,
} from "@home-link/marketer-pro-queue";
import {
  classifyPublishNetwork,
  type PublishNetworkSlug,
} from "@home-link/marketer-pro-queue";
import {
  type ScheduleEntryRow,
  resolveScheduleEntryForPublish,
} from "../db/schedule-entry.js";
import { metaPublishProvider } from "./providers/meta.js";
import { stubProviderResult } from "./providers/stub.js";
import { tiktokPublishProvider } from "./providers/tiktok.js";
import type { PublishProviderInput } from "./providers/types.js";
import { xPublishProvider } from "./providers/x.js";

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
): PublishProviderInput {
  return { payload, context, row };
}

const handlers: Record<PublishNetworkSlug | "generic", PublishHandler> = {
  meta: async (payload, context, row) =>
    metaPublishProvider.publish(toProviderInput(payload, context, row)),
  instagram: async (payload, context, row) =>
    stubProviderResult("instagram", toProviderInput(payload, context, row)),
  x: async (payload, context, row) =>
    xPublishProvider.publish(toProviderInput(payload, context, row)),
  tiktok: async (payload, context, row) =>
    tiktokPublishProvider.publish(toProviderInput(payload, context, row)),
  linkedin: async (payload, context, row) =>
    stubProviderResult("linkedin", toProviderInput(payload, context, row)),
  youtube: async (payload, context, row) =>
    stubProviderResult("youtube", toProviderInput(payload, context, row)),
  generic: async (payload, context, row) =>
    stubProviderResult("generic", toProviderInput(payload, context, row)),
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
