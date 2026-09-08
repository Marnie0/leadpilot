import { Router } from 'express';
import type { z } from 'zod';
import { dashboardQuerySchema } from '@leadpilot/shared';
import { asyncHandler, getAuth, requireAuth } from '../../middleware/auth.js';
import { validate, validatedQuery } from '../../middleware/validate.js';
import type { Actor } from '../leads/leads.service.js';
import * as dashboardService from './dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get(
  '/',
  validate(dashboardQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const actor: Actor = {
      userId: auth.userId,
      organizationId: auth.organizationId,
      permissions: auth.permissions,
      isOwner: auth.isOwner,
    };
    const query = validatedQuery<z.infer<typeof dashboardQuerySchema>>(req);
    res.json({ dashboard: await dashboardService.getDashboard(actor, query) });
  }),
);
