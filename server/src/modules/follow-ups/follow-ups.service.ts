import type { Prisma } from '@prisma/client';
import type {
  CompleteFollowUpInput,
  CreateFollowUpInput,
  FollowUpDto,
  FollowUpQueryInput,
  Paginated,
  UpdateFollowUpInput,
} from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { paginate, toPrismaPagination } from '../../lib/pagination.js';
import {
  FOLLOW_UP_SELECT,
  FOLLOW_UP_WITH_LEAD_SELECT,
  toFollowUpDto,
} from '../../lib/serializers.js';
import { recordActivity, syncNextFollowUp } from '../../lib/activity-log.js';
import type { Actor } from '../leads/leads.service.js';

async function getLeadInOrg(actor: Actor, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId, archivedAt: null },
    select: { id: true, assignedToId: true },
  });
  if (!lead) throw notFound('Lead');
  return lead;
}

async function assertAssigneeInOrg(organizationId: string, userId: string): Promise<void> {
  const member = await prisma.user.findFirst({
    where: { id: userId, organizationId, isActive: true },
    select: { id: true },
  });
  if (!member) throw badRequest('That team member is not part of this workspace');
}

/**
 * Lists follow-ups across the whole organisation, optionally narrowed to one
 * lead. Powers both the lead detail panel and the Phase 4 follow-ups inbox.
 */
export async function listFollowUps(
  actor: Actor,
  query: FollowUpQueryInput,
): Promise<Paginated<FollowUpDto>> {
  const where: Prisma.FollowUpWhereInput = {
    organizationId: actor.organizationId,
    ...(query.leadId && { leadId: query.leadId }),
    ...(query.status?.length && { status: { in: query.status } }),
    ...(query.assignedToId?.length && { assignedToId: { in: query.assignedToId } }),
    ...((query.dueFrom || query.dueTo) && {
      dueAt: {
        ...(query.dueFrom && { gte: new Date(query.dueFrom) }),
        ...(query.dueTo && { lte: new Date(query.dueTo) }),
      },
    }),
  };

  const { skip, take } = toPrismaPagination(query);
  const [rows, total] = await prisma.$transaction([
    prisma.followUp.findMany({
      where,
      select: FOLLOW_UP_WITH_LEAD_SELECT,
      orderBy: [{ [query.sortBy]: query.sortDir }, { createdAt: 'desc' }],
      skip,
      take,
    }),
    prisma.followUp.count({ where }),
  ]);

  return paginate(rows.map(toFollowUpDto), query, total);
}

export async function createFollowUp(
  actor: Actor,
  leadId: string,
  input: CreateFollowUpInput,
): Promise<FollowUpDto> {
  const lead = await getLeadInOrg(actor, leadId);

  // Falls back to the lead's rep, then to the creator, so a task always has an owner.
  const assignedToId = input.assignedToId ?? lead.assignedToId ?? actor.userId;
  await assertAssigneeInOrg(actor.organizationId, assignedToId);

  const dueAt = new Date(input.dueAt);

  const created = await prisma.$transaction(async (tx) => {
    const followUp = await tx.followUp.create({
      data: {
        organizationId: actor.organizationId,
        leadId,
        assignedToId,
        createdById: actor.userId,
        title: input.title,
        notes: input.notes ?? null,
        dueAt,
        channel: input.channel,
      },
      select: FOLLOW_UP_SELECT,
    });

    await recordActivity(tx, {
      organizationId: actor.organizationId,
      leadId,
      userId: actor.userId,
      type: 'FOLLOW_UP_SCHEDULED',
      metadata: { followUpTitle: input.title, dueAt: dueAt.toISOString() },
    });

    await syncNextFollowUp(tx, leadId);
    return followUp;
  });

  return toFollowUpDto(created);
}

async function getFollowUpInOrg(actor: Actor, followUpId: string) {
  const followUp = await prisma.followUp.findFirst({
    where: { id: followUpId, organizationId: actor.organizationId },
    select: { id: true, leadId: true, title: true, status: true },
  });
  if (!followUp) throw notFound('Follow-up');
  return followUp;
}

export async function updateFollowUp(
  actor: Actor,
  followUpId: string,
  input: UpdateFollowUpInput,
): Promise<FollowUpDto> {
  const existing = await getFollowUpInOrg(actor, followUpId);
  if (input.assignedToId) await assertAssigneeInOrg(actor.organizationId, input.assignedToId);

  const data: Prisma.FollowUpUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.notes !== undefined) data.notes = input.notes ?? null;
  if (input.dueAt !== undefined) data.dueAt = new Date(input.dueAt);
  if (input.channel !== undefined) data.channel = input.channel;
  if (input.assignedToId !== undefined) {
    data.assignedTo = input.assignedToId
      ? { connect: { id: input.assignedToId } }
      : { disconnect: true };
  }
  if (input.status !== undefined) {
    data.status = input.status;
    data.completedAt = input.status === 'COMPLETED' ? new Date() : null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.followUp.update({
      where: { id: followUpId },
      data,
      select: FOLLOW_UP_SELECT,
    });
    await syncNextFollowUp(tx, existing.leadId);
    return row;
  });

  return toFollowUpDto(updated);
}

/**
 * Marks a follow-up done and writes the outcome to the lead's timeline, so the
 * next person to open the lead sees what happened without opening the task.
 */
export async function completeFollowUp(
  actor: Actor,
  followUpId: string,
  input: CompleteFollowUpInput,
): Promise<FollowUpDto> {
  const existing = await getFollowUpInOrg(actor, followUpId);
  if (existing.status === 'COMPLETED') {
    throw badRequest('That follow-up is already completed');
  }

  const completed = await prisma.$transaction(async (tx) => {
    const row = await tx.followUp.update({
      where: { id: followUpId },
      data: { status: 'COMPLETED', completedAt: new Date() },
      select: FOLLOW_UP_SELECT,
    });

    await recordActivity(tx, {
      organizationId: actor.organizationId,
      leadId: existing.leadId,
      userId: actor.userId,
      type: 'FOLLOW_UP_COMPLETED',
      body: input.outcome ?? null,
      metadata: { followUpTitle: existing.title },
    });

    await syncNextFollowUp(tx, existing.leadId);
    return row;
  });

  return toFollowUpDto(completed);
}

export async function cancelFollowUp(actor: Actor, followUpId: string): Promise<FollowUpDto> {
  const existing = await getFollowUpInOrg(actor, followUpId);

  const cancelled = await prisma.$transaction(async (tx) => {
    const row = await tx.followUp.update({
      where: { id: followUpId },
      data: { status: 'CANCELLED', completedAt: null },
      select: FOLLOW_UP_SELECT,
    });

    await recordActivity(tx, {
      organizationId: actor.organizationId,
      leadId: existing.leadId,
      userId: actor.userId,
      type: 'FOLLOW_UP_CANCELLED',
      metadata: { followUpTitle: existing.title },
    });

    await syncNextFollowUp(tx, existing.leadId);
    return row;
  });

  return toFollowUpDto(cancelled);
}

export async function deleteFollowUp(actor: Actor, followUpId: string): Promise<void> {
  const existing = await getFollowUpInOrg(actor, followUpId);
  await prisma.$transaction(async (tx) => {
    await tx.followUp.delete({ where: { id: followUpId } });
    await syncNextFollowUp(tx, existing.leadId);
  });
}
