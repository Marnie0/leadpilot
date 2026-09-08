import { Router } from 'express';
import { z } from 'zod';
import { acceptInvitationSchema, createInvitationSchema, idSchema } from '@leadpilot/shared';
import { asyncHandler, getAuth, requireAuth } from '../../middleware/auth.js';
import { param, validate } from '../../middleware/validate.js';
import { inviteLimiter } from '../../middleware/rate-limit.js';
import type { Actor } from '../leads/leads.service.js';
import * as service from './invitations.service.js';

const actorFrom = (req: Parameters<typeof getAuth>[0]): Actor => {
  const auth = getAuth(req);
  return { userId: auth.userId, organizationId: auth.organizationId, role: auth.role };
};

/** Mounted at /api/team/invitations — administering who has been asked in. */
export const invitationsRouter = Router();
invitationsRouter.use(requireAuth);

invitationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ invitations: await service.listInvitations(actorFrom(req)) });
  }),
);

invitationsRouter.post(
  '/',
  validate(createInvitationSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ invitation: await service.createInvitation(actorFrom(req), req.body) });
  }),
);

invitationsRouter.delete(
  '/:id',
  validate(z.object({ id: idSchema }), 'params'),
  asyncHandler(async (req, res) => {
    res.json({ invitation: await service.revokeInvitation(actorFrom(req), param(req, 'id')) });
  }),
);

/**
 * Mounted at /api/invites — the public half.
 *
 * Unauthenticated on purpose: the person accepting has no account yet, and the
 * token in the path *is* the authorisation — which is why it gets its own
 * budget rather than the signup one. See `inviteLimiter`.
 */
export const publicInvitesRouter = Router();

const tokenParams = z.object({ token: z.string().min(16).max(200) });

publicInvitesRouter.get(
  '/:token',
  validate(tokenParams, 'params'),
  asyncHandler(async (req, res) => {
    res.json({ invitation: await service.previewInvitation(param(req, 'token')) });
  }),
);

publicInvitesRouter.post(
  '/:token/accept',
  inviteLimiter,
  validate(tokenParams, 'params'),
  validate(acceptInvitationSchema),
  asyncHandler(async (req, res) => {
    await service.acceptInvitation(param(req, 'token'), req.body);
    // No session is issued, for the same reason signing up does not issue one:
    // the new member signs in with the password they just chose.
    res.status(201).json({ ok: true });
  }),
);
