import type { Prisma, StageKey } from '@prisma/client';
import type { LeadFilterInput } from '@leadpilot/shared';
import { UNASSIGNED } from '@leadpilot/shared';

/**
 * The one place a lead list is narrowed.
 *
 * The table, the board and the dashboard all filter the same records the same
 * way, so they all call this. Keeping it in a module of its own — rather than
 * private to the leads service — means the board can reuse it without pulling
 * in the whole service, and there is still exactly *one* line applying
 * `organizationId` to audit for cross-tenant leakage.
 */

export const startOfToday = (): Date => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

export const endOfToday = (): Date => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};

export function buildLeadWhere(
  organizationId: string,
  query: LeadFilterInput,
): Prisma.LeadWhereInput {
  // Archived leads are excluded here and nowhere else, so there is a single line
  // to audit — and `?archived=true` is the only way to see them.
  const where: Prisma.LeadWhereInput = {
    organizationId,
    archivedAt: query.archived ? { not: null } : null,
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

  switch (query.followUp) {
    case 'overdue':
      and.push({ nextFollowUpAt: { lt: startOfToday() } });
      break;
    case 'today':
      and.push({ nextFollowUpAt: { gte: startOfToday(), lte: endOfToday() } });
      break;
    case 'week': {
      const weekEnd = new Date(endOfToday());
      weekEnd.setDate(weekEnd.getDate() + 7);
      and.push({ nextFollowUpAt: { gte: startOfToday(), lte: weekEnd } });
      break;
    }
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
