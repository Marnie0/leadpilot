import { Router } from 'express';
import { z } from 'zod';
import { generateInsightSchema, idSchema, updateAiSettingsSchema } from '@leadpilot/shared';
import { asyncHandler, getAuth, requireAuth } from '../../middleware/auth.js';
import { param, validate } from '../../middleware/validate.js';
import type { Actor } from '../leads/leads.service.js';
import * as aiService from './ai.service.js';

const actorFrom = (req: Parameters<typeof getAuth>[0]): Actor => {
  const auth = getAuth(req);
  return { userId: auth.userId, organizationId: auth.organizationId, role: auth.role };
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

aiRouter.patch(
  '/settings',
  validate(updateAiSettingsSchema),
  asyncHandler(async (req, res) => {
    res.json({ settings: await aiService.updateSettings(actorFrom(req), req.body) });
  }),
);
