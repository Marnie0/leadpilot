import type { Prisma, StageKey, StageType } from '@prisma/client';
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
import { STAGE_KEYS, TRASH_RETENTION_DAYS, confirmationMatches } from '@leadpilot/shared';
import { prisma } from '../../db.js';
import {
  currenciesIn,
  moneyContext,
  totalFrom,
  type GroupedAmount,
} from '../../lib/money-totals.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { paginate, toPrismaPagination } from '../../lib/pagination.js';
import { can, canMutateLead, type Viewer } from '../../lib/permissions.js';
import {
  LEAD_DETAIL_SELECT,
  LEAD_LIST_SELECT,
  toLeadDetailDto,
  toLeadListItemDto,
} from '../../lib/serializers.js';
import { recordActivity, syncNextFollowUp } from '../../lib/activity-log.js';
import { buildLeadWhere } from './lead-filters.js';
import { dayWindow, normaliseTimeZone } from '../../lib/day-window.js';

/** Identifies the caller. Every function here takes one — there is no unscoped path. */
export interface Actor extends Viewer {
  organizationId: string;
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

  return paginate(
    rows.map((row) => toLeadListItemDto(row, actor)),
    query,
    total,
  );
}

/**
 * Aggregates over the *filtered* set so the summary cards above the table always
 * describe what the user is actually looking at.
 */
export async function getLeadStats(actor: Actor, query: LeadQueryInput): Promise<LeadStatsDto> {
  const where = buildLeadWhere(actor.organizationId, query);

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: actor.organizationId },
    select: { defaultCurrency: true },
  });
  const money = await moneyContext(query.display, organization.defaultCurrency);

  const [stageGroups, stages, overdueFollowUps] = await Promise.all([
    // Grouped by currency as well as stage: a workspace may quote in several,
    // and summing across them would be arithmetic between different units.
    prisma.lead.groupBy({
      by: ['stageId', 'currency'],
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
        deletedAt: null,
        lead: { deletedAt: null },
        dueAt: { lt: dayWindow(normaliseTimeZone(query.tz)).startOfToday },
      },
    }),
  ]);

  // One stage now yields one row per currency present in it.
  const rowsByStageId = new Map<string, GroupedAmount[]>();
  const countByStageId = new Map<string, number>();
  for (const group of stageGroups) {
    const rows = rowsByStageId.get(group.stageId) ?? [];
    rows.push({ currency: group.currency, amount: group._sum.estimatedValue?.toNumber() ?? 0 });
    rowsByStageId.set(group.stageId, rows);
    countByStageId.set(group.stageId, (countByStageId.get(group.stageId) ?? 0) + group._count._all);
  }

  const byStage = stages.map((stage) => ({
    key: stage.key,
    count: countByStageId.get(stage.id) ?? 0,
    value: totalFrom(rowsByStageId.get(stage.id) ?? [], money),
  }));

  // Accumulated as grouped rows and totalled once at the end, rather than by
  // adding up already-converted stage figures. Adding converted numbers loses
  // the per-currency detail the breakdown needs, and rounds twice.
  const openRows: GroupedAmount[] = [];
  const wonRows: GroupedAmount[] = [];
  const counts = { totalLeads: 0, openLeads: 0, wonLeads: 0, lostLeads: 0 };

  for (const stage of stages) {
    const count = countByStageId.get(stage.id) ?? 0;
    const rows = rowsByStageId.get(stage.id) ?? [];
    counts.totalLeads += count;
    if (stage.type === 'OPEN') {
      counts.openLeads += count;
      openRows.push(...rows);
    } else if (stage.type === 'WON') {
      counts.wonLeads += count;
      wonRows.push(...rows);
    } else {
      counts.lostLeads += count;
    }
  }

  return {
    ...counts,
    totalPipelineValue: totalFrom(openRows, money),
    wonValue: totalFrom(wonRows, money),
    overdueFollowUps,
    byStage: byStage.filter((entry) => STAGE_KEYS.includes(entry.key)),
    currencies: currenciesIn(stageGroups, money),
  };
}

export async function getLeadById(
  actor: Actor,
  leadId: string,
  options: { includeArchived?: boolean } = {},
): Promise<LeadDetailDto> {
  // The organizationId in the filter is what makes another tenant's id a 404
  // rather than a leak.
  //
  // A *trashed* lead is readable here on purpose, unlike in any list. The trash
  // view links straight to this page, and it is where the banner offering
  // "restore" and "delete permanently" lives — 404ing would leave the trash
  // with nothing to open and no way to act on what is in it. Reads have always
  // been open within the organisation; the actions on that banner are what
  // carry the permission checks.
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

  return toLeadDetailDto(lead, { activities, followUps, openFollowUps }, actor);
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
 * The lead columns a stage transition implies.
 *
 * Shared by the detail view's stage select and the board's drag-and-drop, so a
 * `wonAt` can never be stamped by one path and forgotten by the other — and so
 * moving a lead back out of Won/Lost always clears the closing date rather than
 * leaving a stale one behind.
 */
export function stageTransitionData(
  stage: { type: StageType },
  lostReason?: string | null,
): { wonAt: Date | null; lostAt: Date | null; lostReason: string | null } {
  return {
    wonAt: stage.type === 'WON' ? new Date() : null,
    lostAt: stage.type === 'LOST' ? new Date() : null,
    lostReason: stage.type === 'LOST' ? (lostReason ?? null) : null,
  };
}

/** Throwing form of `canMutateLead`; the rule itself lives in lib/permissions. */
export function assertCanMutateLead(
  actor: Actor,
  lead: { assignedToId: string | null; createdById?: string | null },
): void {
  if (!canMutateLead(actor, lead)) {
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
    // A new enquiry goes to the *top* of its column, not the bottom: it is the
    // freshest thing in the pipeline and the first card anyone should see.
    // Positions are only ever compared, never assumed contiguous, so going
    // negative here is cheaper than renumbering the whole column to insert.
    const minPosition = await tx.lead.aggregate({
      where: { organizationId: actor.organizationId, stageId: stage.id },
      _min: { boardPosition: true },
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
        // The currency the figure was quoted in. Defaults to the workspace's,
        // which is what almost every lead wants and what the form pre-selects.
        currency: input.currency ?? organization.defaultCurrency,
        priority: input.priority,
        description: input.description ?? null,
        tags: (input.tags ?? []).map((tag) => tag.toLowerCase()),
        stageId: stage.id,
        assignedToId: input.assignedToId ?? null,
        createdById: actor.userId,
        boardPosition: (minPosition._min.boardPosition ?? 0) - 1,
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
  'currency',
  'priority',
  'source',
] as const;

export async function updateLead(
  actor: Actor,
  leadId: string,
  input: UpdateLeadInput,
): Promise<LeadDetailDto> {
  const existing = await prisma.lead.findFirst({
    where: {
      id: leadId,
      organizationId: actor.organizationId,
      archivedAt: null,
      deletedAt: null,
    },
    select: {
      id: true,
      customerName: true,
      company: true,
      email: true,
      phone: true,
      requestedService: true,
      estimatedValue: true,
      currency: true,
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
  if (input.currency !== undefined) data.currency = input.currency;
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
    Object.assign(data, stageTransitionData(stage, input.lostReason));
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
        metadata: {
          field,
          from: beforeText,
          to: afterText,
          // A money figure is meaningless without its unit, and the unit can
          // change underneath it — an owner restating AED as EGP leaves every
          // historical "625000" quoted in a currency nobody uses any more.
          // Stamping it here makes the entry true forever, which is the whole
          // job of an audit trail.
          //
          // The currency stamped is the one the *new* figure is in, because
          // that is the figure the timeline renders. When a single PATCH moves
          // both the amount and its currency, using the old one would label the
          // new number with the unit it is no longer quoted in.
          ...(field === 'estimatedValue' && {
            currency: input.currency ?? existing.currency,
          }),
        },
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
  if (!can(actor, 'DELETE_LEADS')) {
    throw forbidden('Your role cannot archive leads');
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
  if (!can(actor, 'DELETE_LEADS')) {
    throw forbidden('Your role cannot restore leads');
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

/* ------------------------------------------------------------------ *
 * Trash
 *
 * A different act from archiving, and kept deliberately separate from it.
 * Archiving files something you mean to keep; deleting says the record should
 * not exist. The two columns are orthogonal, so a lead deleted out of the
 * archive comes back to the archive rather than into everybody's working list.
 * ------------------------------------------------------------------ */

export async function trashLead(actor: Actor, leadId: string): Promise<void> {
  if (!can(actor, 'DELETE_LEADS')) throw forbidden('Your role cannot delete leads');

  const existing = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw notFound('Lead');

  await prisma.lead.update({
    where: { id: leadId },
    // `archivedAt` is deliberately untouched.
    data: { deletedAt: new Date(), deletedById: actor.userId },
    select: { id: true },
  });
}

export async function restoreFromTrash(actor: Actor, leadId: string): Promise<LeadDetailDto> {
  if (!can(actor, 'DELETE_LEADS')) throw forbidden('Your role cannot restore leads');

  const existing = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId, deletedAt: { not: null } },
    select: { id: true },
  });
  if (!existing) throw notFound('Lead');

  await prisma.lead.update({
    where: { id: leadId },
    data: { deletedAt: null, deletedById: null },
    select: { id: true },
  });

  return getLeadById(actor, leadId, { includeArchived: true });
}

/**
 * Destroys a lead, its whole activity trail and its follow-ups.
 *
 * The only genuinely irreversible action in the product, and gated like one:
 * a manager, only from the trash, and only when the customer's name is typed
 * back. Owners and admins together, matching who can archive and delete in the
 * first place — an admin trusted to put a lead in the trash is trusted to
 * finish the job, and the typed name is what carries the weight here rather
 * than a narrower role.
 *
 * The name is checked here as well as in the browser: a client-side guard on
 * something with no undo is decoration, and the shared `confirmationMatches`
 * means both sides apply the identical rule.
 */
export async function purgeLead(actor: Actor, leadId: string, confirmName: string): Promise<void> {
  if (!can(actor, 'DELETE_LEADS')) {
    throw forbidden('Your role cannot permanently delete leads');
  }

  const existing = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId },
    select: { id: true, customerName: true, deletedAt: true },
  });
  if (!existing) throw notFound('Lead');
  if (!existing.deletedAt) {
    throw badRequest('Move it to the trash before deleting it permanently', 'NOT_TRASHED');
  }
  if (!confirmationMatches(confirmName, existing.customerName)) {
    throw badRequest('The name you typed does not match this lead', 'CONFIRMATION_MISMATCH');
  }

  // Activities and follow-ups cascade — see the relations in schema.prisma.
  await prisma.lead.delete({ where: { id: leadId } });
}

/**
 * Destroys everything that has sat in the trash past its retention.
 *
 * Shares the constant and the daily job with trashed follow-ups: one retention
 * policy for the product, in one place, rather than two that drift.
 */
export async function purgeExpiredLeads(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.lead.deleteMany({
    where: { deletedAt: { not: null, lt: cutoff } },
  });
  return count;
}

export { syncNextFollowUp };
export { assertAssigneeInOrg, resolveStage };
