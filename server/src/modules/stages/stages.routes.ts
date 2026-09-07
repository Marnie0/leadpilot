import { Router } from 'express';
import { prisma } from '../../db.js';
import { asyncHandler, getAuth, requireAuth } from '../../middleware/auth.js';
import { STAGE_SELECT, toStageDto } from '../../lib/serializers.js';

export const stagesRouter = Router();
stagesRouter.use(requireAuth);

/**
 * The organisation's pipeline stages, in board order. The client caches this
 * for the session — stage rows change rarely, but they drive the colours and
 * labels on every lead badge and (in Phase 2) every board column.
 */
stagesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { organizationId } = getAuth(req);
    const stages = await prisma.pipelineStage.findMany({
      where: { organizationId },
      select: STAGE_SELECT,
      orderBy: { order: 'asc' },
    });
    res.json({ stages: stages.map(toStageDto) });
  }),
);
