import type { ActivityType, Prisma } from '@prisma/client';
import type {
  ActivityDto,
  ActivityQueryInput,
  CreateActivityInput,
  Paginated,
  UpdateActivityInput,
} from '@leadpilot/shared';
import { USER_ACTIVITY_TYPES } from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { can } from '../../lib/permissions.js';
import { forbidden, notFound } from '../../lib/errors.js';
import { paginate, toPrismaPagination } from '../../lib/pagination.js';
import { ACTIVITY_SELECT, toActivityDto } from '../../lib/serializers.js';
import { recordActivity } from '../../lib/activity-log.js';
import type { Actor } from '../leads/leads.service.js';

/** User-authored types, as a list for Prisma filters and a set for membership tests. */
const USER_TYPES: ActivityType[] = [...USER_ACTIVITY_TYPES];
const USER_TYPE_SET = new Set<ActivityType>(USER_TYPES);

/**
 * Confirms the lead exists inside the caller's organisation before any activity
 * read or write. Every function in this module goes through it, so an activity
 * can never be attached to — or read from — another tenant's lead.
 *
 * @param requireActive rejects archived leads. Set for writes only: an archived
 * lead's history stays readable (that is the point of archiving rather than
 * deleting), but nothing new may be appended to it.
 */
async function assertLeadInOrg(
  actor: Actor,
  leadId: string,
  { requireActive = false }: { requireActive?: boolean } = {},
): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: {
      id: leadId,
      organizationId: actor.organizationId,
      // `requireActive` gates writing, and trash gates it exactly as archiving
      // does: you cannot log a call against a lead that is on its way out.
      // Reading stays open, because the detail page for a trashed lead shows
      // its history — you should be able to see what you are about to destroy.
      ...(requireActive ? { archivedAt: null, deletedAt: null } : {}),
    },
    select: { id: true },
  });
  if (!lead) throw notFound('Lead');
}

export async function listActivities(
  actor: Actor,
  leadId: string,
  query: ActivityQueryInput,
): Promise<Paginated<ActivityDto>> {
  await assertLeadInOrg(actor, leadId);

  const where: Prisma.ActivityWhereInput = {
    leadId,
    organizationId: actor.organizationId,
    ...(query.view === 'notes' && { type: { in: USER_TYPES } }),
    ...(query.view === 'system' && { type: { notIn: USER_TYPES } }),
  };

  const { skip, take } = toPrismaPagination(query);
  const [rows, total] = await prisma.$transaction([
    prisma.activity.findMany({
      where,
      select: ACTIVITY_SELECT,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
    }),
    prisma.activity.count({ where }),
  ]);

  return paginate(
    rows.map((row) => toActivityDto(row, actor)),
    query,
    total,
  );
}

export async function createActivity(
  actor: Actor,
  leadId: string,
  input: CreateActivityInput,
): Promise<ActivityDto> {
  await assertLeadInOrg(actor, leadId, { requireActive: true });

  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

  const created = await prisma.$transaction((tx) =>
    recordActivity(tx, {
      organizationId: actor.organizationId,
      leadId,
      userId: actor.userId,
      type: input.type,
      body: input.body,
      occurredAt,
    }),
  );

  return toActivityDto(created, actor);
}

export async function updateActivity(
  actor: Actor,
  activityId: string,
  input: UpdateActivityInput,
): Promise<ActivityDto> {
  const existing = await prisma.activity.findFirst({
    where: { id: activityId, organizationId: actor.organizationId },
    select: { id: true, userId: true, type: true },
  });
  if (!existing) throw notFound('Note');

  // System audit entries are the record of what happened; nobody rewrites them.
  if (!USER_TYPE_SET.has(existing.type)) {
    throw forbidden('System activity entries cannot be edited');
  }

  // Editing somebody else's note is the same power as editing their lead.
  if (existing.userId !== actor.userId && !can(actor, 'EDIT_ALL_LEADS')) {
    throw forbidden('You can only edit your own notes');
  }

  const updated = await prisma.activity.update({
    where: { id: activityId },
    data: { body: input.body },
    select: ACTIVITY_SELECT,
  });

  return toActivityDto(updated, actor);
}

export async function deleteActivity(actor: Actor, activityId: string): Promise<void> {
  const existing = await prisma.activity.findFirst({
    where: { id: activityId, organizationId: actor.organizationId },
    select: { id: true, userId: true, type: true },
  });
  if (!existing) throw notFound('Note');

  if (!USER_TYPE_SET.has(existing.type)) {
    throw forbidden('System activity entries cannot be deleted');
  }

  // Editing somebody else's note is the same power as editing their lead.
  if (existing.userId !== actor.userId && !can(actor, 'EDIT_ALL_LEADS')) {
    throw forbidden('You can only delete your own notes');
  }

  await prisma.activity.delete({ where: { id: activityId } });
}
