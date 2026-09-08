import { randomBytes } from 'node:crypto';
import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../logger.js';

/**
 * Per-visitor demo sandboxes.
 *
 * The seeded workspace is a *template* that nobody can sign into. Starting a
 * demo clones it — organisation, users, stages, leads, activities and
 * follow-ups — into a throwaway organisation with fresh ids, and signs the
 * visitor into that copy. Because every tenant-owned row already carries
 * `organizationId` and every query is scoped by it, the existing multi-tenancy
 * is what keeps one visitor's edits invisible to the next.
 *
 * Two details make the clone worth doing in SQL rather than in application code:
 *
 *  - It is a handful of set-based INSERT…SELECT statements rather than ~530
 *    round trips to Frankfurt, so a visitor waits a few hundred milliseconds.
 *  - Raw SQL bypasses Prisma's `@updatedAt`, so the copy keeps the template's
 *    timestamps. Going through the client would stamp every row with "now" and
 *    flatten the carefully aged demo timeline.
 *
 * Ids are derived, not mapped: `'d' || substr(md5(<old id> || <token>), 1, 24)`
 * is stable within one clone, so a child row can compute its parent's new id
 * without a lookup table. In Postgres `NULL || x` is NULL, so a nullable foreign
 * key (an unassigned lead) carries through as NULL for free.
 */

/** How long a sandbox survives before the reaper removes it. */
const SANDBOX_TTL_HOURS = 24;

export interface DemoSandbox {
  organizationId: string;
  ownerUserId: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

/**
 * Clones the demo template into a fresh organisation.
 * @returns the new organisation and the id of its owner account.
 */
export async function createDemoSandbox(): Promise<DemoSandbox> {
  const template = await prisma.organization.findFirst({
    where: { isDemoTemplate: true },
    select: { id: true, name: true },
  });

  if (!template) {
    throw new AppError(
      503,
      'DEMO_UNAVAILABLE',
      'The demo workspace is not available right now. Please try again shortly.',
    );
  }

  // `token` salts the derived ids; `handle` keeps cloned emails and the slug unique.
  const token = randomBytes(16).toString('hex');
  const handle = randomBytes(5).toString('hex');
  const organizationId = `demo${randomBytes(10).toString('hex')}`;
  const slug = `${slugify(template.name)}-demo-${handle}`;
  const expiresAt = new Date(Date.now() + SANDBOX_TTL_HOURS * 60 * 60 * 1000);

  const startedAt = Date.now();

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "organizations"
          (id, name, slug, "defaultCurrency", "defaultLocale", "aiEnabled", "isDemo", "isDemoTemplate", "expiresAt", "createdAt", "updatedAt")
        SELECT ${organizationId}, o.name, ${slug}, o."defaultCurrency", o."defaultLocale",
               true, true, false, ${expiresAt}, now(), now()
        FROM "organizations" o
        WHERE o.id = ${template.id}
      `;

      /*
       * `aiEnabled` is forced on rather than inherited from the template.
       *
       * A sandbox exists to show what the product does, and a visitor who has
       * to find a settings page before the headline feature will do anything
       * has been shown the opt-in instead of the feature. It is safe here in a
       * way it is not for a real workspace: the data is synthetic, the whole
       * organisation is destroyed within the day, and demo sandboxes are held
       * to a much smaller analysis budget than a real workspace (see
       * `AI_DEMO_DAILY_LIMIT`) so one shared free-tier key spreads across many
       * visitors rather than being spent by a handful.
       *
       * It also means the demo needs no manual database step in an environment
       * where the template row predates the column.
       */

      /*
       * Roles come before users, because a user cannot exist without one.
       *
       * Cloned rather than re-seeded so a sandbox mirrors whatever the template
       * workspace looks like — including any role the template has been given —
       * and so `roleId` can be derived with the same deterministic hash the
       * other clones use, without a second round trip to read the new ids back.
       */
      await tx.$executeRaw`
        INSERT INTO "roles"
          (id, "organizationId", "key", name, "nameAr", permissions, "isSystem", "order", "createdAt", "updatedAt")
        SELECT 'd' || substr(md5(r.id || ${token}), 1, 24),
               ${organizationId}, r."key", r.name, r."nameAr", r.permissions,
               r."isSystem", r."order", r."createdAt", r."updatedAt"
        FROM "roles" r
        WHERE r."organizationId" = ${template.id}
      `;

      // Emails are globally unique, so each clone gets a plus-addressed variant.
      await tx.$executeRaw`
        INSERT INTO "users"
          (id, "organizationId", email, "passwordHash", name, "roleId", "isOwner", locale, "avatarColor", "isActive", "lastLoginAt", "createdAt", "updatedAt")
        SELECT 'd' || substr(md5(u.id || ${token}), 1, 24),
               ${organizationId},
               split_part(u.email, '@', 1) || '+' || ${handle} || '@' || split_part(u.email, '@', 2),
               u."passwordHash", u.name,
               'd' || substr(md5(u."roleId" || ${token}), 1, 24),
               u."isOwner", u.locale, u."avatarColor",
               true, u."lastLoginAt", u."createdAt", u."updatedAt"
        FROM "users" u
        WHERE u."organizationId" = ${template.id}
      `;

      await tx.$executeRaw`
        INSERT INTO "pipeline_stages"
          (id, "organizationId", "key", name, "nameAr", color, "order", type, "winProbability",
           "createdAt", "updatedAt")
        SELECT 'd' || substr(md5(s.id || ${token}), 1, 24),
               ${organizationId}, s."key", s.name, s."nameAr", s.color, s."order", s.type,
               s."winProbability", s."createdAt", s."updatedAt"
        FROM "pipeline_stages" s
        WHERE s."organizationId" = ${template.id}
      `;

      await tx.$executeRaw`
        INSERT INTO "leads"
          (id, "organizationId", "customerName", company, email, phone, source, "requestedService",
           "estimatedValue", currency, priority, description, tags, "stageId", "assignedToId",
           "createdById", "boardPosition", "nextFollowUpAt", "lastActivityAt", "lastContactedAt",
           "lostReason", "wonAt", "lostAt", "archivedAt", "archivedById", "createdAt", "updatedAt")
        SELECT 'd' || substr(md5(l.id || ${token}), 1, 24),
               ${organizationId}, l."customerName", l.company, l.email, l.phone, l.source,
               l."requestedService", l."estimatedValue", l.currency, l.priority, l.description, l.tags,
               'd' || substr(md5(l."stageId" || ${token}), 1, 24),
               'd' || substr(md5(l."assignedToId" || ${token}), 1, 24),
               'd' || substr(md5(l."createdById" || ${token}), 1, 24),
               l."boardPosition", l."nextFollowUpAt", l."lastActivityAt", l."lastContactedAt",
               l."lostReason", l."wonAt", l."lostAt", l."archivedAt",
               'd' || substr(md5(l."archivedById" || ${token}), 1, 24),
               l."createdAt", l."updatedAt"
        FROM "leads" l
        WHERE l."organizationId" = ${template.id}
      `;

      await tx.$executeRaw`
        INSERT INTO "activities"
          (id, "organizationId", "leadId", "userId", type, body, metadata, "occurredAt", "createdAt", "updatedAt")
        SELECT 'd' || substr(md5(a.id || ${token}), 1, 24),
               ${organizationId},
               'd' || substr(md5(a."leadId" || ${token}), 1, 24),
               'd' || substr(md5(a."userId" || ${token}), 1, 24),
               a.type, a.body, a.metadata, a."occurredAt", a."createdAt", a."updatedAt"
        FROM "activities" a
        WHERE a."organizationId" = ${template.id}
      `;

      await tx.$executeRaw`
        INSERT INTO "follow_ups"
          (id, "organizationId", "leadId", "assignedToId", "createdById", title, notes, "dueAt",
           channel, status, "completedAt", "createdAt", "updatedAt")
        SELECT 'd' || substr(md5(f.id || ${token}), 1, 24),
               ${organizationId},
               'd' || substr(md5(f."leadId" || ${token}), 1, 24),
               'd' || substr(md5(f."assignedToId" || ${token}), 1, 24),
               'd' || substr(md5(f."createdById" || ${token}), 1, 24),
               f.title, f.notes, f."dueAt", f.channel, f.status, f."completedAt",
               f."createdAt", f."updatedAt"
        FROM "follow_ups" f
        WHERE f."organizationId" = ${template.id}
      `;
    },
    { timeout: 20_000 },
  );

  const owner = await prisma.user.findFirst({
    where: { organizationId, isOwner: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  if (!owner) {
    // The template has no owner, which would leave the visitor with no way in.
    await prisma.organization.delete({ where: { id: organizationId } });
    throw new AppError(503, 'DEMO_UNAVAILABLE', 'The demo workspace is misconfigured.');
  }

  logger.info({ organizationId, durationMs: Date.now() - startedAt }, 'demo sandbox created');

  return { organizationId, ownerUserId: owner.id };
}

/**
 * Removes sandboxes past their expiry. Cascades take their leads, activities,
 * follow-ups and sessions with them.
 *
 * Called by the daily cron and opportunistically whenever a demo starts, so the
 * table cannot grow unbounded between scheduled runs.
 */
export async function reapExpiredSandboxes(): Promise<number> {
  const { count } = await prisma.organization.deleteMany({
    where: { isDemo: true, isDemoTemplate: false, expiresAt: { lt: new Date() } },
  });
  if (count > 0) logger.info({ count }, 'expired demo sandboxes removed');
  return count;
}
