import { Router } from 'express';
import { prisma } from './db.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { leadsRouter } from './modules/leads/leads.routes.js';
import { activitiesRouter, leadActivitiesRouter } from './modules/activities/activities.routes.js';
import { followUpsRouter, leadFollowUpsRouter } from './modules/follow-ups/follow-ups.routes.js';
import { teamRouter } from './modules/team/team.routes.js';
import { stagesRouter } from './modules/stages/stages.routes.js';
import { boardRouter } from './modules/board/board.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
import { fxRouter } from './modules/fx/fx.routes.js';
import { aiRouter, leadInsightRouter } from './modules/ai/ai.routes.js';
import {
  invitationsRouter,
  publicInvitesRouter,
} from './modules/invitations/invitations.routes.js';
import { asyncHandler } from './middleware/auth.js';

export const apiRouter = Router();

/** Liveness plus a real database round-trip, for uptime checks and cold-start warming. */
apiRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const startedAt = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'connected',
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  }),
);

apiRouter.use('/auth', authRouter);
apiRouter.use('/internal', adminRouter);
apiRouter.use('/stages', stagesRouter);
// Declared before the bare /team router so /team/invitations is not read as an id.
apiRouter.use('/team/invitations', invitationsRouter);
apiRouter.use('/team', teamRouter);
apiRouter.use('/invites', publicInvitesRouter);
apiRouter.use('/board', boardRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/fx', fxRouter);
apiRouter.use('/ai', aiRouter);

// Nested resources are declared before the bare /leads router so that
// /leads/:leadId/activities is not swallowed by /leads/:id.
apiRouter.use('/leads/:leadId/activities', leadActivitiesRouter);
apiRouter.use('/leads/:leadId/follow-ups', leadFollowUpsRouter);
apiRouter.use('/leads/:leadId/insight', leadInsightRouter);
apiRouter.use('/leads', leadsRouter);

apiRouter.use('/activities', activitiesRouter);
apiRouter.use('/follow-ups', followUpsRouter);
