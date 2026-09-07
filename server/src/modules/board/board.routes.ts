import { Router } from 'express';
import { z } from 'zod';
import { boardQuerySchema } from '@leadpilot/shared';
import { asyncHandler, getAuth, requireAuth } from '../../middleware/auth.js';
import { validate, validatedQuery } from '../../middleware/validate.js';
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
