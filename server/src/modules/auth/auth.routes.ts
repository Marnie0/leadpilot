import { Router } from 'express';
import {
  verifyEmailSchema,
  resetPasswordSchema,
  forgotPasswordSchema,
  changePasswordSchema,
  loginSchema,
  signupSchema,
  updateProfileSchema,
} from '@leadpilot/shared';
import { asyncHandler, getAuth, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  authLimiter,
  demoLimiter,
  signupLimiter,
  tokenLimiter,
} from '../../middleware/rate-limit.js';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from '../../lib/cookies.js';
import type { SessionContext } from './auth.service.js';
import * as authService from './auth.service.js';

export const authRouter = Router();

const sessionContext = (req: {
  headers: Record<string, unknown>;
  ip?: string | undefined;
}): SessionContext => ({
  userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  ipAddress: req.ip,
});

/*
 * Signing up answers 202 and sets no cookie.
 *
 * Not an oversight: issuing a session only for addresses that did not already
 * have an account makes the presence of `Set-Cookie` an enumeration oracle, no
 * matter how carefully the JSON body is worded. See `authService.signup`.
 */
authRouter.post(
  '/signup',
  signupLimiter,
  validate(signupSchema),
  asyncHandler(async (req, res) => {
    res.status(202).json(await authService.signup(req.body, sessionContext(req)));
  }),
);

authRouter.post(
  '/verify-email',
  tokenLimiter,
  validate(verifyEmailSchema),
  asyncHandler(async (req, res) => {
    await authService.verifyEmail(req.body.token);
    res.status(204).end();
  }),
);

/** Re-sends the confirmation to the signed-in user's own address. */
authRouter.post(
  '/resend-verification',
  requireAuth,
  signupLimiter,
  asyncHandler(async (req, res) => {
    res.json(await authService.resendVerification(getAuth(req).userId));
  }),
);

/*
 * Both password-reset endpoints answer the same way for every input, which is
 * why neither returns anything about the account. `authLimiter` is keyed on
 * IP + email, so the timing of a stream of guesses cannot be used either.
 */
authRouter.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    res.status(202).json(await authService.forgotPassword(req.body));
  }),
);

authRouter.post(
  '/reset-password',
  tokenLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body);
    res.status(204).end();
  }),
);

/**
 * Opens a private demo sandbox — a full clone of the template workspace — and
 * signs the visitor into it. Rate limited per IP: cloning is the most expensive
 * unauthenticated operation the API exposes.
 */
authRouter.post(
  '/demo',
  demoLimiter,
  asyncHandler(async (req, res) => {
    const { user, accessToken, refreshToken } = await authService.startDemoSession(
      sessionContext(req),
    );
    setAuthCookies(res, { accessToken, refreshToken });
    res.status(201).json({ user });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { user, accessToken, refreshToken } = await authService.login(
      req.body,
      sessionContext(req),
    );
    setAuthCookies(res, { accessToken, refreshToken });
    res.json({ user });
  }),
);

/**
 * Called by the client's fetch wrapper when a request comes back 401, then the
 * original request is retried once.
 */
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const rawToken = req.cookies?.[REFRESH_COOKIE];
    if (typeof rawToken !== 'string' || rawToken.length === 0) {
      clearAuthCookies(res);
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'You need to sign in to continue' },
      });
      return;
    }

    try {
      const { user, accessToken, refreshToken } = await authService.refreshSession(
        rawToken,
        sessionContext(req),
      );
      setAuthCookies(res, { accessToken, refreshToken });
      res.json({ user });
    } catch (error) {
      // Always clear cookies on a failed refresh so the browser stops replaying
      // a token that will never work again.
      clearAuthCookies(res);
      throw error;
    }
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await authService.logout(req.cookies?.[REFRESH_COOKIE]);
    clearAuthCookies(res);
    res.status(204).end();
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.getCurrentUser(getAuth(req).userId);
    res.json({ user });
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await authService.updateProfile(getAuth(req).userId, req.body);
    res.json({ user });
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  authLimiter,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    await authService.changePassword(getAuth(req).userId, req.body);
    // Every session was revoked, including this one — force a fresh sign-in.
    clearAuthCookies(res);
    res.status(204).end();
  }),
);
