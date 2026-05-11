/**
 * Campaign-level decision aggregator (Phase 1D.C).
 *
 * The audit log owns committed decision history; autonomous run events own
 * runtime facts. This read-side module normalises both streams into one
 * timeline so UI and operator views can answer "what happened around this
 * decision?" without knowing which stream emitted the row.
 */

import { z } from "zod";

import {
  AuditEntryKindSchema,
  AuditTargetSchema,
  DecisionAuditEntrySchema,
  entryKindRequiresRecord,
  type AuditTarget,
  type DecisionAuditEntry,
  type DecisionAuditLog,
} from "./decision-audit-log.js";
import {
  DecisionCommittedEventSchema,
  UserOverrideEventSchema,
  type AutonomousRunEvent,
  type DecisionCommittedEvent,
  type UserOverrideEvent,
} from "./autonomous-run-events.js";
import {
  DecisionRecordSchema,
} from "./decision-point.js";

/* -------------------------------------------------------------------------- */
/*                              Timeline schema                               */
/* -------------------------------------------------------------------------- */

export const DECISION_TIMELINE_SOURCES = [
  "audit_log",
  "autonomous_run_event",
] as const;

export type DecisionTimelineSource =
  (typeof DECISION_TIMELINE_SOURCES)[number];

export const DecisionTimelineSourceSchema = z.enum(DECISION_TIMELINE_SOURCES);

export const DecisionTimelineEntrySchema = z
  .object({
    timelineId: z.string().min(1).max(300),
    source: DecisionTimelineSourceSchema,
    occurredAt: z.string().datetime(),
    decisionPointId: z.string().min(1).max(120),
    target: AuditTargetSchema.nullable(),
    runId: z.string().min(1).max(120).nullable(),
    briefId: z.string().min(1).max(120).nullable(),
    scheduleEntryId: z.string().min(1).max(120).nullable(),
    actorUserId: z.string().min(1).max(120).nullable(),
    recordId: z.string().min(1).max(120).nullable(),
    previousRecordId: z.string().min(1).max(120).nullable(),
    record: DecisionRecordSchema.nullable(),
    auditEntryKind: AuditEntryKindSchema.nullable(),
    runEventType: z.enum(["decision_committed", "user_override"]).nullable(),
    auditEntry: DecisionAuditEntrySchema.nullable(),
    runEvent: z
      .union([DecisionCommittedEventSchema, UserOverrideEventSchema])
      .nullable(),
  })
  .strict();

export type DecisionTimelineEntry = z.infer<
  typeof DecisionTimelineEntrySchema
>;

export interface DecisionTimelineFilter {
  readonly source?: DecisionTimelineSource;
  readonly decisionPointId?: string;
  readonly target?: Pick<AuditTarget, "kind" | "id">;
  readonly runId?: string;
  readonly briefId?: string;
  readonly scheduleEntryId?: string;
}

export interface BuildDecisionTimelineArgs {
  readonly auditLog?: DecisionAuditLog;
  readonly runEvents?: ReadonlyArray<AutonomousRunEvent>;
  readonly filter?: DecisionTimelineFilter;
}

/* -------------------------------------------------------------------------- */
/*                              Timeline builder                              */
/* -------------------------------------------------------------------------- */

function auditEntryToTimelineEntry(
  entry: DecisionAuditEntry,
): DecisionTimelineEntry {
  return DecisionTimelineEntrySchema.parse({
    timelineId: `audit_log:${entry.entryId}`,
    source: "audit_log",
    occurredAt: entry.createdAt,
    decisionPointId: entry.decisionPointId,
    target: entry.target,
    runId: entry.runId,
    briefId: entry.briefId,
    scheduleEntryId: entry.scheduleEntryId,
    actorUserId: entry.record?.actorUserId ?? null,
    recordId: entry.record?.recordId ?? null,
    previousRecordId: entry.record?.replacesRecordId ?? null,
    record: entry.record,
    auditEntryKind: entry.kind,
    runEventType: null,
    auditEntry: entry,
    runEvent: null,
  });
}

function runEventToTimelineEntry(
  event: DecisionCommittedEvent | UserOverrideEvent,
): DecisionTimelineEntry {
  const recordId =
    event.type === "decision_committed"
      ? event.decisionRecordId
      : event.newRecordId;
  const previousRecordId =
    event.type === "user_override" ? event.previousRecordId : null;

  return DecisionTimelineEntrySchema.parse({
    timelineId: `autonomous_run_event:${event.eventId}`,
    source: "autonomous_run_event",
    occurredAt: event.occurredAt,
    decisionPointId: event.decisionPointId,
    target: null,
    runId: event.runId,
    briefId: null,
    scheduleEntryId: null,
    actorUserId: event.actorUserId,
    recordId,
    previousRecordId,
    record: null,
    auditEntryKind: null,
    runEventType: event.type,
    auditEntry: null,
    runEvent: event,
  });
}

function isDecisionRunEvent(
  event: AutonomousRunEvent,
): event is DecisionCommittedEvent | UserOverrideEvent {
  return event.type === "decision_committed" || event.type === "user_override";
}

function targetMatches(
  entryTarget: AuditTarget | null,
  filterTarget: Pick<AuditTarget, "kind" | "id"> | undefined,
): boolean {
  if (!filterTarget) return true;
  return (
    entryTarget !== null &&
    entryTarget.kind === filterTarget.kind &&
    entryTarget.id === filterTarget.id
  );
}

function timelineEntryMatches(
  entry: DecisionTimelineEntry,
  filter: DecisionTimelineFilter | undefined,
): boolean {
  if (!filter) return true;
  if (filter.source && entry.source !== filter.source) return false;
  if (
    filter.decisionPointId &&
    entry.decisionPointId !== filter.decisionPointId
  ) {
    return false;
  }
  if (!targetMatches(entry.target, filter.target)) return false;
  if (filter.runId && entry.runId !== filter.runId) return false;
  if (filter.briefId && entry.briefId !== filter.briefId) return false;
  if (
    filter.scheduleEntryId &&
    entry.scheduleEntryId !== filter.scheduleEntryId
  ) {
    return false;
  }
  return true;
}

function compareTimelineEntries(
  a: DecisionTimelineEntry,
  b: DecisionTimelineEntry,
): number {
  const byTime = a.occurredAt.localeCompare(b.occurredAt);
  if (byTime !== 0) return byTime;
  return a.timelineId.localeCompare(b.timelineId);
}

/**
 * Normalises decision-bearing audit entries and autonomous run events into one
 * stable, ascending timeline.
 */
export function buildDecisionTimeline(
  args: BuildDecisionTimelineArgs,
): ReadonlyArray<DecisionTimelineEntry> {
  const entries: DecisionTimelineEntry[] = [];

  for (const entry of args.auditLog ?? []) {
    entries.push(auditEntryToTimelineEntry(entry));
  }

  for (const event of args.runEvents ?? []) {
    if (isDecisionRunEvent(event)) {
      entries.push(runEventToTimelineEntry(event));
    }
  }

  return entries
    .filter((entry) => timelineEntryMatches(entry, args.filter))
    .sort(compareTimelineEntries);
}

/* -------------------------------------------------------------------------- */
/*                           Current decision view                            */
/* -------------------------------------------------------------------------- */

export interface CurrentDecisionsForTargetArgs {
  readonly auditLog: DecisionAuditLog;
  readonly target: Pick<AuditTarget, "kind" | "id">;
}

/**
 * Current committed decisions for every point on one target. Superseded
 * entries are ignored; newest non-superseded record-bearing entry wins.
 */
export function currentDecisionsForTarget(
  args: CurrentDecisionsForTargetArgs,
): ReadonlyArray<DecisionAuditEntry> {
  const supersededEntryIds = new Set<string>();
  for (const entry of args.auditLog) {
    if (entry.supersedes !== null) {
      supersededEntryIds.add(entry.supersedes.entryId);
    }
  }

  const byDecisionPoint = new Map<string, DecisionAuditEntry>();
  for (const entry of args.auditLog) {
    if (entry.target.kind !== args.target.kind) continue;
    if (entry.target.id !== args.target.id) continue;
    if (!entryKindRequiresRecord(entry.kind)) continue;
    if (supersededEntryIds.has(entry.entryId)) continue;

    const current = byDecisionPoint.get(entry.decisionPointId);
    if (!current || entry.createdAt > current.createdAt) {
      byDecisionPoint.set(entry.decisionPointId, entry);
    }
  }

  return Array.from(byDecisionPoint.values()).sort((a, b) => {
    const byDecisionPoint = a.decisionPointId.localeCompare(b.decisionPointId);
    if (byDecisionPoint !== 0) return byDecisionPoint;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export interface DecisionActivitySummary {
  readonly timeline: ReadonlyArray<DecisionTimelineEntry>;
  readonly currentDecisions: ReadonlyArray<DecisionAuditEntry>;
  readonly latestActivityAt: string | null;
}

/**
 * Convenience read model for a single target: unified timeline plus current
 * decision heads.
 */
export function summarizeDecisionActivityForTarget(
  args: BuildDecisionTimelineArgs & CurrentDecisionsForTargetArgs,
): DecisionActivitySummary {
  const timeline = buildDecisionTimeline({
    auditLog: args.auditLog,
    runEvents: args.runEvents,
    filter: {
      ...args.filter,
      target: args.target,
    },
  });
  const currentDecisions = currentDecisionsForTarget({
    auditLog: args.auditLog,
    target: args.target,
  });
  const latest = timeline[timeline.length - 1];
  return {
    timeline,
    currentDecisions,
    latestActivityAt: latest?.occurredAt ?? null,
  };
}
