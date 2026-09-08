import type { Prisma } from '@prisma/client';
import type {
  CompleteFollowUpInput,
  CreateFollowUpInput,
  FollowUpBucket,
  FollowUpCountsDto,
  FollowUpDto,
  FollowUpQueryInput,
  Paginated,
  UpdateFollowUpInput,
} from '@leadpilot/shared';
import { FOLLOW_UP_BUCKETS } from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { paginate, toPrismaPagination } from '../../lib/pagination.js';
import {
  FOLLOW_UP_SELECT,
  FOLLOW_UP_WITH_LEAD_SELECT,
  toFollowUpDto,
} from '../../lib/serializers.js';
import { recordActivity, syncNextFollowUp } from '../../lib/activity-log.js';
import { canMutateFollowUp } from '../../lib/permissions.js';
import { endOfToday, startOfToday } from '../leads/lead-filters.js';
import type { Actor } from '../leads/leads.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Turns a bucket name into the dates that define it.
 *
 * Computed here, against the server clock, for the same reason the counts are:
 * the tab labelled "3 overdue" and the list it opens have to agree, and they
 * only do if one clock decided both.
 */
function bucketWhere(bucket: FollowUpBucket): Prisma.FollowUpWhereInput {
  const dayStart = startOfToday();
  const dayEnd = endOfToday();
  const weekEnd = new Date(dayEnd.getTime() + 7 * DAY_MS);

  switch (bucket) {
    case 'overdue':
      return { status: 'PENDING', dueAt: { lt: dayStart } };
    case 'today':
      return { status: 'PENDING', dueAt: { gte: dayStart, lte: dayEnd } };
    case 'week':
      return { status: 'PENDING', dueAt: { gt: dayEnd, lte: weekEnd } };
    case 'later':
      return { status: 'PENDING', dueAt: { gt: weekEnd } };
    case 'done':
      return { status: { in: ['COMPLETED', 'CANCELLED'] } };
  }
}

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
  const where = buildWhere(actor, query);

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

  return paginate(
    rows.map((row) => toFollowUpDto(row, actor)),
    query,
    total,
  );
}

/**
 * How many pending follow-ups sit in each bucket, under the same filters the
 * list is showing.
 *
 * Issued as one batch so every number in the tab strip is drawn from a single
 * moment. Counting them in five separate round-trips would let a colleague
 * complete something between two of them and produce a strip that does not add
 * up — visibly, since the user can see all five at once.
 */
export async function countFollowUps(
  actor: Actor,
  query: FollowUpQueryInput,
): Promise<FollowUpCountsDto> {
  // The bucket is what each count varies by, so the caller's own bucket choice
  // is dropped: a strip that only counted the open tab would read "0, 0, 4, 0".
  const base = buildWhere(actor, { ...query, bucket: undefined });
  const counts = await prisma.$transaction(
    FOLLOW_UP_BUCKETS.map((bucket) =>
      prisma.followUp.count({ where: { ...base, ...bucketWhere(bucket) } }),
    ),
  );

  return Object.fromEntries(
    FOLLOW_UP_BUCKETS.map((bucket, index) => [bucket, counts[index] ?? 0]),
  ) as FollowUpCountsDto;
}

/**
 * The shared filter for both the list and its counts.
 *
 * `bucket` deliberately overrides `status` and the date range rather than
 * intersecting with them: it *is* a status-and-date shorthand, and letting the
 * two compose would make "overdue" plus "completed" a legal, always-empty query.
 */
function buildWhere(actor: Actor, query: FollowUpQueryInput): Prisma.FollowUpWhereInput {
  const search = query.q?.trim();

  return {
    organizationId: actor.organizationId,
    ...(query.leadId && { leadId: query.leadId }),
    ...(query.assignedToId?.length && { assignedToId: { in: query.assignedToId } }),
    ...(query.bucket
      ? bucketWhere(query.bucket)
      : {
          ...(query.status?.length && { status: { in: query.status } }),
          ...((query.dueFrom || query.dueTo) && {
            dueAt: {
              ...(query.dueFrom && { gte: new Date(query.dueFrom) }),
              ...(query.dueTo && { lte: new Date(query.dueTo) }),
            },
          }),
        }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { lead: { customerName: { contains: search, mode: 'insensitive' } } },
        { lead: { company: { contains: search, mode: 'insensitive' } } },
      ],
    }),
  };
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

  return toFollowUpDto(created, actor);
}

/**
 * Loads a follow-up inside the caller's organisation and checks they may change
 * it. A row belonging to another tenant is reported as missing rather than
 * forbidden, so the API never confirms that it exists.
 */
async function getWritableFollowUp(actor: Actor, followUpId: string) {
  const followUp = await prisma.followUp.findFirst({
    where: { id: followUpId, organizationId: actor.organizationId },
    select: {
      id: true,
      leadId: true,
      title: true,
      status: true,
      assignedToId: true,
      lead: { select: { assignedToId: true, createdById: true } },
    },
  });
  if (!followUp) throw notFound('Follow-up');
  if (!canMutateFollowUp(actor, followUp)) {
    throw forbidden('You can only change follow-ups on your own leads', 'FOLLOW_UP_NOT_YOURS');
  }
  return followUp;
}

export async function updateFollowUp(
  actor: Actor,
  followUpId: string,
  input: UpdateFollowUpInput,
): Promise<FollowUpDto> {
  const existing = await getWritableFollowUp(actor, followUpId);
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

  return toFollowUpDto(updated, actor);
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
  const existing = await getWritableFollowUp(actor, followUpId);
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

  return toFollowUpDto(completed, actor);
}

export async function cancelFollowUp(actor: Actor, followUpId: string): Promise<FollowUpDto> {
  const existing = await getWritableFollowUp(actor, followUpId);

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

  return toFollowUpDto(cancelled, actor);
}

export async function deleteFollowUp(actor: Actor, followUpId: string): Promise<void> {
  const existing = await getWritableFollowUp(actor, followUpId);
  await prisma.$transaction(async (tx) => {
    await tx.followUp.delete({ where: { id: followUpId } });
    await syncNextFollowUp(tx, existing.leadId);
  });
}
