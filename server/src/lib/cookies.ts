import type { CookieOptions, Response } from 'express';
import { env } from '../env.js';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './tokens.js';

export const ACCESS_COOKIE = 'lp_access';
export const REFRESH_COOKIE = 'lp_refresh';

/**
 * The client and API share an origin in every environment (Vite proxies `/api`
 * in development, Vercel routes it in production), so `SameSite=Lax` first-party
 * cookies work everywhere — including Safari and Brave, which drop the
 * `SameSite=None` cookies a cross-origin split would have required.
 */
const baseCookie: CookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: 'lax',
};

/** Scoped to the auth routes so it is never sent with ordinary API traffic. */
const REFRESH_COOKIE_PATH = '/api/auth';

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseCookie,
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseCookie,
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookie, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie, path: REFRESH_COOKIE_PATH });
}
