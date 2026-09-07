import { z } from 'zod';
import { ACTIVITY_TYPES, USER_ACTIVITY_TYPES } from './enums.js';
import { isoDateTime, optionalTrimmed, paginationSchema, requiredTrimmed } from './common.js';
import type { TeamMemberSummaryDto } from './lead.schema.js';

export const createActivitySchema = z.object({
  type: z.enum(USER_ACTIVITY_TYPES).default('NOTE'),
  body: requiredTrimmed('Note', 4000, 1),
  /** Defaults to now; lets a rep log a call they made earlier. */
  occurredAt: isoDateTime.optional(),
});
export type CreateActivityInput = z.infer<typeof createActivitySchema>;

export const updateActivitySchema = z.object({
  body: requiredTrimmed('Note', 4000, 1),
});
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;

export const activityQuerySchema = paginationSchema.extend({
  /** `notes` hides system audit entries; `all` shows the full timeline. */
  view: z.enum(['all', 'notes', 'system']).default('all'),
});
export type ActivityQueryInput = z.infer<typeof activityQuerySchema>;

/**
 * Structured payload for system-generated entries, so the client renders a
 * proper sentence instead of a pre-baked English string (needed for Phase 3 AR).
 */
export interface ActivityMetadata {
  fromStage?: string;
  toStage?: string;
  fromAssignee?: string | null;
  toAssignee?: string | null;
  field?: string;
  from?: string | null;
  to?: string | null;
  followUpTitle?: string;
  dueAt?: string;
}

export interface ActivityDto {
  id: string;
  leadId: string;
  type: (typeof ACTIVITY_TYPES)[number];
  body: string | null;
  metadata: ActivityMetadata | null;
  occurredAt: string;
  createdAt: string;
  /** Null for entries written by a user who has since been removed. */
  author: TeamMemberSummaryDto | null;
  /** True when the current user may edit or delete this entry. */
  canEdit: boolean;
}

export const ACTIVITY_NOTE_MAX_LENGTH = 4000;
export const optionalActivityBody = optionalTrimmed(ACTIVITY_NOTE_MAX_LENGTH);
