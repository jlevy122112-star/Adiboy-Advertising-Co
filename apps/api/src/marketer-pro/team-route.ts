/**
 * Phase 14 — Team collaboration HTTP routes.
 *
 * GET  /members                     — list workspace members
 * POST /members/invite              — invite member
 * PUT  /members/:userId/role        — change role
 * DELETE /members/:userId           — remove member
 * PUT  /members/:userId/activate    — accept invite
 *
 * POST /assignments                 — create review assignment
 * GET  /assignments                 — list for entity (?entityType=&entityId=)
 * GET  /assignments/mine            — pending for caller (?userId=)
 * PUT  /assignments/:id             — update status
 * DELETE /assignments/:id           — delete
 *
 * POST /approvals                   — request approval
 * GET  /approvals                   — list for entity
 * GET  /approvals/mine              — pending for caller (?userId=)
 * PUT  /approvals/:id               — decide
 *
 * POST /comments                    — add comment
 * GET  /comments                    — list (?entityType=&entityId=)
 * PUT  /comments/:id                — edit
 * DELETE /comments/:id              — soft-delete
 *
 * GET  /notifications               — list (?userId=&limit=&unreadOnly=)
 * PUT  /notifications/:id/read      — mark one read
 * PUT  /notifications/read-all      — mark all read (?userId=)
 *
 * GET  /history                     — change history (?entityType=&entityId=)
 *
 * Tenant header: X-Tenant-Id
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  WorkspaceRole, ReviewStatus, ApprovalStatus, CollabEntityType,
} from "@home-link/marketer-pro-contract";
import {
  listWorkspaceMembers, upsertWorkspaceMember, updateMemberRole,
  removeWorkspaceMember, activateMember,
} from "../db/workspace-member.js";
import {
  createReviewAssignment, listReviewAssignments, listAssignmentsForUser,
  updateReviewAssignment, deleteReviewAssignment,
} from "../db/review-assignment.js";
import {
  createApprovals, listApprovals, listPendingApprovalsForUser, decideApproval,
} from "../db/approval.js";
import {
  createComment, listComments, updateComment, deleteComment,
} from "../db/comment.js";
import {
  createNotification, listNotifications, markNotificationRead,
  markAllNotificationsRead, appendChangeHistory, listChangeHistory,
} from "../db/notification.js";

function cors(res: ServerResponse): void {
  const origin = process.env.MARKETER_TEAM_HTTP_CORS?.trim();
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Tenant-Id,Authorization");
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => { data += c; });
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}") as Record<string, unknown>); }
      catch { reject(new Error("invalid_json")); }
    });
    req.on("error", reject);
  });
}

export async function handleTeamRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const tenantId = (req.headers["x-tenant-id"] as string | undefined)?.trim();
  if (!tenantId) { json(res, 400, { error: "missing_tenant_id" }); return; }

  const url      = new URL(req.url ?? "/", "http://localhost");
  const p        = url.pathname.replace(/\/+$/, "");
  const method   = req.method ?? "GET";
  const qs       = url.searchParams;

  /* ── Members ─────────────────────────────────────────────────── */

  if (method === "GET" && p === "/members") {
    const members = await listWorkspaceMembers(tenantId);
    json(res, 200, { members });
    return;
  }

  if (method === "POST" && p === "/members/invite") {
    const body = await readBody(req);
    const { email, role, displayName, userId } = body as {
      email?: string; role?: WorkspaceRole; displayName?: string; userId?: string;
    };
    if (!email || !role || !userId) { json(res, 400, { error: "email_role_userId_required" }); return; }
    const member = await upsertWorkspaceMember({
      workspaceId: tenantId, userId, email,
      displayName: displayName ?? email.split("@")[0] ?? email,
      role, status: "invited", invitedBy: qs.get("actorId") ?? null,
    });
    if (!member) { json(res, 500, { error: "db_error" }); return; }
    await createNotification({
      userId, workspaceId: tenantId, type: "member_invited",
      title: "You've been invited", body: `You've been invited to join this workspace as ${role}.`,
    });
    json(res, 201, { member });
    return;
  }

  const memberRoleMatch = /^\/members\/([^/]+)\/role$/.exec(p);
  const memberActivateMatch = /^\/members\/([^/]+)\/activate$/.exec(p);
  const memberIdMatch = /^\/members\/([^/]+)$/.exec(p);

  if (method === "PUT" && memberRoleMatch) {
    const userId = memberRoleMatch[1]!;
    const body = await readBody(req);
    const { role } = body as { role?: WorkspaceRole };
    if (!role) { json(res, 400, { error: "role_required" }); return; }
    const member = await updateMemberRole(tenantId, userId, role);
    if (!member) { json(res, 404, { error: "not_found" }); return; }
    json(res, 200, { member });
    return;
  }

  if (method === "PUT" && memberActivateMatch) {
    const userId = memberActivateMatch[1]!;
    const member = await activateMember(tenantId, userId);
    if (!member) { json(res, 404, { error: "not_found" }); return; }
    await createNotification({
      userId, workspaceId: tenantId, type: "member_joined",
      title: "Welcome to the workspace", body: `You've joined as ${member.role}.`,
    });
    json(res, 200, { member });
    return;
  }

  if (method === "DELETE" && memberIdMatch) {
    const userId = memberIdMatch[1]!;
    await removeWorkspaceMember(tenantId, userId);
    json(res, 200, { ok: true });
    return;
  }

  /* ── Review assignments ───────────────────────────────────────── */

  if (method === "GET" && p === "/assignments/mine") {
    const userId = qs.get("userId") ?? "";
    if (!userId) { json(res, 400, { error: "userId_required" }); return; }
    const assignments = await listAssignmentsForUser(tenantId, userId);
    json(res, 200, { assignments });
    return;
  }

  if (method === "GET" && p === "/assignments") {
    const entityType = qs.get("entityType") ?? "";
    const entityId   = qs.get("entityId") ?? "";
    if (!entityType || !entityId) { json(res, 400, { error: "entityType_entityId_required" }); return; }
    const assignments = await listReviewAssignments(tenantId, entityType, entityId);
    json(res, 200, { assignments });
    return;
  }

  if (method === "POST" && p === "/assignments") {
    const body = await readBody(req);
    const { entityType, entityId, assigneeId, assignerId, dueAt, note } = body as {
      entityType?: CollabEntityType; entityId?: string; assigneeId?: string;
      assignerId?: string; dueAt?: string; note?: string;
    };
    if (!entityType || !entityId || !assigneeId || !assignerId) {
      json(res, 400, { error: "entityType_entityId_assigneeId_assignerId_required" }); return;
    }
    const assignment = await createReviewAssignment({
      workspaceId: tenantId, entityType, entityId, assigneeId, assignerId, dueAt, note,
    });
    if (!assignment) { json(res, 500, { error: "db_error" }); return; }
    await createNotification({
      userId: assigneeId, workspaceId: tenantId, type: "review_assigned",
      entityType, entityId, title: "Review assigned",
      body: note ?? `You've been assigned to review a ${entityType}.`,
    });
    json(res, 201, { assignment });
    return;
  }

  const assignmentIdMatch = /^\/assignments\/([^/]+)$/.exec(p);

  if (method === "PUT" && assignmentIdMatch) {
    const id = assignmentIdMatch[1]!;
    const body = await readBody(req);
    const { status, reviewNote } = body as { status?: ReviewStatus; reviewNote?: string };
    if (!status) { json(res, 400, { error: "status_required" }); return; }
    const assignment = await updateReviewAssignment(id, status, reviewNote);
    if (!assignment) { json(res, 404, { error: "not_found" }); return; }
    json(res, 200, { assignment });
    return;
  }

  if (method === "DELETE" && assignmentIdMatch) {
    await deleteReviewAssignment(assignmentIdMatch[1]!);
    json(res, 200, { ok: true });
    return;
  }

  /* ── Approvals ────────────────────────────────────────────────── */

  if (method === "GET" && p === "/approvals/mine") {
    const userId = qs.get("userId") ?? "";
    if (!userId) { json(res, 400, { error: "userId_required" }); return; }
    const approvals = await listPendingApprovalsForUser(tenantId, userId);
    json(res, 200, { approvals });
    return;
  }

  if (method === "GET" && p === "/approvals") {
    const entityType = qs.get("entityType") ?? "";
    const entityId   = qs.get("entityId") ?? "";
    if (!entityType || !entityId) { json(res, 400, { error: "entityType_entityId_required" }); return; }
    const approvals = await listApprovals(tenantId, entityType, entityId);
    json(res, 200, { approvals });
    return;
  }

  if (method === "POST" && p === "/approvals") {
    const body = await readBody(req);
    const { entityType, entityId, reviewerIds } = body as {
      entityType?: CollabEntityType; entityId?: string; reviewerIds?: string[];
    };
    if (!entityType || !entityId || !reviewerIds?.length) {
      json(res, 400, { error: "entityType_entityId_reviewerIds_required" }); return;
    }
    const approvals = await createApprovals({ workspaceId: tenantId, entityType, entityId, reviewerIds });
    for (const a of approvals) {
      await createNotification({
        userId: a.reviewerId, workspaceId: tenantId, type: "approval_requested",
        entityType, entityId, title: "Approval requested",
        body: `Your approval is needed for a ${entityType}.`,
      });
    }
    json(res, 201, { approvals });
    return;
  }

  const approvalIdMatch = /^\/approvals\/([^/]+)$/.exec(p);

  if (method === "PUT" && approvalIdMatch) {
    const id = approvalIdMatch[1]!;
    const body = await readBody(req);
    const { status, comment } = body as { status?: ApprovalStatus; comment?: string };
    if (!status) { json(res, 400, { error: "status_required" }); return; }
    const approval = await decideApproval(id, status, comment);
    if (!approval) { json(res, 404, { error: "not_found" }); return; }
    json(res, 200, { approval });
    return;
  }

  /* ── Comments ─────────────────────────────────────────────────── */

  if (method === "GET" && p === "/comments") {
    const entityType = qs.get("entityType") ?? "";
    const entityId   = qs.get("entityId") ?? "";
    if (!entityType || !entityId) { json(res, 400, { error: "entityType_entityId_required" }); return; }
    const comments = await listComments(tenantId, entityType, entityId);
    json(res, 200, { comments });
    return;
  }

  if (method === "POST" && p === "/comments") {
    const body = await readBody(req);
    const { entityType, entityId, authorId, authorName, text, parentId } = body as {
      entityType?: CollabEntityType; entityId?: string;
      authorId?: string; authorName?: string; text?: string; parentId?: string;
    };
    if (!entityType || !entityId || !authorId || !text) {
      json(res, 400, { error: "entityType_entityId_authorId_text_required" }); return;
    }
    const comment = await createComment({
      workspaceId: tenantId, entityType, entityId,
      authorId, authorName: authorName ?? authorId, body: text, parentId,
    });
    if (!comment) { json(res, 500, { error: "db_error" }); return; }
    json(res, 201, { comment });
    return;
  }

  const commentIdMatch = /^\/comments\/([^/]+)$/.exec(p);

  if (method === "PUT" && commentIdMatch) {
    const id = commentIdMatch[1]!;
    const body = await readBody(req);
    const { text } = body as { text?: string };
    if (!text) { json(res, 400, { error: "text_required" }); return; }
    const comment = await updateComment(id, text);
    if (!comment) { json(res, 404, { error: "not_found" }); return; }
    json(res, 200, { comment });
    return;
  }

  if (method === "DELETE" && commentIdMatch) {
    await deleteComment(commentIdMatch[1]!);
    json(res, 200, { ok: true });
    return;
  }

  /* ── Notifications ────────────────────────────────────────────── */

  if (method === "GET" && p === "/notifications") {
    const userId = qs.get("userId") ?? "";
    if (!userId) { json(res, 400, { error: "userId_required" }); return; }
    const limit      = Number(qs.get("limit") ?? "30");
    const unreadOnly = qs.get("unreadOnly") === "true";
    const notifications = await listNotifications(userId, tenantId, { limit, unreadOnly });
    json(res, 200, { notifications });
    return;
  }

  if (method === "PUT" && p === "/notifications/read-all") {
    const userId = qs.get("userId") ?? "";
    if (!userId) { json(res, 400, { error: "userId_required" }); return; }
    const count = await markAllNotificationsRead(userId, tenantId);
    json(res, 200, { count });
    return;
  }

  const notifReadMatch = /^\/notifications\/([^/]+)\/read$/.exec(p);
  if (method === "PUT" && notifReadMatch) {
    await markNotificationRead(notifReadMatch[1]!);
    json(res, 200, { ok: true });
    return;
  }

  /* ── Change history ───────────────────────────────────────────── */

  if (method === "GET" && p === "/history") {
    const entityType = qs.get("entityType") ?? "";
    const entityId   = qs.get("entityId") ?? "";
    const limit      = Number(qs.get("limit") ?? "20");
    if (!entityType || !entityId) { json(res, 400, { error: "entityType_entityId_required" }); return; }
    const history = await listChangeHistory(tenantId, entityType, entityId, limit);
    json(res, 200, { history });
    return;
  }

  if (method === "POST" && p === "/history") {
    const body = await readBody(req);
    const { entityType, entityId, actorId, actorName, action, field, oldValue, newValue } = body as {
      entityType?: CollabEntityType; entityId?: string; actorId?: string;
      actorName?: string; action?: string; field?: string;
      oldValue?: string; newValue?: string;
    };
    if (!entityType || !entityId || !actorId || !action) {
      json(res, 400, { error: "entityType_entityId_actorId_action_required" }); return;
    }
    await appendChangeHistory({
      workspaceId: tenantId, entityType, entityId,
      actorId, actorName: actorName ?? actorId, action,
      field, oldValue, newValue,
    });
    json(res, 201, { ok: true });
    return;
  }

  json(res, 404, { error: "not_found" });
}
