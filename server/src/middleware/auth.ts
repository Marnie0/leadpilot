import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Permission } from '@leadpilot/shared';
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
        isActive: true,
        isOwner: true,
        organizationId: true,
        sessionsValidFrom: true,
        // One join for the permission set. The user row was already being read
        // on every request; this rides along rather than adding a round trip.
        role: { select: { id: true, key: true, name: true, nameAr: true, permissions: true } },
      },
    });

    if (!user || !user.isActive) {
      next(unauthorized('Your account is no longer active', 'ACCOUNT_INACTIVE'));
      return;
    }

    /*
     * A credential change invalidates tokens issued before it.
     *
     * Revoking the refresh tokens alone was not enough: the access token is a
     * stateless JWT and keeps working until it expires, so a password reset
     * left whoever held one with up to fifteen more minutes — exactly the
     * window the reset exists to close.
     *
     * `iat` is whole seconds, so the epoch is floored to seconds too.
     * Comparing against the millisecond value would reject a token minted in
     * the same second as the change — including the fresh one handed back by
     * `changePassword`, which would sign the user out of the request they just
     * made.
     */
    if (user.sessionsValidFrom) {
      const issuedAt = typeof claims.iat === 'number' ? claims.iat : 0;
      if (issuedAt < Math.floor(user.sessionsValidFrom.getTime() / 1000)) {
        next(unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED'));
        return;
      }
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
      permissions: user.role.permissions as Permission[],
      isOwner: user.isOwner,
      role: {
        id: user.role.id,
        key: user.role.key,
        name: user.role.name,
        nameAr: user.role.nameAr,
      },
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

/**
 * Route guard for a single permission.
 *
 * Replaces `requireRole('OWNER', 'ADMIN')`. The difference matters: a workspace
 * can now define its own roles, so a guard phrased against a fixed tier cannot
 * answer for a role somebody created this morning.
 */
export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    const auth = req.auth;
    if (!auth) {
      next(unauthorized());
      return;
    }
    if (!auth.isOwner && !auth.permissions.includes(permission)) {
      next(forbidden('You do not have permission to do that'));
      return;
    }
    next();
  };
}

/**
 * Route guard for the workspace owner.
 *
 * For the three powers that are deliberately not permissions — managing roles,
 * transferring ownership, deleting the workspace — because anyone who could
 * grant themselves those could grant themselves everything else.
 */
export const requireOwner: RequestHandler = (req, _res, next) => {
  const auth = req.auth;
  if (!auth) {
    next(unauthorized());
    return;
  }
  if (!auth.isOwner) {
    next(forbidden('Only the workspace owner can do that', 'OWNER_ONLY'));
    return;
  }
  next();
};

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
