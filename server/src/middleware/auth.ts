import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { prisma } from '../db.js';
import { ACCESS_COOKIE } from '../lib/cookies.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

/**
 * Reads the access token from the httpOnly cookie, falling back to a Bearer
 * header. The header path exists so the API stays usable from curl, Postman and
 * a future mobile client; browsers always use the cookie.
 */
function extractToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.[ACCESS_COOKIE];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) return cookieToken;

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || undefined;

  return undefined;
}

/**
 * Rejects the request unless it carries a valid access token for an active user.
 *
 * The user row is re-read on every request rather than trusted from the token.
 * That costs one indexed primary-key lookup and buys immediate effect for
 * deactivation and role changes — otherwise a removed rep would keep full access
 * until their token expired.
 */
export const requireAuth: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const token = extractToken(req);
    if (!token) {
      next(unauthorized());
      return;
    }

    let claims: Awaited<ReturnType<typeof verifyAccessToken>>;
    try {
      claims = await verifyAccessToken(token);
    } catch {
      // Expired or tampered — the client should hit /api/auth/refresh.
      next(unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED'));
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        organizationId: true,
      },
    });

    if (!user || !user.isActive) {
      next(unauthorized('Your account is no longer active', 'ACCOUNT_INACTIVE'));
      return;
    }

    // Defence in depth: if a token were ever minted for the wrong tenant, the
    // database row — not the token — decides which organisation we scope to.
    if (user.organizationId !== claims.org) {
      next(unauthorized('Your session is no longer valid'));
      return;
    }

    req.auth = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
      name: user.name,
    };
    next();
  } catch (error) {
    next(error);
  }
};

/** Narrows `req.auth` for handlers that run behind `requireAuth`. */
export function getAuth(req: Request): Express.AuthContext {
  if (!req.auth) {
    // A programming error, not a client error: the route is missing requireAuth.
    throw unauthorized();
  }
  return req.auth;
}

/** Route guard for organisation administration (team management, settings). */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    const auth = req.auth;
    if (!auth) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(auth.role)) {
      next(forbidden('Only an owner or admin can do that'));
      return;
    }
    next();
  };
}

/**
 * Wraps an async handler so a rejected promise reaches the error middleware.
 * Express 5 forwards rejections automatically, but this keeps the intent
 * explicit and the behaviour identical if the app is ever downgraded.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
