import type { ActivityType, Prisma } from '@prisma/client';
import type { ActivityMetadata } from '@leadpilot/shared';
import { ACTIVITY_SELECT } from './serializers.js';

/** The subset of PrismaClient available inside `$transaction(async (tx) => …)`. */
export type TxClient = Prisma.TransactionClient;

export interface ActivityLogEntry {
  organizationId: string;
  leadId: string;
  userId: string | null;
  type: ActivityType;
  body?: string | null;
  metadata?: ActivityMetadata | null;
  occurredAt?: Date;
}

/**
 * Appends to a lead's timeline and keeps `lead.lastActivityAt` in step.
 *
 * That denormalised column is what lets the leads table sort by "last touched"
 * without a correlated subquery per row, so it must only ever be written here.
 */
export async function recordActivity(tx: TxClient, entry: ActivityLogEntry) {
  const occurredAt = entry.occurredAt ?? new Date();

  // Returned so callers never have to re-query for the row they just wrote —
  // "select the newest activity by this user" would be a race under concurrency.
  const activity = await tx.activity.create({
    select: ACTIVITY_SELECT,
    data: {
      organizationId: entry.organizationId,
      leadId: entry.leadId,
      userId: entry.userId,
      type: entry.type,
      body: entry.body ?? null,
      metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      occurredAt,
    },
  });

  await tx.lead.update({
    where: { id: entry.leadId },
    data: {
      lastActivityAt: occurredAt,
      // A logged conversation also counts as contact; a system audit entry does not.
      ...(CONTACT_ACTIVITY_TYPES.has(entry.type) && { lastContactedAt: occurredAt }),
    },
    select: { id: true },
  });

  return activity;
}

/**
 * The batched form, for a bulk action writing one entry per lead.
 *
 * Same invariant as `recordActivity` — nothing else may touch `lastActivityAt`
 * — but expressed as two statements instead of two per lead, so archiving
 * eighty leads is a constant number of round trips rather than a hundred and
 * sixty. It returns nothing: a bulk caller has no use for the rows, and
 * `createMany` cannot return them anyway.
 */
export async function recordActivities(tx: TxClient, entries: ActivityLogEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const occurredAt = new Date();
  // A bulk action is always within one organisation, and the timestamp update
  // below is scoped to it. The callers already read their targets through an
  // `organizationId` filter, so this is belt and braces — but an unscoped
  // `updateMany` over caller-supplied ids is exactly the shape of a
  // cross-tenant write, and it should not be possible to introduce one here by
  // adding a caller that forgets.
  const organizationId = entries[0]?.organizationId;

  await tx.activity.createMany({
    data: entries.map((entry) => ({
      organizationId: entry.organizationId,
      leadId: entry.leadId,
      userId: entry.userId,
      type: entry.type,
      body: entry.body ?? null,
      metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      occurredAt: entry.occurredAt ?? occurredAt,
    })),
  });

  // Every bulk action so far writes audit entries only, none of which count as
  // contact — so `lastContactedAt` is deliberately left alone here. If a bulk
  // action ever logs a real conversation, this needs to grow the same split
  // `recordActivity` has.
  await tx.lead.updateMany({
    where: { id: { in: entries.map((entry) => entry.leadId) }, organizationId },
    data: { lastActivityAt: occurredAt },
  });
}

const CONTACT_ACTIVITY_TYPES = new Set<ActivityType>(['CALL', 'EMAIL', 'MEETING', 'WHATSAPP']);

/**
 * Recomputes `lead.nextFollowUpAt` from the earliest pending follow-up.
 * Called after any write that could change the set of pending follow-ups.
 */
export async function syncNextFollowUp(tx: TxClient, leadId: string): Promise<Date | null> {
  const next = await tx.followUp.findFirst({
    where: { leadId, status: 'PENDING' },
    orderBy: { dueAt: 'asc' },
    select: { dueAt: true },
  });

  await tx.lead.update({
    where: { id: leadId },
    data: { nextFollowUpAt: next?.dueAt ?? null },
    select: { id: true },
  });

  return next?.dueAt ?? null;
}
