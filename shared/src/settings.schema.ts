import { z } from 'zod';
import { msg } from './message.js';
import { LOCALES } from './enums.js';
import { requiredTrimmed } from './common.js';
import { currencySchema, type FxRatesDto } from './currency.schema.js';

/**
 * Workspace settings.
 *
 * The base currency is deliberately **not** here: changing it restates every
 * stored amount in the workspace, so it has its own confirmed endpoint rather
 * than riding along in a form that also renames the company. See
 * `changeCurrencySchema`.
 */
export const updateOrganizationSchema = z
  .object({
    name: requiredTrimmed('field.workspaceName', 80, 2).optional(),
    defaultLocale: z.enum(LOCALES).optional(),
  })
  .refine((values) => Object.keys(values).length > 0, { message: msg('validation.noChanges') });
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export interface OrganizationSettingsDto {
  id: string;
  name: string;
  slug: string;
  defaultCurrency: string;
  /** The language a brand-new member starts in, before they pick their own. */
  defaultLocale: (typeof LOCALES)[number];
  isDemo: boolean;
  expiresAt: string | null;
  createdAt: string;
  /** Headline counts, so the settings screen can say what is at stake. */
  counts: { members: number; leads: number; archivedLeads: number };
}

/** Preview of what changing the base currency would do, before it is done. */
export const currencyPreviewSchema = z.object({ currency: currencySchema });
export type CurrencyPreviewInput = z.infer<typeof currencyPreviewSchema>;

export interface CurrencyPreviewDto {
  from: string;
  to: string;
  /** Units of `to` per one `from`. */
  rate: number;
  /** How many leads — archived ones included — would be restated. */
  leads: number;
  /** Current pipeline total in `from`, and the same figure in `to`. */
  totalBefore: number;
  totalAfter: number;
  asOf: string;
  /**
   * Which tier of `getRates()` answered.
   *
   * Carried because this preview is the body of a confirmation for an
   * irreversible rewrite, and `fallback` means the figures are compiled into
   * the build rather than current. Quoting a stale rate as though it were
   * today's, on the one screen that permanently restates somebody's money, is
   * the version of this feature worth being careful about.
   */
  source: FxRatesDto['source'];
}

/* ------------------------------------------------------------------ *
 * Workspace audit
 * ------------------------------------------------------------------ */

export const WORKSPACE_EVENT_TYPES = [
  'CURRENCY_CHANGED',
  'OWNERSHIP_TRANSFERRED',
  'MEMBER_INVITED',
  'INVITE_ACCEPTED',
  'INVITE_REVOKED',
  'MEMBER_ROLE_CHANGED',
  'MEMBER_REMOVED',
  'ROLE_CREATED',
  'ROLE_UPDATED',
  'ROLE_DELETED',
  'ACCOUNT_DELETED',
] as const;
export type WorkspaceEventType = (typeof WORKSPACE_EVENT_TYPES)[number];

/**
 * Something that happened to the workspace rather than to one lead.
 *
 * A lead's `Activity` row cannot express this: every one of them needs a
 * `leadId`, and "the owner restated every amount in this workspace" belongs to
 * none of them in particular. Kept because the change is irreversible, and an
 * irreversible change with no record of who made it is the kind of thing
 * somebody has to reconstruct from memory a month later.
 */
export interface WorkspaceEventDto {
  id: string;
  type: WorkspaceEventType;
  createdAt: string;
  /** Null once the person who did it has left the workspace. */
  actor: { id: string; name: string } | null;
  /** For CURRENCY_CHANGED: what it was, what it became, and at what rate. */
  currencyChange?: { from: string; to: string; rate: number; leads: number };
  /**
   * For the membership events: who it was about, and what changed.
   *
   * `subject` is a name rather than an id because the person may since have
   * been removed, and "Ahmed was removed from the workspace" has to keep
   * reading correctly once the row it pointed at is gone.
   */
  membership?: {
    subject: string;
    /** For a role change or an invite: the role involved. */
    role?: string;
    /** For a role change: what it was before. */
    previousRole?: string;
  };
}
