import type { Prisma, StageKey } from '@prisma/client';
import type {
  AssignLeadInput,
  CreateLeadInput,
  LeadDetailDto,
  LeadListItemDto,
  LeadQueryInput,
  LeadStatsDto,
  MoveLeadStageInput,
  Paginated,
  UpdateLeadInput,
} from '@leadpilot/shared';
import { MANAGER_ROLES, STAGE_KEYS, UNASSIGNED } from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { paginate, toPrismaPagination } from '../../lib/pagination.js';
import {
  LEAD_DETAIL_SELECT,
  LEAD_LIST_SELECT,
  toLeadDetailDto,
  toLeadListItemDto,
} from '../../lib/serializers.js';
import { recordActivity, syncNextFollowUp } from '../../lib/activity-log.js';

/** Identifies the caller. Every function here takes one — there is no unscoped path. */
export interface Actor {
  userId: string;
  organizationId: string;
  role: string;
}

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfToday = () => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};

/**
 * Builds the Prisma `where` for a filtered list.
 *
 * `organizationId` is applied here and nowhere else in this module, so there is
 * exactly one line to audit for cross-tenant leakage.
 */
function buildLeadWhere(organizationId: string, query: LeadQueryInput): Prisma.LeadWhereInput {
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

function buildLeadOrderBy(query: LeadQueryInput): Prisma.LeadOrderByWithRelationInput[] {
  const dir = query.sortDir;

  switch (query.sortBy) {
    case 'stage':
      return [{ stage: { order: dir } }, { updatedAt: 'desc' }];
    case 'nextFollowUpAt':
      // Leads with no follow-up scheduled always sink to the bottom, whichever
      // direction the user sorts — an empty cell is never "the most urgent".
      return [{ nextFollowUpAt: { sort: dir, nulls: 'last' } }, { updatedAt: 'desc' }];
    case 'lastActivityAt':
      return [{ lastActivityAt: { sort: dir, nulls: 'last' } }, { updatedAt: 'desc' }];
    case 'company':
      return [{ company: { sort: dir, nulls: 'last' } }, { customerName: 'asc' }];
    case 'customerName':
      return [{ customerName: dir }];
    case 'estimatedValue':
      return [{ estimatedValue: dir }, { updatedAt: 'desc' }];
    case 'priority':
      return [{ priority: dir }, { updatedAt: 'desc' }];
    case 'createdAt':
      return [{ createdAt: dir }];
    case 'updatedAt':
    default:
      return [{ updatedAt: dir }];
  }
}

export async function listLeads(
  actor: Actor,
  query: LeadQueryInput,
): Promise<Paginated<LeadListItemDto>> {
  const where = buildLeadWhere(actor.organizationId, query);
  const { skip, take } = toPrismaPagination(query);

  const [rows, total] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      select: LEAD_LIST_SELECT,
      orderBy: buildLeadOrderBy(query),
      skip,
      take,
    }),
    prisma.lead.count({ where }),
  ]);

  return paginate(rows.map(toLeadListItemDto), query, total);
}

/**
 * Aggregates over the *filtered* set so the summary cards above the table always
 * describe what the user is actually looking at.
 */
export async function getLeadStats(actor: Actor, query: LeadQueryInput): Promise<LeadStatsDto> {
  const where = buildLeadWhere(actor.organizationId, query);

  const [stageGroups, stages, overdueFollowUps] = await Promise.all([
    prisma.lead.groupBy({
      by: ['stageId'],
      where,
      _count: { _all: true },
      _sum: { estimatedValue: true },
    }),
    prisma.pipelineStage.findMany({
      where: { organizationId: actor.organizationId },
      select: { id: true, key: true, type: true, order: true },
      orderBy: { order: 'asc' },
    }),
    prisma.followUp.count({
      where: {
        organizationId: actor.organizationId,
        status: 'PENDING',
        dueAt: { lt: startOfToday() },
      },
    }),
  ]);

  const byStageId = new Map(stageGroups.map((group) => [group.stageId, group]));

  const byStage = stages.map((stage) => {
    const group = byStageId.get(stage.id);
    return {
      key: stage.key,
      count: group?._count._all ?? 0,
      value: group?._sum.estimatedValue?.toNumber() ?? 0,
    };
  });

  const totals = stages.reduce(
    (acc, stage) => {
      const group = byStageId.get(stage.id);
      const count = group?._count._all ?? 0;
      const value = group?._sum.estimatedValue?.toNumber() ?? 0;
      acc.totalLeads += count;
      if (stage.type === 'OPEN') {
        acc.openLeads += count;
        acc.totalPipelineValue += value;
      } else if (stage.type === 'WON') {
        acc.wonLeads += count;
        acc.wonValue += value;
      } else {
        acc.lostLeads += count;
      }
      return acc;
    },
    { totalLeads: 0, openLeads: 0, wonLeads: 0, lostLeads: 0, totalPipelineValue: 0, wonValue: 0 },
  );

  return {
    ...totals,
    overdueFollowUps,
    byStage: byStage.filter((entry) => STAGE_KEYS.includes(entry.key)),
  };
}

export async function getLeadById(
  actor: Actor,
  leadId: string,
  options: { includeArchived?: boolean } = {},
): Promise<LeadDetailDto> {
  // The organizationId in the filter is what makes another tenant's id a 404
  // rather than a leak.
  const lead = await prisma.lead.findFirst({
    where: {
      id: leadId,
      organizationId: actor.organizationId,
      ...(options.includeArchived ? {} : { archivedAt: null }),
    },
    select: LEAD_DETAIL_SELECT,
  });
  if (!lead) throw notFound('Lead');

  const [activities, followUps, openFollowUps] = await Promise.all([
    prisma.activity.count({ where: { leadId } }),
    prisma.followUp.count({ where: { leadId } }),
    prisma.followUp.count({ where: { leadId, status: 'PENDING' } }),
  ]);

  return toLeadDetailDto(lead, { activities, followUps, openFollowUps });
}

/** Resolves a stage key to this organisation's stage row. */
async function resolveStage(organizationId: string, key: StageKey) {
  const stage = await prisma.pipelineStage.findUnique({
    where: { organizationId_key: { organizationId, key } },
    select: { id: true, key: true, name: true, type: true },
  });
  if (!stage) throw badRequest(`Pipeline stage "${key}" is not configured for this workspace`);
  return stage;
}

/**
 * Write authorisation for a single lead.
 *
 * Owners and admins may change any lead in the workspace. A member may only
 * change leads they own — the ones assigned to them or that they created.
 * Reads are deliberately unrestricted within the organisation: a shared
 * pipeline is the point of the product.
 */
function assertCanMutateLead(
  actor: Actor,
  lead: { assignedToId: string | null; createdById?: string | null },
): void {
  if (actor.role === 'OWNER' || actor.role === 'ADMIN') return;
  const owns = lead.assignedToId === actor.userId || lead.createdById === actor.userId;
  if (!owns) {
    throw forbidden('You can only edit leads assigned to you');
  }
}

/** Confirms an assignee is a real, active member of the caller's organisation. */
async function assertAssigneeInOrg(organizationId: string, userId: string): Promise<void> {
  const member = await prisma.user.findFirst({
    where: { id: userId, organizationId, isActive: true },
    select: { id: true },
  });
  if (!member) throw badRequest('That team member is not part of this workspace');
}

export async function createLead(actor: Actor, input: CreateLeadInput): Promise<LeadDetailDto> {
  const stage = await resolveStage(actor.organizationId, input.stageKey);
  if (input.assignedToId) await assertAssigneeInOrg(actor.organizationId, input.assignedToId);

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: actor.organizationId },
    select: { defaultCurrency: true },
  });

  const lead = await prisma.$transaction(async (tx) => {
    const maxPosition = await tx.lead.aggregate({
      where: { organizationId: actor.organizationId, stageId: stage.id },
      _max: { boardPosition: true },
    });

    const created = await tx.lead.create({
      data: {
        organizationId: actor.organizationId,
        customerName: input.customerName,
        company: input.company ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        source: input.source,
        requestedService: input.requestedService,
        estimatedValue: input.estimatedValue,
        // Always the workspace currency; see the note in createLeadSchema.
        currency: organization.defaultCurrency,
        priority: input.priority,
        description: input.description ?? null,
        tags: (input.tags ?? []).map((tag) => tag.toLowerCase()),
        stageId: stage.id,
        assignedToId: input.assignedToId ?? null,
        createdById: actor.userId,
        boardPosition: (maxPosition._max.boardPosition ?? -1) + 1,
        nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null,
        ...(stage.type === 'WON' && { wonAt: new Date() }),
        ...(stage.type === 'LOST' && { lostAt: new Date() }),
      },
      select: { id: true },
    });

    await recordActivity(tx, {
      organizationId: actor.organizationId,
      leadId: created.id,
      userId: actor.userId,
      type: 'LEAD_CREATED',
      metadata: { toStage: stage.key },
    });

    return created;
  });

  return getLeadById(actor, lead.id);
}

/** Fields whose changes are worth an audit entry on the timeline. */
const AUDITED_FIELDS = [
  'customerName',
  'company',
  'email',
  'phone',
  'requestedService',
  'estimatedValue',
  'priority',
  'source',
] as const;

export async function updateLead(
  actor: Actor,
  leadId: string,
  input: UpdateLeadInput,
): Promise<LeadDetailDto> {
  const existing = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId, archivedAt: null },
    select: {
      id: true,
      customerName: true,
      company: true,
      email: true,
      phone: true,
      requestedService: true,
      estimatedValue: true,
      priority: true,
      source: true,
      assignedToId: true,
      createdById: true,
      stageId: true,
      stage: { select: { key: true, type: true } },
      assignedTo: { select: { name: true } },
    },
  });
  if (!existing) throw notFound('Lead');
  assertCanMutateLead(actor, existing);

  if (input.assignedToId) await assertAssigneeInOrg(actor.organizationId, input.assignedToId);

  const stage =
    input.stageKey && input.stageKey !== existing.stage.key
      ? await resolveStage(actor.organizationId, input.stageKey)
      : null;

  const data: Prisma.LeadUpdateInput = {};
  if (input.customerName !== undefined) data.customerName = input.customerName;
  if (input.company !== undefined) data.company = input.company ?? null;
  if (input.email !== undefined) data.email = input.email ?? null;
  if (input.phone !== undefined) data.phone = input.phone ?? null;
  if (input.source !== undefined) data.source = input.source;
  if (input.requestedService !== undefined) data.requestedService = input.requestedService;
  if (input.estimatedValue !== undefined) data.estimatedValue = input.estimatedValue;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.description !== undefined) data.description = input.description ?? null;
  if (input.tags !== undefined) data.tags = input.tags.map((tag) => tag.toLowerCase());
  if (input.nextFollowUpAt !== undefined) {
    data.nextFollowUpAt = input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null;
  }
  if (input.assignedToId !== undefined) {
    data.assignedTo = input.assignedToId
      ? { connect: { id: input.assignedToId } }
      : { disconnect: true };
  }
  if (stage) {
    data.stage = { connect: { id: stage.id } };
    data.wonAt = stage.type === 'WON' ? new Date() : null;
    data.lostAt = stage.type === 'LOST' ? new Date() : null;
    data.lostReason = stage.type === 'LOST' ? (input.lostReason ?? null) : null;
  } else if (input.lostReason !== undefined) {
    data.lostReason = input.lostReason ?? null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: leadId }, data, select: { id: true } });

    for (const field of AUDITED_FIELDS) {
      const next = input[field];
      if (next === undefined) continue;
      const before = existing[field];
      const beforeText = before === null || before === undefined ? null : String(before);
      const afterText = next === null ? null : String(next);
      if (beforeText === afterText) continue;

      await recordActivity(tx, {
        organizationId: actor.organizationId,
        leadId,
        userId: actor.userId,
        type: 'FIELD_UPDATED',
        metadata: { field, from: beforeText, to: afterText },
      });
    }

    if (input.assignedToId !== undefined && input.assignedToId !== existing.assignedToId) {
      const nextAssignee = input.assignedToId
        ? await tx.user.findUnique({
            where: { id: input.assignedToId },
            select: { name: true },
          })
        : null;
      await recordActivity(tx, {
        organizationId: actor.organizationId,
        leadId,
        userId: actor.userId,
        type: 'ASSIGNED',
        metadata: {
          fromAssignee: existing.assignedTo?.name ?? null,
          toAssignee: nextAssignee?.name ?? null,
        },
      });
    }

    if (stage) {
      await recordActivity(tx, {
        organizationId: actor.organizationId,
        leadId,
        userId: actor.userId,
        type: 'STAGE_CHANGED',
        metadata: { fromStage: existing.stage.key, toStage: stage.key },
      });
    }
  });

  return getLeadById(actor, leadId);
}

export async function moveLeadStage(
  actor: Actor,
  leadId: string,
  input: MoveLeadStageInput,
): Promise<LeadDetailDto> {
  return updateLead(actor, leadId, {
    stageKey: input.stageKey,
    ...(input.lostReason !== undefined && { lostReason: input.lostReason }),
  });
}

export async function assignLead(
  actor: Actor,
  leadId: string,
  input: AssignLeadInput,
): Promise<LeadDetailDto> {
  return updateLead(actor, leadId, { assignedToId: input.assignedToId });
}

/**
 * Archives a lead: it disappears from every list and aggregate, but its activity
 * trail and follow-ups survive. Replaces the previous hard delete, which cascaded
 * the whole history away with no undo.
 *
 * Restricted to owners and admins. Editing a lead you created is recoverable;
 * removing it from the team's pipeline is not the same kind of act.
 */
export async function archiveLead(actor: Actor, leadId: string): Promise<void> {
  if (!MANAGER_ROLES.includes(actor.role as (typeof MANAGER_ROLES)[number])) {
    throw forbidden('Only an owner or admin can archive a lead');
  }

  const existing = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId, archivedAt: null },
    select: { id: true },
  });
  if (!existing) throw notFound('Lead');

  await prisma.lead.update({
    where: { id: leadId },
    data: { archivedAt: new Date(), archivedById: actor.userId },
    select: { id: true },
  });
}

/** Puts an archived lead back into the active pipeline. */
export async function restoreLead(actor: Actor, leadId: string): Promise<LeadDetailDto> {
  if (!MANAGER_ROLES.includes(actor.role as (typeof MANAGER_ROLES)[number])) {
    throw forbidden('Only an owner or admin can restore a lead');
  }

  const existing = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId, archivedAt: { not: null } },
    select: { id: true },
  });
  if (!existing) throw notFound('Archived lead');

  await prisma.lead.update({
    where: { id: leadId },
    data: { archivedAt: null, archivedById: null },
    select: { id: true },
  });

  return getLeadById(actor, leadId);
}

export { syncNextFollowUp };
