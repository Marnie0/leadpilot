import type { Prisma, StageKey } from '@prisma/client';
import type { LeadFilterInput } from '@leadpilot/shared';
import { UNASSIGNED } from '@leadpilot/shared';
import { dayWindow, normaliseTimeZone } from '../../lib/day-window.js';

/**
 * The one place a lead list is narrowed.
 *
 * The table, the board and the dashboard all filter the same records the same
 * way, so they all call this. Keeping it in a module of its own — rather than
 * private to the leads service — means the board can reuse it without pulling
 * in the whole service, and there is still exactly *one* line applying
 * `organizationId` to audit for cross-tenant leakage.
 */

export function buildLeadWhere(
  organizationId: string,
  query: LeadFilterInput,
): Prisma.LeadWhereInput {
  /*
   * The three views are decided here and nowhere else, so there is a single
   * place to audit what each one can see.
   *
   * Trash is the exclusive one: a deleted lead is absent from the active
   * pipeline *and* from the archive, whichever it was in when it was deleted.
   * That is what keeps `deletedAt` orthogonal to `archivedAt` — deleting an
   * archived lead leaves it archived, so restoring it returns it to the archive
   * rather than dropping it back into everyone's working list.
   */
  const view = query.view ?? 'active';
  const where: Prisma.LeadWhereInput =
    view === 'trash'
      ? { organizationId, deletedAt: { not: null } }
      : {
          organizationId,
          deletedAt: null,
          archivedAt: view === 'archived' ? { not: null } : null,
        };
  const and: Prisma.LeadWhereInput[] = [];

  if (query.q) {
    const term = query.q;
    and.push({
      OR: [
        { customerName: { contains: term, mode: 'insensitive' } },
        { company: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { requestedService: { contains: term, mode: 'insensitive' } },
        { tags: { has: term.toLowerCase() } },
      ],
    });
  }

  if (query.stage?.length) and.push({ stage: { key: { in: query.stage as StageKey[] } } });
  if (query.source?.length) and.push({ source: { in: query.source } });
  if (query.priority?.length) and.push({ priority: { in: query.priority } });
  if (query.tag?.length) and.push({ tags: { hasSome: query.tag } });

  if (query.assignedToId?.length) {
    const includeUnassigned = query.assignedToId.includes(UNASSIGNED);
    const userIds = query.assignedToId.filter((id) => id !== UNASSIGNED);
    const clauses: Prisma.LeadWhereInput[] = [];
    if (userIds.length > 0) clauses.push({ assignedToId: { in: userIds } });
    if (includeUnassigned) clauses.push({ assignedToId: null });
    if (clauses.length > 0) and.push({ OR: clauses });
  }

  if (query.minValue !== undefined || query.maxValue !== undefined) {
    and.push({
      estimatedValue: {
        ...(query.minValue !== undefined && { gte: query.minValue }),
        ...(query.maxValue !== undefined && { lte: query.maxValue }),
      },
    });
  }

  if (query.createdFrom || query.createdTo) {
    and.push({
      createdAt: {
        ...(query.createdFrom && { gte: new Date(query.createdFrom) }),
        ...(query.createdTo && { lte: new Date(query.createdTo) }),
      },
    });
  }

  // Drawn in the reader's day, not the server's, so "overdue today" means the
  // same thing on this screen as it does in the follow-up inbox.
  const { startOfToday, endOfToday, weekEnd } = dayWindow(normaliseTimeZone(query.tz));

  switch (query.followUp) {
    case 'overdue':
      and.push({ nextFollowUpAt: { lt: startOfToday } });
      break;
    case 'today':
      and.push({ nextFollowUpAt: { gte: startOfToday, lte: endOfToday } });
      break;
    case 'week':
      and.push({ nextFollowUpAt: { gte: startOfToday, lte: weekEnd } });
      break;
    case 'none':
      and.push({ nextFollowUpAt: null });
      break;
    case 'any':
    default:
      break;
  }

  if (query.openOnly) and.push({ stage: { type: 'OPEN' } });

  if (and.length > 0) where.AND = and;
  return where;
}
