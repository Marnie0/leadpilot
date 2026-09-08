import { Router } from 'express';
import { z } from 'zod';
import {
  generateInsightSchema,
  generateWorkspaceSummarySchema,
  idSchema,
  updateAiSettingsSchema,
} from '@leadpilot/shared';
import { asyncHandler, getAuth, requireAuth } from '../../middleware/auth.js';
import { param, validate } from '../../middleware/validate.js';
import type { Actor } from '../leads/leads.service.js';
import * as aiService from './ai.service.js';
import * as workspaceService from './ai.workspace.service.js';

const actorFrom = (req: Parameters<typeof getAuth>[0]): Actor => {
  const auth = getAuth(req);
  return {
    userId: auth.userId,
    organizationId: auth.organizationId,
    permissions: auth.permissions,
    isOwner: auth.isOwner,
  };
};

/** Mounted at /api/leads/:leadId/insight. */
export const leadInsightRouter = Router({ mergeParams: true });
leadInsightRouter.use(requireAuth);

const leadParams = z.object({ leadId: idSchema });

leadInsightRouter.get(
  '/',
  validate(leadParams, 'params'),
  asyncHandler(async (req, res) => {
    res.json(await aiService.getInsight(actorFrom(req), param(req, 'leadId')));
  }),
);

/*
 * POST, not PUT: this spends a third-party call and produces a new assessment
 * each time. It is not idempotent and should not look as though it is.
 */
leadInsightRouter.post(
  '/',
  validate(leadParams, 'params'),
  validate(generateInsightSchema),
  asyncHandler(async (req, res) => {
    const result = await aiService.generateInsight(actorFrom(req), param(req, 'leadId'), req.body);
    res.status(201).json(result);
  }),
);

leadInsightRouter.delete(
  '/',
  validate(leadParams, 'params'),
  asyncHandler(async (req, res) => {
    await aiService.deleteInsight(actorFrom(req), param(req, 'leadId'));
    res.status(204).end();
  }),
);

/** Mounted at /api/ai — the workspace-level switch and its budget. */
export const aiRouter = Router();
aiRouter.use(requireAuth);

aiRouter.get(
  '/settings',
  asyncHandler(async (req, res) => {
    res.json({ settings: await aiService.getSettings(actorFrom(req)) });
  }),
);

/*
 * The whole-workspace briefing.
 *
 * Mounted here rather than under /dashboard because it is an assistant feature
 * first: it shares the opt-in, the key and the budget with the per-lead
 * analysis, and grouping them means "everything the AI does" is one directory
 * and one set of guards rather than two that have to be kept in step.
 */
aiRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const tz = typeof req.query.tz === 'string' ? req.query.tz : undefined;
    res.json(await workspaceService.getSummary(actorFrom(req), tz));
  }),
);

aiRouter.post(
  '/summary',
  validate(generateWorkspaceSummarySchema),
  asyncHandler(async (req, res) => {
    const tz = typeof req.query.tz === 'string' ? req.query.tz : undefined;
    res.status(201).json(await workspaceService.generateSummary(actorFrom(req), req.body, tz));
  }),
);

aiRouter.delete(
  '/summary',
  asyncHandler(async (req, res) => {
    await workspaceService.deleteSummary(actorFrom(req));
    res.status(204).end();
  }),
);

aiRouter.patch(
  '/settings',
  validate(updateAiSettingsSchema),
  asyncHandler(async (req, res) => {
    res.json({ settings: await aiService.updateSettings(actorFrom(req), req.body) });
  }),
);
