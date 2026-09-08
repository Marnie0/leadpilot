import { Router } from 'express';
import { z } from 'zod';
import {
  activityQuerySchema,
  createActivitySchema,
  idSchema,
  updateActivitySchema,
} from '@leadpilot/shared';
import { asyncHandler, getAuth, requireAuth } from '../../middleware/auth.js';
import { param, validate, validatedQuery } from '../../middleware/validate.js';
import type { Actor } from '../leads/leads.service.js';
import * as activitiesService from './activities.service.js';

/** Mounted at /api/leads/:leadId/activities — `mergeParams` exposes `leadId`. */
export const leadActivitiesRouter = Router({ mergeParams: true });

const actorFrom = (req: Parameters<typeof getAuth>[0]): Actor => {
  const auth = getAuth(req);
  return {
    userId: auth.userId,
    organizationId: auth.organizationId,
    permissions: auth.permissions,
    isOwner: auth.isOwner,
  };
};

const leadParams = z.object({ leadId: idSchema });

leadActivitiesRouter.use(requireAuth);

leadActivitiesRouter.get(
  '/',
  validate(leadParams, 'params'),
  validate(activityQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<z.infer<typeof activityQuerySchema>>(req);
    const result = await activitiesService.listActivities(
      actorFrom(req),
      param(req, 'leadId'),
      query,
    );
    res.json(result);
  }),
);

leadActivitiesRouter.post(
  '/',
  validate(leadParams, 'params'),
  validate(createActivitySchema),
  asyncHandler(async (req, res) => {
    const activity = await activitiesService.createActivity(
      actorFrom(req),
      param(req, 'leadId'),
      req.body,
    );
    res.status(201).json({ activity });
  }),
);

/** Mounted at /api/activities for edits and deletes by activity id. */
export const activitiesRouter = Router();
activitiesRouter.use(requireAuth);

activitiesRouter.patch(
  '/:id',
  validate(z.object({ id: idSchema }), 'params'),
  validate(updateActivitySchema),
  asyncHandler(async (req, res) => {
    const activity = await activitiesService.updateActivity(
      actorFrom(req),
      param(req, 'id'),
      req.body,
    );
    res.json({ activity });
  }),
);

activitiesRouter.delete(
  '/:id',
  validate(z.object({ id: idSchema }), 'params'),
  asyncHandler(async (req, res) => {
    await activitiesService.deleteActivity(actorFrom(req), param(req, 'id'));
    res.status(204).end();
  }),
);
