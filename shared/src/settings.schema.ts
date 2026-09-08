import { z } from 'zod';
import { msg } from './message.js';
import { LOCALES } from './enums.js';
import { requiredTrimmed } from './common.js';
import { currencySchema } from './currency.schema.js';

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
}
