/**
 * Phase 14 — Team collaboration contracts.
 *
 * Covers: workspace members, roles, review assignments, approval workflows,
 * threaded comments, and in-app notifications.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*                               Roles                                        */
/* -------------------------------------------------------------------------- */

export const WORKSPACE_ROLES = ["owner", "admin", "editor", "viewer", "client"] as const;
export const WorkspaceRoleSchema = z.enum(WORKSPACE_ROLES);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;

export const MEMBER_STATUSES = ["active", "invited", "suspended"] as const;
export const MemberStatusSchema = z.enum(MEMBER_STATUSES);
export type MemberStatus = z.infer<typeof MemberStatusSchema>;

/** What each role can do. */
export const ROLE_PERMISSIONS = {
  owner:   { manageMembers: true,  manageRoles: true,  publishContent: true,  editContent: true,  viewContent: true  },
  admin:   { manageMembers: true,  manageRoles: false, publishContent: true,  editContent: true,  viewContent: true  },
  editor:  { manageMembers: false, manageRoles: false, publishContent: false, editContent: true,  viewContent: true  },
  viewer:  { manageMembers: false, manageRoles: false, publishContent: false, editContent: false, viewContent: true  },
  client:  { manageMembers: false, manageRoles: false, publishContent: false, editContent: false, viewContent: true  },
} as const satisfies Record<WorkspaceRole, {
  manageMembers: boolean; manageRoles: boolean;
  publishContent: boolean; editContent: boolean; viewContent: boolean;
}>;

export function canDo(role: WorkspaceRole, permission: keyof typeof ROLE_PERMISSIONS.owner): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

/* -------------------------------------------------------------------------- */
/*                           Workspace members                                */
/* -------------------------------------------------------------------------- */

export const WorkspaceMemberSchema = z.object({
  id: z.string().min(1).max(120),
  workspaceId: z.string().min(1).max(120),
  userId: z.string().min(1).max(120),
  email: z.string().email().max(320),
  displayName: z.string().max(200),
  role: WorkspaceRoleSchema,
  status: MemberStatusSchema,
  invitedBy: z.string().min(1).max(120).nullable(),
  invitedAt: z.string().datetime(),
  joinedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;

export const InviteMemberBodySchema = z.object({
  email: z.string().email().max(320),
  role: WorkspaceRoleSchema,
  displayName: z.string().max(200).optional(),
}).strict();
export type InviteMemberBody = z.infer<typeof InviteMemberBodySchema>;

export const UpdateMemberRoleBodySchema = z.object({
  role: WorkspaceRoleSchema,
}).strict();
export type UpdateMemberRoleBody = z.infer<typeof UpdateMemberRoleBodySchema>;

/* -------------------------------------------------------------------------- */
/*                           Entity types                                     */
/* -------------------------------------------------------------------------- */

export const COLLAB_ENTITY_TYPES = ["schedule_entry", "campaign", "brief", "run"] as const;
export const CollabEntityTypeSchema = z.enum(COLLAB_ENTITY_TYPES);
export type CollabEntityType = z.infer<typeof CollabEntityTypeSchema>;

/* -------------------------------------------------------------------------- */
/*                           Review assignments                               */
/* -------------------------------------------------------------------------- */

export const REVIEW_STATUSES = ["pending", "in_review", "approved", "rejected", "changes_requested"] as const;
export const ReviewStatusSchema = z.enum(REVIEW_STATUSES);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const ReviewAssignmentSchema = z.object({
  id: z.string().min(1).max(120),
  workspaceId: z.string().min(1).max(120),
  entityType: CollabEntityTypeSchema,
  entityId: z.string().min(1).max(120),
  assigneeId: z.string().min(1).max(120),
  assignerId: z.string().min(1).max(120),
  dueAt: z.string().datetime().nullable(),
  status: ReviewStatusSchema,
  note: z.string().max(2000).nullable(),
  reviewNote: z.string().max(2000).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type ReviewAssignment = z.infer<typeof ReviewAssignmentSchema>;

export const CreateReviewAssignmentBodySchema = z.object({
  entityType: CollabEntityTypeSchema,
  entityId: z.string().min(1).max(120),
  assigneeId: z.string().min(1).max(120),
  dueAt: z.string().datetime().optional(),
  note: z.string().max(2000).optional(),
}).strict();
export type CreateReviewAssignmentBody = z.infer<typeof CreateReviewAssignmentBodySchema>;

export const UpdateReviewAssignmentBodySchema = z.object({
  status: ReviewStatusSchema,
  reviewNote: z.string().max(2000).optional(),
}).strict();
export type UpdateReviewAssignmentBody = z.infer<typeof UpdateReviewAssignmentBodySchema>;

/* -------------------------------------------------------------------------- */
/*                           Approvals                                        */
/* -------------------------------------------------------------------------- */

export const APPROVAL_STATUSES = ["pending", "approved", "rejected", "changes_requested"] as const;
export const ApprovalStatusSchema = z.enum(APPROVAL_STATUSES);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalSchema = z.object({
  id: z.string().min(1).max(120),
  workspaceId: z.string().min(1).max(120),
  entityType: CollabEntityTypeSchema,
  entityId: z.string().min(1).max(120),
  step: z.number().int().min(1).max(10),
  reviewerId: z.string().min(1).max(120),
  status: ApprovalStatusSchema,
  comment: z.string().max(4000).nullable(),
  decidedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type Approval = z.infer<typeof ApprovalSchema>;

export const RequestApprovalBodySchema = z.object({
  entityType: CollabEntityTypeSchema,
  entityId: z.string().min(1).max(120),
  reviewerIds: z.array(z.string().min(1).max(120)).min(1).max(10),
  note: z.string().max(2000).optional(),
}).strict();
export type RequestApprovalBody = z.infer<typeof RequestApprovalBodySchema>;

export const DecideApprovalBodySchema = z.object({
  status: z.enum(["approved", "rejected", "changes_requested"]),
  comment: z.string().max(4000).optional(),
}).strict();
export type DecideApprovalBody = z.infer<typeof DecideApprovalBodySchema>;

/* -------------------------------------------------------------------------- */
/*                           Comments                                         */
/* -------------------------------------------------------------------------- */

export const CommentSchema = z.object({
  id: z.string().min(1).max(120),
  workspaceId: z.string().min(1).max(120),
  entityType: CollabEntityTypeSchema,
  entityId: z.string().min(1).max(120),
  authorId: z.string().min(1).max(120),
  authorName: z.string().max(200),
  body: z.string().min(1).max(8000),
  parentId: z.string().min(1).max(120).nullable(),
  editedAt: z.string().datetime().nullable(),
  deletedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type Comment = z.infer<typeof CommentSchema>;

export const CreateCommentBodySchema = z.object({
  entityType: CollabEntityTypeSchema,
  entityId: z.string().min(1).max(120),
  body: z.string().min(1).max(8000),
  parentId: z.string().min(1).max(120).optional(),
}).strict();
export type CreateCommentBody = z.infer<typeof CreateCommentBodySchema>;

export const UpdateCommentBodySchema = z.object({
  body: z.string().min(1).max(8000),
}).strict();
export type UpdateCommentBody = z.infer<typeof UpdateCommentBodySchema>;

/* -------------------------------------------------------------------------- */
/*                           Notifications                                    */
/* -------------------------------------------------------------------------- */

export const TEAM_NOTIFICATION_TYPES = [
  "review_assigned",
  "approval_requested",
  "approval_decided",
  "comment_added",
  "comment_replied",
  "member_invited",
  "member_joined",
  "post_published",
  "post_failed",
] as const;
export const TeamNotificationTypeSchema = z.enum(TEAM_NOTIFICATION_TYPES);
export type TeamNotificationType = z.infer<typeof TeamNotificationTypeSchema>;

export const TeamNotificationSchema = z.object({
  id: z.string().min(1).max(120),
  userId: z.string().min(1).max(120),
  workspaceId: z.string().min(1).max(120),
  type: TeamNotificationTypeSchema,
  entityType: CollabEntityTypeSchema.nullable(),
  entityId: z.string().min(1).max(120).nullable(),
  title: z.string().max(200),
  body: z.string().max(500),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
}).strict();
export type TeamNotification = z.infer<typeof TeamNotificationSchema>;

/* -------------------------------------------------------------------------- */
/*                           Change history                                   */
/* -------------------------------------------------------------------------- */

export const ChangeHistoryEntrySchema = z.object({
  id: z.string().min(1).max(120),
  workspaceId: z.string().min(1).max(120),
  entityType: CollabEntityTypeSchema,
  entityId: z.string().min(1).max(120),
  actorId: z.string().min(1).max(120),
  actorName: z.string().max(200),
  action: z.string().max(120),
  field: z.string().max(120).nullable(),
  oldValue: z.string().max(2000).nullable(),
  newValue: z.string().max(2000).nullable(),
  createdAt: z.string().datetime(),
}).strict();
export type ChangeHistoryEntry = z.infer<typeof ChangeHistoryEntrySchema>;

export const RecordChangeBodySchema = z.object({
  entityType: CollabEntityTypeSchema,
  entityId: z.string().min(1).max(120),
  action: z.string().max(120),
  field: z.string().max(120).optional(),
  oldValue: z.string().max(2000).optional(),
  newValue: z.string().max(2000).optional(),
}).strict();
export type RecordChangeBody = z.infer<typeof RecordChangeBodySchema>;
