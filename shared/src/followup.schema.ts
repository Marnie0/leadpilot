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
  timeZoneSchema,
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

/**
 * What the inbox can be ordered by.
 *
 * Sorting rather than drag-to-reorder, and the choice is deliberate. A manual
 * order needs a stored position per row, which fights everything this screen
 * is: the list is paginated (you cannot drag to page three), it is filtered
 * into buckets a task leaves the moment its date passes, and the ordering that
 * matters — soonest first — is derived from data that keeps moving. A sort
 * control gives the same "not always by date" freedom, works across pages, and
 * matches how the leads table already behaves.
 */
export const FOLLOW_UP_SORT_FIELDS = [
  'dueAt',
  'createdAt',
  'title',
  'customerName',
  'assignee',
] as const;
export type FollowUpSortField = (typeof FOLLOW_UP_SORT_FIELDS)[number];

/**
 * The buckets the inbox is organised into.
 *
 * These are *derived*, not stored: "overdue" is a pending follow-up whose due
 * date has passed, and it becomes overdue by the clock ticking rather than by
 * anyone writing to it. Storing it as a column would need a job to keep it
 * true, and would be wrong for exactly as long as that job was late.
 */
export const FOLLOW_UP_BUCKETS = [
  'overdue',
  'today',
  'week',
  'later',
  'done',
  'cancelled',
  'trash',
] as const;
export type FollowUpBucket = (typeof FOLLOW_UP_BUCKETS)[number];

/**
 * How long a trashed follow-up stays restorable.
 *
 * Trash is not the same idea as archiving a lead, and the two are deliberately
 * not unified. Archiving files something you mean to keep — it preserves the
 * activity trail a hard delete would destroy, and is never purged. Trash is
 * for a mistake: it disappears from every view immediately, can be undone, and
 * stops existing after the grace period rather than accumulating forever.
 */
export const TRASH_RETENTION_DAYS = 30;

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
  /**
   * The reader's IANA timezone, from the browser.
   *
   * Every bucket is a question about somebody's calendar — "is this overdue
   * *today*" — so the boundary has to be drawn in their day, not the server's.
   * Optional, and anything unrecognised falls back to UTC rather than failing
   * the request: a wrong-looking bucket is better than a broken screen.
   */
  tz: timeZoneSchema,
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
  /** Set while the follow-up is in the trash. Null for everything else. */
  deletedAt: string | null;
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
