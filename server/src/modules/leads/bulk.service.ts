import type {
  BulkAssignInput,
  BulkLeadIdsInput,
  BulkLeadResultDto,
  BulkMoveStageInput,
} from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { forbidden } from '../../lib/errors.js';
import { can, canMutateLead } from '../../lib/permissions.js';
import { recordActivities, type ActivityLogEntry } from '../../lib/activity-log.js';
import {
  assertAssigneeInOrg,
  resolveStage,
  stageTransitionData,
  type Actor,
} from './leads.service.js';

/**
 * Bulk actions over a selection from the leads table.
 *
 * ## Why these are not just the singular endpoints in a loop
 *
 * Each singular action is a `findFirst`, an `update` and an activity write —
 * three round trips per lead, and the activity write is itself two. Eighty
 * leads would be several hundred statements and a transaction held open across
 * all of them. Each function here is instead a bounded handful of statements
 * regardless of how many leads were selected: one read to load and authorise,
 * one `updateMany`, and one batched activity write.
 *
 * ## Partial success is the normal case
 *
 * A selection is made in the UI against what the table happens to be showing,
 * so it can legitimately contain leads the caller may not touch, leads someone
 * else archived a second ago, or leads already in the requested state. None of
 * those is an error worth failing the whole batch over. Every function reports
 * `{ updated, skipped }` and the UI says which is which, rather than throwing
 * and leaving the user to guess which of their eighty leads was the problem.
 *
 * The one thing that *does* throw is a caller who may not perform the action at
 * all — a rep asking to archive. That is a different kind of answer: not "some
 * of these were not yours" but "this is not something you do".
 */

/** Ids are scoped to the caller's organisation on every read, without exception. */
const SELECT = {
  id: true,
  assignedToId: true,
  createdById: true,
  stageId: true,
  stage: { select: { key: true } },
  assignedTo: { select: { name: true } },
} as const;

/**
 * Splits the leftovers into the two answers the UI needs to tell apart.
 *
 * `notPermitted` carries ids, not a count, so the caller can point at the rows
 * it refused. It is collected from the leads that were loaded *and* did need
 * the change — anything missing, archived or already in the requested state
 * falls into `unchanged`, which is the harmless bucket and needs no names.
 */
const outcome = (
  updated: number,
  requested: number,
  notPermitted: string[] = [],
): BulkLeadResultDto => ({
  updated,
  unchanged: requested - updated - notPermitted.length,
  notPermitted,
});

export async function bulkArchive(
  actor: Actor,
  { ids }: BulkLeadIdsInput,
): Promise<BulkLeadResultDto> {
  if (!can(actor, 'DELETE_LEADS')) throw forbidden('Your role cannot archive leads');

  const { count } = await prisma.lead.updateMany({
    where: {
      id: { in: ids },
      organizationId: actor.organizationId,
      archivedAt: null,
      deletedAt: null,
    },
    data: { archivedAt: new Date(), archivedById: actor.userId },
  });

  return outcome(count, ids.length);
}

export async function bulkRestore(
  actor: Actor,
  { ids }: BulkLeadIdsInput,
): Promise<BulkLeadResultDto> {
  if (!can(actor, 'DELETE_LEADS')) throw forbidden('Your role cannot restore leads');

  const { count } = await prisma.lead.updateMany({
    where: {
      id: { in: ids },
      organizationId: actor.organizationId,
      archivedAt: { not: null },
      // Un-archiving must not reach into the trash: those are restored from
      // the trash view, back to whatever state they were deleted in.
      deletedAt: null,
    },
    data: { archivedAt: null, archivedById: null },
  });

  return outcome(count, ids.length);
}

/**
 * Moves a selection to the trash.
 *
 * Reversible, so it is confirmed by count like archiving rather than by typing
 * anything. Destroying leads stays one at a time — you cannot type one name for
 * forty records, and that friction is the entire point of the permanent step.
 */
export async function bulkTrash(
  actor: Actor,
  { ids }: BulkLeadIdsInput,
): Promise<BulkLeadResultDto> {
  if (!can(actor, 'DELETE_LEADS')) throw forbidden('Your role cannot delete leads');

  const { count } = await prisma.lead.updateMany({
    where: { id: { in: ids }, organizationId: actor.organizationId, deletedAt: null },
    data: { deletedAt: new Date(), deletedById: actor.userId },
  });

  return outcome(count, ids.length);
}

/** Puts a selection back to whatever state it was deleted in. */
export async function bulkRestoreFromTrash(
  actor: Actor,
  { ids }: BulkLeadIdsInput,
): Promise<BulkLeadResultDto> {
  if (!can(actor, 'DELETE_LEADS')) throw forbidden('Your role cannot restore leads');

  const { count } = await prisma.lead.updateMany({
    where: { id: { in: ids }, organizationId: actor.organizationId, deletedAt: { not: null } },
    data: { deletedAt: null, deletedById: null },
  });

  return outcome(count, ids.length);
}

export async function bulkMoveStage(
  actor: Actor,
  input: BulkMoveStageInput,
): Promise<BulkLeadResultDto> {
  const stage = await resolveStage(actor.organizationId, input.stageKey);

  const leads = await prisma.lead.findMany({
    where: {
      id: { in: input.ids },
      organizationId: actor.organizationId,
      archivedAt: null,
      deletedAt: null,
    },
    select: SELECT,
  });

  // A lead already sitting in the target stage is left alone rather than
  // rewritten: stamping a "moved from Proposal to Proposal" entry on the
  // timeline would be a lie, and it would reset its closing date.
  const needsMove = leads.filter((lead) => lead.stageId !== stage.id);
  const movable = needsMove.filter((lead) => canMutateLead(actor, lead));
  const notPermitted = needsMove
    .filter((lead) => !canMutateLead(actor, lead))
    .map((lead) => lead.id);

  if (movable.length === 0) return outcome(0, input.ids.length, notPermitted);

  const transition = stageTransitionData(stage, input.lostReason);

  await prisma.$transaction(async (tx) => {
    /*
     * Moved leads land at the top of the destination column, which is where a
     * single move from the card menu puts them too.
     *
     * They all take the same position and are separated by the board's own
     * tiebreak, because `updateMany` cannot write a distinct value per row and
     * a hundred individual updates to spread them out would defeat the point of
     * a bulk endpoint. Positions are only ever compared, never assumed unique.
     */
    const lowest = await tx.lead.aggregate({
      where: { organizationId: actor.organizationId, stageId: stage.id },
      _min: { boardPosition: true },
    });

    await tx.lead.updateMany({
      // Scoped again on the way out. The ids came from an org-filtered read, so
      // this is belt and braces — but it means every write in this file is
      // tenant-scoped where you can see it, rather than because you traced
      // where its ids came from. `archivedAt` closes the window where someone
      // archives a lead between the read above and this write.
      where: {
        id: { in: movable.map((lead) => lead.id) },
        organizationId: actor.organizationId,
        archivedAt: null,
        deletedAt: null,
      },
      data: {
        stageId: stage.id,
        boardPosition: (lowest._min.boardPosition ?? 0) - 1,
        ...transition,
      },
    });

    await recordActivities(
      tx,
      movable.map<ActivityLogEntry>((lead) => ({
        organizationId: actor.organizationId,
        leadId: lead.id,
        userId: actor.userId,
        type: 'STAGE_CHANGED',
        metadata: { fromStage: lead.stage.key, toStage: stage.key },
      })),
    );
  });

  return outcome(movable.length, input.ids.length, notPermitted);
}

export async function bulkAssign(actor: Actor, input: BulkAssignInput): Promise<BulkLeadResultDto> {
  if (input.assignedToId) await assertAssigneeInOrg(actor.organizationId, input.assignedToId);

  const leads = await prisma.lead.findMany({
    where: {
      id: { in: input.ids },
      organizationId: actor.organizationId,
      archivedAt: null,
      deletedAt: null,
    },
    select: SELECT,
  });

  const needsChange = leads.filter((lead) => lead.assignedToId !== input.assignedToId);
  const changeable = needsChange.filter((lead) => canMutateLead(actor, lead));
  const notPermitted = needsChange
    .filter((lead) => !canMutateLead(actor, lead))
    .map((lead) => lead.id);

  if (changeable.length === 0) return outcome(0, input.ids.length, notPermitted);

  const nextAssignee = input.assignedToId
    ? await prisma.user.findUnique({
        where: { id: input.assignedToId },
        select: { name: true },
      })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.lead.updateMany({
      where: {
        id: { in: changeable.map((lead) => lead.id) },
        organizationId: actor.organizationId,
        archivedAt: null,
        deletedAt: null,
      },
      data: { assignedToId: input.assignedToId },
    });

    await recordActivities(
      tx,
      changeable.map<ActivityLogEntry>((lead) => ({
        organizationId: actor.organizationId,
        leadId: lead.id,
        userId: actor.userId,
        type: 'ASSIGNED',
        metadata: {
          fromAssignee: lead.assignedTo?.name ?? null,
          toAssignee: nextAssignee?.name ?? null,
        },
      })),
    );
  });

  return outcome(changeable.length, input.ids.length, notPermitted);
}
