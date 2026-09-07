import { Router } from 'express';
import { z } from 'zod';
import {
  assignLeadSchema,
  createLeadSchema,
  idSchema,
  leadQuerySchema,
  moveLeadOnBoardSchema,
  moveLeadStageSchema,
  updateLeadSchema,
} from '@leadpilot/shared';
import { asyncHandler, getAuth, requireAuth } from '../../middleware/auth.js';
import { param, validate, validatedQuery } from '../../middleware/validate.js';
import type { Actor } from './leads.service.js';
import * as leadsService from './leads.service.js';
import * as boardService from '../board/board.service.js';

export const leadsRouter = Router();

const leadParams = z.object({ id: idSchema });

const actorFrom = (req: Parameters<typeof getAuth>[0]): Actor => {
  const auth = getAuth(req);
  return { userId: auth.userId, organizationId: auth.organizationId, role: auth.role };
};

leadsRouter.use(requireAuth);

leadsRouter.get(
  '/',
  validate(leadQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<z.infer<typeof leadQuerySchema>>(req);
    const result = await leadsService.listLeads(actorFrom(req), query);
    res.json(result);
  }),
);

/**
 * Summary counters for the current filter set. Kept separate from the list so
 * the client can cache and refetch the two independently.
 */
leadsRouter.get(
  '/stats',
  validate(leadQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<z.infer<typeof leadQuerySchema>>(req);
    const stats = await leadsService.getLeadStats(actorFrom(req), query);
    res.json({ stats });
  }),
);

leadsRouter.post(
  '/',
  validate(createLeadSchema),
  asyncHandler(async (req, res) => {
    const lead = await leadsService.createLead(actorFrom(req), req.body);
    res.status(201).json({ lead });
  }),
);

leadsRouter.get(
  '/:id',
  validate(leadParams, 'params'),
  asyncHandler(async (req, res) => {
    // Archived leads stay openable by id: the list hides them, but the detail
    // view is where the archived banner and the restore action live.
    const lead = await leadsService.getLeadById(actorFrom(req), param(req, 'id'), {
      includeArchived: true,
    });
    res.json({ lead });
  }),
);

leadsRouter.patch(
  '/:id',
  validate(leadParams, 'params'),
  validate(updateLeadSchema),
  asyncHandler(async (req, res) => {
    const lead = await leadsService.updateLead(actorFrom(req), param(req, 'id'), req.body);
    res.json({ lead });
  }),
);

/** Dedicated route so every stage move lands on the activity timeline. */
leadsRouter.post(
  '/:id/stage',
  validate(leadParams, 'params'),
  validate(moveLeadStageSchema),
  asyncHandler(async (req, res) => {
    const lead = await leadsService.moveLeadStage(actorFrom(req), param(req, 'id'), req.body);
    res.json({ lead });
  }),
);

/**
 * Drag-and-drop on the pipeline board.
 *
 * Distinct from `/:id/stage` because it also carries *where in the column* the
 * card landed, and distinct from `PATCH /:id` because a reposition inside one
 * stage is not an edit to the lead's data and must not read as one.
 */
leadsRouter.post(
  '/:id/board-position',
  validate(leadParams, 'params'),
  validate(moveLeadOnBoardSchema),
  asyncHandler(async (req, res) => {
    const lead = await boardService.moveLeadOnBoard(actorFrom(req), param(req, 'id'), req.body);
    res.json({ lead });
  }),
);

leadsRouter.post(
  '/:id/assign',
  validate(leadParams, 'params'),
  validate(assignLeadSchema),
  asyncHandler(async (req, res) => {
    const lead = await leadsService.assignLead(actorFrom(req), param(req, 'id'), req.body);
    res.json({ lead });
  }),
);

/**
 * Archive rather than delete: the lead leaves every list and aggregate but its
 * activity trail survives. Owners and admins only.
 */
leadsRouter.delete(
  '/:id',
  validate(leadParams, 'params'),
  asyncHandler(async (req, res) => {
    await leadsService.archiveLead(actorFrom(req), param(req, 'id'));
    res.status(204).end();
  }),
);

leadsRouter.post(
  '/:id/restore',
  validate(leadParams, 'params'),
  asyncHandler(async (req, res) => {
    const lead = await leadsService.restoreLead(actorFrom(req), param(req, 'id'));
    res.json({ lead });
  }),
);
