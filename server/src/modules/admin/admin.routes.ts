import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { asyncHandler } from '../../middleware/auth.js';
import { unauthorized } from '../../lib/errors.js';
import { env } from '../../env.js';
import { reapExpiredSandboxes } from '../auth/demo.service.js';
import { purgeExpiredTrash } from '../follow-ups/follow-ups.service.js';

export const adminRouter = Router();

/** Constant-time comparison, so the secret cannot be recovered by timing. */
function isAuthorised(header: string | undefined): boolean {
  if (!env.CRON_SECRET) return false;
  const provided = header?.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(provided);
  const b = Buffer.from(env.CRON_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The daily housekeeping run: expired demo sandboxes, and follow-ups that have
 * sat in the trash past their retention.
 *
 * One scheduled job rather than two, because a second cron is a second thing to
 * misconfigure and forget. Invoked by Vercel Cron, which sends
 * `Authorization: Bearer $CRON_SECRET`. An unset secret closes the endpoint
 * rather than opening it, so a misconfigured deploy fails safe.
 */
const handler = asyncHandler(async (req, res) => {
  if (!isAuthorised(req.headers.authorization)) throw unauthorized();
  const [removed, purged] = await Promise.all([reapExpiredSandboxes(), purgeExpiredTrash()]);
  res.json({ removed, purgedFollowUps: purged, at: new Date().toISOString() });
});

adminRouter.get('/reap-demo-sandboxes', handler);
adminRouter.post('/reap-demo-sandboxes', handler);
