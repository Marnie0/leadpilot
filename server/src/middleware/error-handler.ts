import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { toFieldErrors } from './validate.js';
import { logger } from '../logger.js';
import { env } from '../env.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `No route matches ${req.method} ${req.originalUrl}`,
      requestId: req.id,
    },
  });
};

/**
 * Everything we know about an error, for the log. Never sent to the client
 * wholesale — `detailsForClient` decides what is safe to return.
 */
function describe(err: unknown): {
  name: string;
  message: string;
  stack?: string | undefined;
  cause?: string | undefined;
} {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      cause: err.cause instanceof Error ? err.cause.message : undefined,
    };
  }
  return { name: typeof err, message: String(err) };
}

/**
 * The diagnostic block attached to a response.
 *
 * Development (and production with EXPOSE_ERROR_DETAILS=true) gets the real
 * error name, message and stack. Otherwise the client gets only a request id,
 * which is enough to find the full trace in the log without handing a stack
 * trace to whoever asks for one.
 */
function detailsForClient(err: unknown) {
  if (!env.exposeErrorDetails) return undefined;
  const described = describe(err);
  return {
    name: described.name,
    detail: described.message,
    ...(described.cause && { cause: described.cause }),
    ...(described.stack && { stack: described.stack.split('\n').map((line) => line.trim()) }),
  };
}

/**
 * The single place an error becomes a response.
 *
 * Every branch carries `requestId`, and every 5xx is logged with a real stack
 * trace. A fault should never reach the client as an unexplained 500 — if you
 * are reading a vague message, that is a bug in this file.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return;

  const requestId = req.id;

  if (err instanceof AppError) {
    // 5xx AppErrors are still faults worth a stack; 4xx are expected outcomes.
    if (err.status >= 500) {
      logger.error({ err, requestId, path: req.originalUrl }, err.message);
    } else {
      logger.warn({ requestId, code: err.code, path: req.originalUrl }, err.message);
    }
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        requestId,
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Some fields need your attention',
        requestId,
        details: toFieldErrors(err),
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error({ err, requestId, prismaCode: err.code }, 'Prisma request error');

    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'value';
      res.status(409).json({
        error: { code: 'CONFLICT', message: `That ${target} is already in use`, requestId },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Resource not found', requestId },
      });
      return;
    }

    // Any other Prisma code is a real fault — name it rather than swallowing it.
    res.status(500).json({
      error: {
        code: `PRISMA_${err.code}`,
        message: env.exposeErrorDetails
          ? err.message
          : `Database request failed (${err.code}). Reference ${requestId}.`,
        requestId,
        ...(detailsForClient(err) && { debug: detailsForClient(err) }),
      },
    });
    return;
  }

  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    logger.fatal({ err, requestId }, 'Database is unreachable');
    res.status(503).json({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Cannot reach the database. Check DATABASE_URL and that the Neon branch is awake.',
        requestId,
        ...(detailsForClient(err) && { debug: detailsForClient(err) }),
      },
    });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Request body is not valid JSON', requestId },
    });
    return;
  }

  const described = describe(err);
  logger.error(
    { err, requestId, path: req.originalUrl, method: req.method },
    `Unhandled error: ${described.message}`,
  );

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      // The real message when we are allowed to show it. The fallback still
      // carries the request id so the trace is one grep away.
      message: env.exposeErrorDetails
        ? `${described.name}: ${described.message}`
        : `Something failed while handling this request. Reference ${requestId}.`,
      requestId,
      ...(detailsForClient(err) && { debug: detailsForClient(err) }),
    },
  });
};
