import { z } from 'zod';

/** CUID v2 ids are what Prisma generates; keep validation loose but non-empty. */
export const idSchema = z.string().min(1, { message: 'Required' }).max(64);

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
    .max(max, { message: `Must be ${max} characters or fewer` })
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional();

export const requiredTrimmed = (label: string, max: number, min = 1) =>
  z
    // The `error` argument covers the invalid_type case — a field the client
    // omitted entirely. Without it, Zod reports its own internal wording
    // ("expected string, received undefined") straight into the form.
    .string({ error: `${label} is required` })
    .trim()
    .min(min, { message: `${label} is required` })
    .max(max, { message: `${label} must be ${max} characters or fewer` });

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
  .string({ error: 'A date is required' })
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Enter a valid date' });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export const sortDirectionSchema = z.enum(['asc', 'desc']);
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
