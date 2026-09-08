import { z } from 'zod';
import { msg } from './message.js';
import { currencySchema, type MoneyTotalDto } from './currency.schema.js';
import { LEAD_PRIORITIES, LEAD_SOURCES, STAGE_KEYS, STAGE_TYPES, type Currency } from './enums.js';
import {
  csvArray,
  idSchema,
  isoDateTime,
  optionalTrimmed,
  paginationSchema,
  requiredTrimmed,
  sortDirectionSchema,
  timeZoneSchema,
  displayParamSchema,
} from './common.js';

/** Loose international phone check — we normalise, we do not gatekeep. */
export const phoneSchema = z
  .string()
  .trim()
  .max(32, { message: msg('validation.phoneTooLong') })
  .refine((value) => value.length === 0 || /^[+()\d][\d\s().-]{5,}$/.test(value), {
    message: msg('validation.phone'),
  })
  // Empty becomes null, not undefined, so an emptied field is a real clear.
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

export const leadEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .refine((value) => value.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: msg('validation.email'),
  })
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

/** Money is stored as Prisma `Decimal` and travels over JSON as a number. */
export const estimatedValueSchema = z.coerce
  .number({ message: msg('validation.number') })
  .min(0, { message: msg('validation.negative') })
  .max(1_000_000_000, { message: msg('validation.tooLarge') });

export const createLeadSchema = z.object({
  customerName: requiredTrimmed('field.customerName', 120, 2),
  company: optionalTrimmed(120),
  email: leadEmailSchema,
  phone: phoneSchema,
  source: z.enum(LEAD_SOURCES).default('OTHER'),
  requestedService: requiredTrimmed('field.requestedService', 160, 2),
  estimatedValue: estimatedValueSchema.default(0),
  /**
   * The currency this lead's value was quoted in.
   *
   * Optional, and omitting it inherits the workspace's default — which is what
   * the great majority of leads want and what the form pre-selects. Supplying
   * it is how a workspace that quotes in more than one currency records the
   * figure it actually gave the customer.
   *
   * This was once refused from the client on the grounds that the pipeline
   * aggregates sum `estimatedValue` directly, so a per-lead currency turned
   * "total pipeline value" into arithmetic between different units. The premise
   * was right and the conclusion was backwards: the fix is for the aggregates
   * to stop pretending a mixed total is one number, not for the product to
   * refuse to record what the customer was actually quoted. They now group by
   * currency — see `MoneyTotalDto`.
   */
  currency: currencySchema.optional(),
  priority: z.enum(LEAD_PRIORITIES).default('MEDIUM'),
  stageKey: z.enum(STAGE_KEYS).default('NEW'),
  assignedToId: idSchema.nullish(),
  description: optionalTrimmed(2000),
  tags: z
    .array(requiredTrimmed('field.tag', 32))
    .max(12, { message: msg('validation.tagsMax', { count: 12 }) })
    .optional(),
  nextFollowUpAt: isoDateTime.nullish(),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
/**
 * The *input* side of the schema: fields carrying `.default()` are optional
 * before parsing and required after. React Hook Form must be typed with this,
 * and `handleSubmit` then hands the resolved `CreateLeadInput` to the callback.
 */
export type CreateLeadFormValues = z.input<typeof createLeadSchema>;

/**
 * Every field optional so a detail-view inline edit can PATCH a single key.
 * `lostReason` is only meaningful when moving into the LOST stage.
 */
export const updateLeadSchema = createLeadSchema
  .partial()
  .extend({ lostReason: optionalTrimmed(280) })
  .refine((values) => Object.keys(values).length > 0, {
    message: msg('validation.noChanges'),
  });
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

/** Dedicated endpoint so a stage move is always audited, never a silent PATCH. */
export const moveLeadStageSchema = z.object({
  stageKey: z.enum(STAGE_KEYS),
  lostReason: optionalTrimmed(280),
});
export type MoveLeadStageInput = z.infer<typeof moveLeadStageSchema>;

export const assignLeadSchema = z.object({
  assignedToId: idSchema.nullable(),
});
export type AssignLeadInput = z.infer<typeof assignLeadSchema>;

/**
 * Bulk actions over a set of leads.
 *
 * Capped rather than unbounded: the leads table pages at 100, so a selection
 * cannot legitimately exceed that, and an uncapped `id IN (…)` is a
 * denial-of-service waiting to happen.
 */
export const BULK_LEAD_LIMIT = 100;

/** Permanently destroying a lead. The name is the confirmation; see
 *  `confirmationMatches`. */
export const purgeLeadSchema = z.object({
  confirmName: z
    .string()
    .min(1, { message: msg('validation.confirmName') })
    .max(120),
});
export type PurgeLeadInput = z.infer<typeof purgeLeadSchema>;

export const bulkLeadIdsSchema = z.object({
  // Deduplicated on the way in. The UI selects into a Set so it cannot produce
  // a repeat, but the endpoint is public: a caller sending the same id twice
  // otherwise inflated `unchanged`, because the row is updated once while the
  // requested count included it twice.
  ids: z
    .array(idSchema)
    .min(1)
    .max(BULK_LEAD_LIMIT)
    .transform((ids) => [...new Set(ids)]),
});
export type BulkLeadIdsInput = z.infer<typeof bulkLeadIdsSchema>;

export const bulkMoveStageSchema = bulkLeadIdsSchema.extend({
  stageKey: z.enum(STAGE_KEYS),
  lostReason: optionalTrimmed(280),
});
export type BulkMoveStageInput = z.infer<typeof bulkMoveStageSchema>;

export const bulkAssignSchema = bulkLeadIdsSchema.extend({
  assignedToId: idSchema.nullable(),
});
export type BulkAssignInput = z.infer<typeof bulkAssignSchema>;

/**
 * What a bulk action actually did.
 *
 * A skip is not an error, but the two reasons for one are different answers and
 * the UI has to be able to tell them apart. "You may not touch this lead" is
 * something the user might want to do something about; "this lead was already
 * assigned to that person" is not. Reporting a single `skipped` count forced
 * the interface to guess, and it guessed wrong — telling an owner they could
 * only change their own leads.
 */
export interface BulkLeadResultDto {
  updated: number;
  /** Already in the requested state, archived, or no longer there. */
  unchanged: number;
  /**
   * Ids that were present and needed the change, but were not the caller's to
   * make. Ids rather than a count so the UI can keep exactly those rows
   * selected — "3 skipped" is not an answer to "which three?", and clearing the
   * selection threw away the only record of it.
   *
   * Reachable when a lead is reassigned between the browser listing it and the
   * action being sent: the list carries `canEdit` per row, so a stale cache is
   * the usual way a caller asks for something it can no longer do.
   */
  notPermitted: string[];
}

export const LEAD_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'customerName',
  'company',
  'estimatedValue',
  'nextFollowUpAt',
  'lastActivityAt',
  'stage',
  'priority',
] as const;
export type LeadSortField = (typeof LEAD_SORT_FIELDS)[number];

/** Preset windows for the "next follow-up" filter chip. */
export const FOLLOW_UP_FILTERS = ['any', 'overdue', 'today', 'week', 'none'] as const;
export type FollowUpFilter = (typeof FOLLOW_UP_FILTERS)[number];

export const UNASSIGNED = '__unassigned__';

/**
 * Which set of leads a list is looking at.
 *
 * Three states rather than two booleans, because they are mutually exclusive:
 * `archived=true&deleted=true` would be a legal query with no meaning. The
 * distinction they encode is the point of the whole feature — filing something
 * you mean to keep is not the same act as deciding it should not exist.
 */
export const LEAD_VIEWS = ['active', 'archived', 'trash'] as const;
export type LeadView = (typeof LEAD_VIEWS)[number];

/**
 * Typing the customer's name is what stands between somebody and an
 * unrecoverable delete.
 *
 * A fixed word — "DELETE" — can be typed without reading; the record's own name
 * cannot. Normalised rather than compared raw: NFC because an Arabic name can
 * arrive composed or decomposed and is the same name either way, case-folded
 * and trimmed because the friction is meant to make you look, not to make you
 * fight a text box.
 *
 * Lives here so the browser and the API apply the identical rule. A client-side
 * check on the one irreversible action in the product is decoration.
 */
export function confirmationMatches(typed: string, expected: string): boolean {
  const normalise = (value: string) => value.normalize('NFC').trim().toLocaleLowerCase();
  return normalise(typed).length > 0 && normalise(typed) === normalise(expected);
}

export const leadQuerySchema = paginationSchema.extend({
  /** Free-text search across name, company, email, phone and service. */
  q: z.string().trim().max(120).optional(),
  stage: csvArray(z.enum(STAGE_KEYS)),
  source: csvArray(z.enum(LEAD_SOURCES)),
  priority: csvArray(z.enum(LEAD_PRIORITIES)),
  /** Accepts user ids plus the literal `__unassigned__`. */
  assignedToId: csvArray(z.string().min(1).max(64)),
  tag: csvArray(z.string().min(1).max(32)),
  minValue: z.coerce.number().min(0).optional(),
  maxValue: z.coerce.number().min(0).optional(),
  createdFrom: isoDateTime.optional(),
  createdTo: isoDateTime.optional(),
  followUp: z.enum(FOLLOW_UP_FILTERS).default('any'),
  /** Which set to list: the active pipeline, the archive, or the trash. */
  view: z.enum(LEAD_VIEWS).default('active'),
  /** `true` hides leads sitting in a WON or LOST stage. */
  openOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .optional(),
  sortBy: z.enum(LEAD_SORT_FIELDS).default('updatedAt'),
  sortDir: sortDirectionSchema.default('desc'),
  /** Draws the `followUp` filter's day boundaries in the reader's timezone. */
  tz: timeZoneSchema,
  /** Currency the aggregate totals should be converted into. */
  display: displayParamSchema,
});
export type LeadQueryInput = z.infer<typeof leadQuerySchema>;

/**
 * The filtering half of a lead query, with pagination and sorting dropped.
 * The board and the dashboard narrow the same set of leads as the table, so
 * they share one `where` builder and every filter behaves identically across
 * all three views.
 */
export type LeadFilterInput = Partial<LeadQueryInput>;

/* ------------------------------------------------------------------ *
 * Response DTOs
 * ------------------------------------------------------------------ */

export interface PipelineStageDto {
  id: string;
  key: (typeof STAGE_KEYS)[number];
  name: string;
  nameAr: string;
  color: string;
  order: number;
  type: (typeof STAGE_TYPES)[number];
  /** 0-100. The odds a lead here eventually closes; drives the revenue forecast. */
  winProbability: number;
}

export interface TeamMemberSummaryDto {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  avatarColor: string;
  isActive: boolean;
}

/** Row shape for the leads table. Kept lean — the detail view fetches the rest. */
export interface LeadListItemDto {
  id: string;
  customerName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: (typeof LEAD_SOURCES)[number];
  requestedService: string;
  estimatedValue: number;
  currency: string;
  priority: (typeof LEAD_PRIORITIES)[number];
  stage: PipelineStageDto;
  assignedTo: TeamMemberSummaryDto | null;
  tags: string[];
  nextFollowUpAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Whether the *current viewer* may change this lead — owners and admins can
   * touch anything, a rep only the leads they own. Computed server-side and
   * sent per row so the UI can disable an affordance up front (a card that
   * cannot be dragged, say) instead of letting the action fail with a 403.
   */
  canEdit: boolean;
}

export interface LeadDetailDto extends LeadListItemDto {
  description: string | null;
  archivedAt: string | null;
  /** Set while the lead is in the trash. Null for everything else. */
  deletedAt: string | null;
  lostReason: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lastContactedAt: string | null;
  createdBy: TeamMemberSummaryDto | null;
  /** Total of open + completed follow-ups, for the detail header counters. */
  counts: { activities: number; followUps: number; openFollowUps: number };
}

/** Aggregate returned alongside a filtered list, so the header reflects filters. */
export interface LeadStatsDto {
  totalLeads: number;
  openLeads: number;
  wonLeads: number;
  lostLeads: number;
  /*
   * Money arrives as a `MoneyTotalDto` rather than a number because a workspace
   * may hold leads in several currencies, and there is no single number that
   * honestly describes that. Each of these carries both readings — the
   * per-currency figures and the converted total — so the reader's view
   * preference is applied at render time without another round trip.
   */
  totalPipelineValue: MoneyTotalDto;
  wonValue: MoneyTotalDto;
  overdueFollowUps: number;
  byStage: Array<{ key: (typeof STAGE_KEYS)[number]; count: number; value: MoneyTotalDto }>;
  /** Every currency represented across the filtered set, for the view switcher. */
  currencies: Currency[];
}
