import { Router } from 'express';
import { z } from 'zod';
import {
  completeFollowUpSchema,
  createFollowUpSchema,
  followUpQuerySchema,
  idSchema,
  rescheduleFollowUpSchema,
  updateFollowUpSchema,
} from '@leadpilot/shared';
import { asyncHandler, getAuth, requireAuth } from '../../middleware/auth.js';
import { param, validate, validatedQuery } from '../../middleware/validate.js';
import type { Actor } from '../leads/leads.service.js';
import * as followUpsService from './follow-ups.service.js';

const actorFrom = (req: Parameters<typeof getAuth>[0]): Actor => {
  const auth = getAuth(req);
  return { userId: auth.userId, organizationId: auth.organizationId, role: auth.role };
};

/** Mounted at /api/leads/:leadId/follow-ups. */
export const leadFollowUpsRouter = Router({ mergeParams: true });
leadFollowUpsRouter.use(requireAuth);

leadFollowUpsRouter.get(
  '/',
  validate(z.object({ leadId: idSchema }), 'params'),
  validate(followUpQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<z.infer<typeof followUpQuerySchema>>(req);
    const result = await followUpsService.listFollowUps(actorFrom(req), {
      ...query,
      leadId: param(req, 'leadId'),
    });
    res.json(result);
  }),
);

leadFollowUpsRouter.post(
  '/',
  validate(z.object({ leadId: idSchema }), 'params'),
  validate(createFollowUpSchema),
  asyncHandler(async (req, res) => {
    const followUp = await followUpsService.createFollowUp(
      actorFrom(req),
      param(req, 'leadId'),
      req.body,
    );
    res.status(201).json({ followUp });
  }),
);

/** Mounted at /api/follow-ups — the organisation-wide task list. */
export const followUpsRouter = Router();
followUpsRouter.use(requireAuth);

const followUpParams = z.object({ id: idSchema });

followUpsRouter.get(
  '/',
  validate(followUpQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<z.infer<typeof followUpQuerySchema>>(req);
    const result = await followUpsService.listFollowUps(actorFrom(req), query);
    res.json(result);
  }),
);

/**
 * Bucket counts for the inbox's tab strip, under the same filters as the list.
 * Declared before `/:id` so `counts` is not read as an id.
 */
followUpsRouter.get(
  '/counts',
  validate(followUpQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<z.infer<typeof followUpQuerySchema>>(req);
    res.json({ counts: await followUpsService.countFollowUps(actorFrom(req), query) });
  }),
);

/** Rescheduling is the one field the inbox changes on its own, so it gets its
 *  own verb rather than making the caller assemble a PATCH body. */
followUpsRouter.post(
  '/:id/reschedule',
  validate(followUpParams, 'params'),
  validate(rescheduleFollowUpSchema),
  asyncHandler(async (req, res) => {
    const { dueAt } = req.body as z.infer<typeof rescheduleFollowUpSchema>;
    const followUp = await followUpsService.rescheduleFollowUp(
      actorFrom(req),
      param(req, 'id'),
      dueAt,
    );
    res.json({ followUp });
  }),
);

followUpsRouter.patch(
  '/:id',
  validate(followUpParams, 'params'),
  validate(updateFollowUpSchema),
  asyncHandler(async (req, res) => {
    const followUp = await followUpsService.updateFollowUp(
      actorFrom(req),
      param(req, 'id'),
      req.body,
    );
    res.json({ followUp });
  }),
);

followUpsRouter.post(
  '/:id/complete',
  validate(followUpParams, 'params'),
  validate(completeFollowUpSchema),
  asyncHandler(async (req, res) => {
    const followUp = await followUpsService.completeFollowUp(
      actorFrom(req),
      param(req, 'id'),
      req.body,
    );
    res.json({ followUp });
  }),
);

followUpsRouter.post(
  '/:id/cancel',
  validate(followUpParams, 'params'),
  asyncHandler(async (req, res) => {
    const followUp = await followUpsService.cancelFollowUp(actorFrom(req), param(req, 'id'));
    res.json({ followUp });
  }),
);

followUpsRouter.delete(
  '/:id',
  validate(followUpParams, 'params'),
  asyncHandler(async (req, res) => {
    await followUpsService.deleteFollowUp(actorFrom(req), param(req, 'id'));
    res.status(204).end();
  }),
);
