import { Prisma } from '@prisma/client';
import type {
  BoardDto,
  BoardQueryInput,
  LeadDetailDto,
  MoveLeadOnBoardInput,
} from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { LEAD_LIST_SELECT, toLeadListItemDto, toStageDto } from '../../lib/serializers.js';
import { recordActivity } from '../../lib/activity-log.js';
import { STAGE_SELECT } from '../../lib/serializers.js';
import { buildLeadWhere } from '../leads/lead-filters.js';
import {
  assertCanMutateLead,
  getLeadById,
  stageTransitionData,
  type Actor,
} from '../leads/leads.service.js';

/**
 * Cards are ordered by their manual board rank, then by two stable tiebreaks.
 *
 * The tiebreaks are not decoration. `boardPosition` is not unique — two
 * concurrent drops into the same column can land on the same integer — and a
 * non-total ordering makes Postgres free to return those two rows in either
 * order on each request, which the user sees as cards silently swapping places
 * on refresh. Falling through to `updatedAt` and finally `id` makes the order
 * total, so the same data always renders the same way.
 */
const BOARD_ORDER: Prisma.LeadOrderByWithRelationInput[] = [
  { boardPosition: 'asc' },
  { updatedAt: 'desc' },
  { id: 'asc' },
];

/**
 * Board columns never show archived leads, and the board's own stage split
 * replaces the table's stage filter. Both are pinned here rather than trusted
 * from the query string.
 */
function boardWhere(organizationId: string, query: BoardQueryInput): Prisma.LeadWhereInput {
  return buildLeadWhere(organizationId, { ...query, archived: false, stage: undefined });
}

async function workspaceCurrency(organizationId: string): Promise<string> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { defaultCurrency: true },
  });
  return organization.defaultCurrency;
}

/**
 * The whole board in one request: every stage, its first page of cards, and the
 * totals for the cards that did *not* fit.
 *
 * The per-stage reads are issued as a single `$transaction` batch, which gets
 * them one round trip to the database and one consistent snapshot.
 */
export async function getBoard(actor: Actor, query: BoardQueryInput): Promise<BoardDto> {
  const where = boardWhere(actor.organizationId, query);

  const [stages, currency] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { organizationId: actor.organizationId },
      select: STAGE_SELECT,
      orderBy: { order: 'asc' },
    }),
    workspaceCurrency(actor.organizationId),
  ]);

  // The six column reads share one transaction, and therefore one snapshot: a
  // lead moved by a colleague mid-flight must not appear in two columns at once
  // or vanish from both. The totals are a separate aggregate — a few
  // milliseconds of skew on a "3 of 41" counter is invisible, and keeping it out
  // of the batch keeps Prisma's result typing intact.
  const [totals, columnRows] = await Promise.all([
    prisma.lead.groupBy({
      by: ['stageId'],
      where,
      _count: { _all: true },
      _sum: { estimatedValue: true },
    }),
    prisma.$transaction(
      stages.map((stage) =>
        prisma.lead.findMany({
          where: { ...where, stageId: stage.id },
          select: LEAD_LIST_SELECT,
          orderBy: BOARD_ORDER,
          take: query.limit,
        }),
      ),
    ),
  ]);

  const totalsByStageId = new Map(totals.map((entry) => [entry.stageId, entry]));

  return {
    limit: query.limit,
    currency,
    columns: stages.map((stage, index) => {
      const totalsForStage = totalsByStageId.get(stage.id);
      return {
        stage: toStageDto(stage),
        leads: (columnRows[index] ?? []).map((row) => toLeadListItemDto(row, actor)),
        total: totalsForStage?._count._all ?? 0,
        value: totalsForStage?._sum.estimatedValue?.toNumber() ?? 0,
      };
    }),
  };
}

/**
 * Drops a lead into a position on the board, changing its stage if the column
 * changed.
 *
 * ## How the position is resolved
 *
 * The client sends an *anchor* — "put this card immediately below
 * `precedingLeadId`" — not an index. See `moveLeadOnBoardSchema` for why.
 * If the anchor has since been moved or archived by someone else, it will not
 * be found in the column and the card lands at the top rather than failing:
 * a drag is a low-stakes gesture and refusing it would be worse than putting
 * the card somewhere sensible and letting the user drag again.
 *
 * ## Why the whole column is renumbered
 *
 * The alternative — nudging the moved lead into the gap between its new
 * neighbours — is O(1) but eventually runs out of integers between two
 * adjacent positions and needs a rebalancing pass anyway. Renumbering the
 * destination column is one extra `SELECT` plus one set-based `UPDATE`, it can
 * never drift, and at the scale this product targets (a stage holds tens to
 * low hundreds of leads) the cost is not measurable. The source column is
 * deliberately left alone: removing a card from an ordered list leaves the
 * remaining order valid, and the gap is harmless.
 *
 * The renumber runs as raw SQL, which means it does not touch `updatedAt` on
 * the cards that merely shifted up by one. That is the point: bumping every
 * lead in a column because a different lead moved would scramble the table's
 * "Last updated" sort every time anyone touched the board.
 */
export async function moveLeadOnBoard(
  actor: Actor,
  leadId: string,
  input: MoveLeadOnBoardInput,
): Promise<LeadDetailDto> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId, archivedAt: null },
    select: {
      id: true,
      assignedToId: true,
      createdById: true,
      stageId: true,
      stage: { select: { key: true } },
    },
  });
  if (!lead) throw notFound('Lead');
  assertCanMutateLead(actor, lead);

  if (input.precedingLeadId === leadId) {
    throw badRequest('A lead cannot be positioned relative to itself');
  }

  const destination = await prisma.pipelineStage.findUnique({
    where: { organizationId_key: { organizationId: actor.organizationId, key: input.stageKey } },
    select: { id: true, key: true, type: true },
  });
  if (!destination) {
    throw badRequest(`Pipeline stage "${input.stageKey}" is not configured for this workspace`);
  }

  const stageChanged = destination.id !== lead.stageId;

  await prisma.$transaction(async (tx) => {
    if (stageChanged) {
      await tx.lead.update({
        where: { id: leadId },
        data: {
          stageId: destination.id,
          ...stageTransitionData(destination, input.lostReason),
        },
        select: { id: true },
      });

      await recordActivity(tx, {
        organizationId: actor.organizationId,
        leadId,
        userId: actor.userId,
        type: 'STAGE_CHANGED',
        metadata: { fromStage: lead.stage.key, toStage: destination.key },
      });
    }

    // Every card in the destination column except the one being moved, in the
    // order the board currently renders them.
    const siblings = await tx.lead.findMany({
      where: {
        organizationId: actor.organizationId,
        stageId: destination.id,
        archivedAt: null,
        id: { not: leadId },
      },
      select: { id: true },
      orderBy: BOARD_ORDER,
    });

    const anchorIndex = input.precedingLeadId
      ? siblings.findIndex((sibling) => sibling.id === input.precedingLeadId)
      : -1;
    // `findIndex` returning -1 for a vanished anchor and "top of column" for no
    // anchor collapse to the same insertion point, which is the behaviour we want.
    const insertAt = anchorIndex + 1;

    const ordered = [
      ...siblings.slice(0, insertAt).map((sibling) => sibling.id),
      leadId,
      ...siblings.slice(insertAt).map((sibling) => sibling.id),
    ];

    const values = ordered.map((id, index) => Prisma.sql`(${id}, ${index})`);
    await tx.$executeRaw`
      UPDATE "leads" AS l
      SET "boardPosition" = v.pos::int
      FROM (VALUES ${Prisma.join(values)}) AS v(id, pos)
      WHERE l.id = v.id::text
        AND l."organizationId" = ${actor.organizationId}
    `;
  });

  return getLeadById(actor, leadId);
}
