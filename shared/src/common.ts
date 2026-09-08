import { z } from 'zod';
import { msg, type MessageKey } from './message.js';

/** CUID v2 ids are what Prisma generates; keep validation loose but non-empty. */
export const idSchema = z
  .string()
  .min(1, { message: msg('validation.requiredShort') })
  .max(64);

/**
 * Trims a string before validating and turns `''` into **null**.
 *
 * The null matters: on a PATCH the service distinguishes `undefined` ("field not
 * supplied, leave it alone") from `null` ("clear it"). Mapping an emptied input
 * to `undefined` instead made it impossible to ever clear a field once set —
 * the form would report success and silently keep the old value.
 */
export const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: msg('validation.maxLength', { count: max }) })
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional();

export const requiredTrimmed = (fieldKey: MessageKey, max: number, min = 1) =>
  z
    // The `error` argument covers the invalid_type case — a field the client
    // omitted entirely. Without it, Zod reports its own internal wording
    // ("expected string, received undefined") straight into the form.
    .string({ error: msg('validation.required', { fieldKey }) })
    .trim()
    // Two separate lower bounds so an *empty* field reads "Company name is
    // required" while a *short* one reads "must be at least 2 characters".
    // Collapsing them into a single `.min(min)` told someone who typed one
    // character that they had typed nothing.
    .min(1, { message: msg('validation.required', { fieldKey }) })
    .min(min, { message: msg('validation.minLength', { fieldKey, count: min }) })
    .max(max, { message: msg('validation.tooLong', { fieldKey, count: max }) });

/**
 * Parses a comma-separated query-string value (`?stage=NEW,WON`) into an array.
 * Also accepts repeated params (`?stage=NEW&stage=WON`), which Express parses
 * into a real array.
 */
export const csvArray = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const list = Array.isArray(value) ? value : String(value).split(',');
    const cleaned = list.map((entry) => String(entry).trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : undefined;
  }, z.array(item).optional());

/** An ISO-8601 date-time string, as sent over JSON. */
export const isoDateTime = z
  .string({ error: msg('validation.dateRequired') })
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: msg('validation.date') });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export const sortDirectionSchema = z.enum(['asc', 'desc']);

/**
 * The reader's IANA timezone, sent by the browser on any query with a "today"
 * or "overdue" notion in it.
 *
 * Optional, and validated on the server rather than here: an unrecognised zone
 * falls back to UTC instead of failing the request, because a bucket drawn in
 * the wrong day is a smaller problem than a screen that will not load.
 */
export const timeZoneSchema = z.string().max(64).optional();

/**
 * The currency a reader wants aggregate figures converted into.
 *
 * Sent on any query that returns a total, for the same reason `tz` is sent on
 * any query with a "today" in it: the answer depends on something only the
 * browser knows, and the alternative is the server loading the caller's
 * profile on every aggregate. Validated loosely and resolved on the server,
 * where an unrecognised code falls back to the workspace's own currency rather
 * than failing the request — a total drawn in the wrong currency is labelled
 * with that currency and is a smaller problem than a screen that will not load.
 */
export const displayParamSchema = z.string().max(8).optional();
export type SortDirection = z.infer<typeof sortDirectionSchema>;

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

/** Shape of every non-2xx response from the API. */
export interface ApiErrorBody {
  error: {
    /** Stable machine-readable code, e.g. `VALIDATION_ERROR`. */
    code: string;
    message: string;
    /** Correlates this response with the server log line for the same request. */
    requestId?: string;
    /** Field-level messages, keyed by dot-path, when `code` is `VALIDATION_ERROR`. */
    details?: Record<string, string[]>;
    /**
     * Present in development, and in production only when
     * EXPOSE_ERROR_DETAILS=true. Carries the real error name, message and stack.
     */
    debug?: {
      name: string;
      detail: string;
      cause?: string;
      stack?: string[];
    };
  };
}
