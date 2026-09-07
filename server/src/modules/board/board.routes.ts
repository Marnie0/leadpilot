import { Router } from 'express';
import { z } from 'zod';
import { boardColumnQuerySchema, boardQuerySchema, STAGE_KEYS } from '@leadpilot/shared';
import { asyncHandler, getAuth, requireAuth } from '../../middleware/auth.js';
import { param, validate, validatedQuery } from '../../middleware/validate.js';
import type { Actor } from '../leads/leads.service.js';
import * as boardService from './board.service.js';

export const boardRouter = Router();

const actorFrom = (req: Parameters<typeof getAuth>[0]): Actor => {
  const auth = getAuth(req);
  return { userId: auth.userId, organizationId: auth.organizationId, role: auth.role };
};

boardRouter.use(requireAuth);

boardRouter.get(
  '/',
  validate(boardQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<z.infer<typeof boardQuerySchema>>(req);
    res.json(await boardService.getBoard(actorFrom(req), query));
  }),
);

/**
 * The next page of a single column, behind its "Load more" button.
 *
 * Nested under `/columns` rather than sitting at `/board/:stageKey` so the path
 * can never be ambiguous with a future sibling route — `/board/leads` reading
 * as a stage key is the kind of collision that only shows up in production.
 */
boardRouter.get(
  '/columns/:stageKey',
  validate(z.object({ stageKey: z.enum(STAGE_KEYS) }), 'params'),
  validate(boardColumnQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<z.infer<typeof boardColumnQuerySchema>>(req);
    const stageKey = param(req, 'stageKey') as (typeof STAGE_KEYS)[number];
    const column = await boardService.getBoardColumn(actorFrom(req), stageKey, query);
    res.json({ column });
  }),
);
