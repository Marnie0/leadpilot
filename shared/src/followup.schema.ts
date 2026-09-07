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

export const followUpQuerySchema = paginationSchema.extend({
  status: csvArray(z.enum(FOLLOW_UP_STATUSES)),
  assignedToId: csvArray(z.string().min(1).max(64)),
  leadId: idSchema.optional(),
  dueFrom: isoDateTime.optional(),
  dueTo: isoDateTime.optional(),
  sortBy: z.enum(FOLLOW_UP_SORT_FIELDS).default('dueAt'),
  sortDir: sortDirectionSchema.default('asc'),
});
export type FollowUpQueryInput = z.infer<typeof followUpQuerySchema>;

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
}
