import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { badRequest, validationError } from '../lib/errors.js';

type Source = 'body' | 'query' | 'params';

/** Flattens Zod issues into `{ 'field.path': ['message'] }` for form display. */
export function toFieldErrors(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

/**
 * Validates one part of the request and **replaces it with the parsed result**,
 * so downstream handlers see coerced, trimmed, defaulted values and never the
 * raw input. Unknown keys are stripped by Zod, which is what keeps a client from
 * smuggling extra fields into a Prisma write.
 */
export function validate<T>(schema: ZodType<T>, source: Source = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(validationError(toFieldErrors(result.error)));
      return;
    }

    if (source === 'query') {
      // Express 5 exposes `req.query` via a getter, so assign to a parallel
      // property instead of mutating it.
      Object.defineProperty(req, 'validatedQuery', {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } else {
      req[source] = result.data as never;
    }
    next();
  };
}

/** Reads what `validate(schema, 'query')` stored. */
export function validatedQuery<T>(req: Request): T {
  return (req as Request & { validatedQuery: T }).validatedQuery;
}

/**
 * Reads a route parameter as a string.
 *
 * Express 5 types `req.params[key]` as `string | string[] | undefined` because a
 * pattern can repeat. Our routes never do, and every one of them runs
 * `validate(schema, 'params')` first, so this narrows without a cast.
 */
export function param(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw badRequest(`Missing route parameter "${key}"`);
  }
  return value;
}
