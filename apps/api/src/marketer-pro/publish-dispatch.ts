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

function stubOk(
  network: PublishNetworkSlug | "generic",
  payload: PublishJobPayload,
  row: ScheduleEntryRow | undefined,
): PublishJobResult {
  const idPart = row?.id ?? payload.scheduleEntryId;
  const db = row ? "_db_loaded" : "";
  return {
    ok: true,
    detail: `p4_stub_${network}_wire_sdk${db}`,
    externalId: `${network}:${idPart}`,
  };
}

const handlers: Record<PublishNetworkSlug | "generic", PublishHandler> = {
  meta: async (payload, _ctx, row) => stubOk("meta", payload, row),
  instagram: async (payload, _ctx, row) => stubOk("instagram", payload, row),
  x: async (payload, _ctx, row) => stubOk("x", payload, row),
  tiktok: async (payload, _ctx, row) => stubOk("tiktok", payload, row),
  linkedin: async (payload, _ctx, row) => stubOk("linkedin", payload, row),
  youtube: async (payload, _ctx, row) => stubOk("youtube", payload, row),
  generic: async (payload, _ctx, row) => stubOk("generic", payload, row),
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
