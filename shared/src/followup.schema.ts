import { z } from 'zod';
import { msg } from './message.js';
import { FOLLOW_UP_CHANNELS, FOLLOW_UP_STATUSES } from './enums.js';
import {
  csvArray,
  idSchema,
  isoDateTime,
  optionalTrimmed,
  paginationSchema,
  requiredTrimmed,
  sortDirectionSchema,
} from './common.js';
import type { TeamMemberSummaryDto } from './lead.schema.js';

export const createFollowUpSchema = z.object({
  title: requiredTrimmed('field.title', 160, 2),
  dueAt: isoDateTime,
  channel: z.enum(FOLLOW_UP_CHANNELS).default('CALL'),
  notes: optionalTrimmed(1000),
  /** Defaults to the lead's assigned rep when omitted. */
  assignedToId: idSchema.nullish(),
});
export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
/** Pre-parse shape, for React Hook Form. See CreateLeadFormValues. */
export type CreateFollowUpFormValues = z.input<typeof createFollowUpSchema>;

export const updateFollowUpSchema = createFollowUpSchema
  .partial()
  .extend({ status: z.enum(FOLLOW_UP_STATUSES).optional() })
  .refine((values) => Object.keys(values).length > 0, { message: msg('validation.noChanges') });
export type UpdateFollowUpInput = z.infer<typeof updateFollowUpSchema>;

export const completeFollowUpSchema = z.object({
  /** Optional outcome note, written into the lead's activity feed. */
  outcome: optionalTrimmed(1000),
});
export type CompleteFollowUpInput = z.infer<typeof completeFollowUpSchema>;

export const FOLLOW_UP_SORT_FIELDS = ['dueAt', 'createdAt', 'status'] as const;

/**
 * The buckets the inbox is organised into.
 *
 * These are *derived*, not stored: "overdue" is a pending follow-up whose due
 * date has passed, and it becomes overdue by the clock ticking rather than by
 * anyone writing to it. Storing it as a column would need a job to keep it
 * true, and would be wrong for exactly as long as that job was late.
 */
export const FOLLOW_UP_BUCKETS = ['overdue', 'today', 'week', 'later', 'done'] as const;
export type FollowUpBucket = (typeof FOLLOW_UP_BUCKETS)[number];

export const followUpQuerySchema = paginationSchema.extend({
  status: csvArray(z.enum(FOLLOW_UP_STATUSES)),
  assignedToId: csvArray(z.string().min(1).max(64)),
  leadId: idSchema.optional(),
  dueFrom: isoDateTime.optional(),
  dueTo: isoDateTime.optional(),
  sortBy: z.enum(FOLLOW_UP_SORT_FIELDS).default('dueAt'),
  sortDir: sortDirectionSchema.default('asc'),
  /**
   * Server-computed bucket. The client could filter by date itself, but the
   * boundary between "today" and "overdue" would then be drawn in the browser's
   * clock while the counts beside it were drawn in the server's — and the two
   * disagree for anybody whose machine is a few minutes out.
   */
  bucket: z.enum(FOLLOW_UP_BUCKETS).optional(),
  /** Free-text over the follow-up title and its lead's customer or company. */
  q: optionalTrimmed(120),
});
export type FollowUpQueryInput = z.infer<typeof followUpQuerySchema>;

/** How many pending follow-ups sit in each bucket, for the inbox's tab chips. */
export type FollowUpCountsDto = Record<FollowUpBucket, number>;

export interface FollowUpDto {
  id: string;
  leadId: string;
  title: string;
  notes: string | null;
  dueAt: string;
  channel: (typeof FOLLOW_UP_CHANNELS)[number];
  status: (typeof FOLLOW_UP_STATUSES)[number];
  completedAt: string | null;
  createdAt: string;
  assignedTo: TeamMemberSummaryDto | null;
  /** Denormalised so the follow-ups list can link out without a second query. */
  lead?: { id: string; customerName: string; company: string | null };
  /**
   * Whether the viewer may complete, reschedule or cancel this one. Sent for
   * the same reason `LeadDto.canEdit` is: the UI disables the button rather
   * than letting someone find the rule by being refused.
   */
  canEdit?: boolean;
}

/** Rescheduling is an update, but the inbox wants it as its own small contract. */
export const rescheduleFollowUpSchema = z.object({ dueAt: isoDateTime });
export type RescheduleFollowUpInput = z.infer<typeof rescheduleFollowUpSchema>;
