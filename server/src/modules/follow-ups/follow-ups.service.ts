import type { Prisma } from '@prisma/client';
import type {
  CompleteFollowUpInput,
  CreateFollowUpInput,
  FollowUpBucket,
  FollowUpCountsDto,
  FollowUpDto,
  FollowUpQueryInput,
  FollowUpSortField,
  Paginated,
  UpdateFollowUpInput,
} from '@leadpilot/shared';
import { FOLLOW_UP_BUCKETS, TRASH_RETENTION_DAYS, UNASSIGNED } from '@leadpilot/shared';
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
import { dayWindow, normaliseTimeZone, type DayWindow } from '../../lib/day-window.js';
import type { Actor } from '../leads/leads.service.js';

/**
 * Turns a bucket name into the dates that define it.
 *
 * The window is passed in rather than computed here so that a list and its
 * counts are drawn from one set of boundaries, in one timezone — the reader's.
 * The tab labelled "3 overdue" and the list it opens have to agree, and they
 * only do if one clock decided both.
 *
 * `trash` is the one bucket that is not about time at all, which is why it is
 * also the one that overrides the `deletedAt: null` every other view applies.
 */
function bucketWhere(bucket: FollowUpBucket, window: DayWindow): Prisma.FollowUpWhereInput {
  const { startOfToday: dayStart, endOfToday: dayEnd, weekEnd } = window;

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
      return { status: 'COMPLETED' };
    case 'cancelled':
      return { status: 'CANCELLED' };
    case 'trash':
      return { deletedAt: { not: null } };
  }
}

/**
 * Ordering, from the sort field the client asked for.
 *
 * Two of them reach through the relation — a follow-up has no customer name of
 * its own — and every one falls back to `dueAt` so rows that tie do not shuffle
 * between pages.
 */
function orderFor(
  sortBy: FollowUpSortField,
  sortDir: 'asc' | 'desc',
): Prisma.FollowUpOrderByWithRelationInput[] {
  switch (sortBy) {
    case 'customerName':
      return [{ lead: { customerName: sortDir } }, { dueAt: 'asc' }];
    case 'assignee':
      // Nulls last in Prisma, so unassigned tasks sink rather than leading.
      return [{ assignedTo: { name: sortDir } }, { dueAt: 'asc' }];
    case 'title':
      return [{ title: sortDir }, { dueAt: 'asc' }];
    case 'createdAt':
      return [{ createdAt: sortDir }, { dueAt: 'asc' }];
    case 'dueAt':
      return [{ dueAt: sortDir }, { createdAt: 'desc' }];
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
  const where = buildWhere(actor, query, dayWindow(normaliseTimeZone(query.tz)));

  const { skip, take } = toPrismaPagination(query);
  const [rows, total] = await prisma.$transaction([
    prisma.followUp.findMany({
      where,
      select: FOLLOW_UP_WITH_LEAD_SELECT,
      orderBy: orderFor(query.sortBy, query.sortDir),
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
  const window = dayWindow(normaliseTimeZone(query.tz));
  // The bucket is what each count varies by, so the caller's own bucket choice
  // is dropped: a strip that only counted the open tab would read "0, 0, 4, 0".
  const counts = await prisma.$transaction(
    FOLLOW_UP_BUCKETS.map((bucket) =>
      prisma.followUp.count({
        // Rebuilt per bucket rather than merged onto one base, because `trash`
        // has to override the `deletedAt: null` the others depend on.
        where: buildWhere(actor, { ...query, bucket }, window),
      }),
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
function buildWhere(
  actor: Actor,
  query: FollowUpQueryInput,
  window: DayWindow,
): Prisma.FollowUpWhereInput {
  const search = query.q?.trim();

  // `__unassigned__` is a real filter value, not an id — the same sentinel the
  // leads table uses, so "Unassigned" behaves identically on both screens.
  const assignees = query.assignedToId ?? [];
  const wantsUnassigned = assignees.includes(UNASSIGNED);
  const assigneeIds = assignees.filter((id) => id !== UNASSIGNED);
  const assigneeFilter: Prisma.FollowUpWhereInput[] = [];
  if (assigneeIds.length > 0) assigneeFilter.push({ assignedToId: { in: assigneeIds } });
  if (wantsUnassigned) assigneeFilter.push({ assignedToId: null });

  return {
    organizationId: actor.organizationId,
    // Trash is opt-in. Every other view — including a lead's own panel and the
    // dashboard — behaves as though a deleted follow-up is gone.
    ...(query.bucket === 'trash' ? {} : { deletedAt: null }),
    // And a follow-up on a *deleted lead* is gone from every view including the
    // trash: it is a promise to somebody whose record no longer exists, and it
    // will be destroyed with them when the reaper gets there.
    lead: { deletedAt: null },
    ...(query.leadId && { leadId: query.leadId }),
    ...(assigneeFilter.length > 0 && { OR: assigneeFilter }),
    ...(query.bucket
      ? bucketWhere(query.bucket, window)
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
      // `AND` rather than a second `OR`, which would widen the assignee filter
      // instead of narrowing within it.
      AND: [
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { lead: { customerName: { contains: search, mode: 'insensitive' } } },
            { lead: { company: { contains: search, mode: 'insensitive' } } },
          ],
        },
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
async function getWritableFollowUp(
  actor: Actor,
  followUpId: string,
  options: { includeTrashed?: boolean } = {},
) {
  const followUp = await prisma.followUp.findFirst({
    where: {
      id: followUpId,
      organizationId: actor.organizationId,
      // Completing or rescheduling something in the trash should read as "gone",
      // not as a refusal — only the trash's own actions opt into seeing it.
      ...(options.includeTrashed ? {} : { deletedAt: null }),
    },
    select: {
      id: true,
      leadId: true,
      title: true,
      status: true,
      deletedAt: true,
      assignedToId: true,
      createdById: true,
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
  // Correcting a title or a note on a finished task is reasonable; moving its
  // due date is not, and the guard belongs here as well as on the reschedule
  // route or the generic PATCH is a way around it.
  if (input.dueAt !== undefined && existing.status !== 'PENDING') {
    throw badRequest('Only a pending follow-up can be rescheduled', 'FOLLOW_UP_NOT_PENDING');
  }

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
  if (existing.status !== 'PENDING') {
    // Codes rather than prose, because the browser translates by code and this
    // is a message two people working the same list will actually meet.
    throw existing.status === 'COMPLETED'
      ? badRequest('That follow-up is already completed', 'FOLLOW_UP_ALREADY_COMPLETED')
      : badRequest('That follow-up was cancelled', 'FOLLOW_UP_NOT_PENDING');
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

/**
 * Moves the due date of a *pending* follow-up.
 *
 * A separate function rather than a thin wrapper over `updateFollowUp`, because
 * the guard is the point: rescheduling something already completed or cancelled
 * left a task with a future due date and a terminal status, which no screen in
 * the app knows how to describe.
 */
export async function rescheduleFollowUp(
  actor: Actor,
  followUpId: string,
  dueAt: string,
): Promise<FollowUpDto> {
  const existing = await getWritableFollowUp(actor, followUpId);
  if (existing.status !== 'PENDING') {
    throw badRequest('Only a pending follow-up can be rescheduled', 'FOLLOW_UP_NOT_PENDING');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.followUp.update({
      where: { id: followUpId },
      data: { dueAt: new Date(dueAt) },
      select: FOLLOW_UP_SELECT,
    });
    await syncNextFollowUp(tx, existing.leadId);
    return row;
  });

  return toFollowUpDto(updated, actor);
}

export async function cancelFollowUp(actor: Actor, followUpId: string): Promise<FollowUpDto> {
  const existing = await getWritableFollowUp(actor, followUpId);
  if (existing.status !== 'PENDING') {
    throw existing.status === 'COMPLETED'
      ? badRequest('That follow-up is already completed', 'FOLLOW_UP_ALREADY_COMPLETED')
      : badRequest('That follow-up is already cancelled', 'FOLLOW_UP_NOT_PENDING');
  }

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

/**
 * Moves a follow-up to the trash.
 *
 * Not `DELETE FROM`. A follow-up carries the only record of a promise somebody
 * made, and the button that removes it is one click from the button that
 * completes it — so it leaves every view immediately and stays recoverable
 * until the reaper purges it, `TRASH_RETENTION_DAYS` later.
 */
export async function trashFollowUp(actor: Actor, followUpId: string): Promise<FollowUpDto> {
  const existing = await getWritableFollowUp(actor, followUpId, { includeTrashed: true });
  if (existing.deletedAt)
    throw badRequest('That follow-up is already in the trash', 'ALREADY_TRASHED');

  const trashed = await prisma.$transaction(async (tx) => {
    const row = await tx.followUp.update({
      where: { id: followUpId },
      data: { deletedAt: new Date() },
      select: FOLLOW_UP_SELECT,
    });
    // A trashed task must stop being the lead's next touchpoint.
    await syncNextFollowUp(tx, existing.leadId);
    return row;
  });

  return toFollowUpDto(trashed, actor);
}

export async function restoreFollowUp(actor: Actor, followUpId: string): Promise<FollowUpDto> {
  const existing = await getWritableFollowUp(actor, followUpId, { includeTrashed: true });
  if (!existing.deletedAt) throw badRequest('That follow-up is not in the trash', 'NOT_TRASHED');

  const restored = await prisma.$transaction(async (tx) => {
    const row = await tx.followUp.update({
      where: { id: followUpId },
      data: { deletedAt: null },
      select: FOLLOW_UP_SELECT,
    });
    await syncNextFollowUp(tx, existing.leadId);
    return row;
  });

  return toFollowUpDto(restored, actor);
}

/**
 * The only path that actually removes a row, and it is deliberately reachable
 * only from the trash: you have to have deleted something before you can
 * destroy it.
 */
export async function purgeFollowUp(actor: Actor, followUpId: string): Promise<void> {
  const existing = await getWritableFollowUp(actor, followUpId, { includeTrashed: true });
  if (!existing.deletedAt) {
    throw badRequest('Move it to the trash before deleting it permanently', 'NOT_TRASHED');
  }

  await prisma.$transaction(async (tx) => {
    await tx.followUp.delete({ where: { id: followUpId } });
    await syncNextFollowUp(tx, existing.leadId);
  });
}

/**
 * Purges everything that has sat in the trash past its retention.
 *
 * Runs from the same daily cron that reaps demo sandboxes — one scheduled job
 * for the whole product, rather than a second one to forget about. Scoped by
 * date only: trash is not tenant-specific work.
 */
export async function purgeExpiredTrash(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.followUp.deleteMany({
    where: { deletedAt: { not: null, lt: cutoff } },
  });
  return count;
}
