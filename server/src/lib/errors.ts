/**
 * Application errors carry an HTTP status and a stable machine-readable code.
 * The error handler is the only place that turns them into a response body, so
 * an internal message can never leak by accident.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string[]>;
  /** `true` for errors we deliberately surface to the caller. */
  readonly expose: boolean;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { details?: Record<string, string[]>; expose?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.expose = options.expose ?? status < 500;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const badRequest = (message: string, details?: Record<string, string[]>) =>
  new AppError(400, 'BAD_REQUEST', message, { details });

export const validationError = (details: Record<string, string[]>) =>
  new AppError(422, 'VALIDATION_ERROR', 'Some fields need your attention', { details });

export const unauthorized = (message = 'You need to sign in to continue') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'You do not have access to this resource') =>
  new AppError(403, 'FORBIDDEN', message);

/**
 * Used for both "does not exist" and "belongs to another organisation" so the
 * API never confirms the existence of another tenant's records.
 */
export const notFound = (resource = 'Resource') =>
  new AppError(404, 'NOT_FOUND', `${resource} not found`);

export const conflict = (message: string, code = 'CONFLICT') =>
  new AppError(409, code, message);

export const tooManyRequests = (message = 'Too many requests. Please try again shortly.') =>
  new AppError(429, 'RATE_LIMITED', message);
