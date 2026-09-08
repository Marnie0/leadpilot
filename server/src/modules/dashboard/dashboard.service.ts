import { Prisma } from '@prisma/client';
import type { StageType } from '@prisma/client';
import {
  DASHBOARD_RANGE_DAYS,
  type DashboardDeltaDto,
  type DashboardDto,
  type DashboardQueryInput,
  type DashboardSourceDto,
  type DashboardStageDto,
  type DashboardTrendPointDto,
  type LeadSource,
} from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { FOLLOW_UP_WITH_LEAD_SELECT, toFollowUpDto } from '../../lib/serializers.js';
import { endOfToday, startOfToday } from '../leads/lead-filters.js';
import type { Actor } from '../leads/leads.service.js';

/**
 * Business dashboard.
 *
 * Everything here is computed in the database — six aggregate queries and three
 * grouped scans, issued as one batch — rather than by loading leads into Node
 * and reducing over them. That matters for more than speed: an aggregate the
 * API can only produce by fetching every row is an aggregate that quietly stops
 * working at the size where anyone would care about it.
 *
 * ## The two scopes on this screen
 *
 * The range selector governs *what happened*: leads created, deals closed,
 * conversion, the trend line, source attribution. It deliberately does not
 * touch *what is*: open pipeline, the weighted forecast, stage occupancy and
 * follow-up workload are a snapshot of this moment. Filtering a pipeline by
 * "the last 30 days" would answer a question nobody asks — a deal that has sat
 * in Proposal for six weeks is still in Proposal today.
 *
 * Both scopes are labelled in the UI so the distinction is visible rather than
 * folklore.
 */

/** Rows produced by the per-stage snapshot scan. */
interface StageAggregateRow {
  stageId: string;
  count: number;
  value: number;
  avgAgeDays: number | null;
}

interface TrendRow {
  bucket: Date;
  count: number;
  value: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function subtractDays(from: Date, days: number): Date {
  return new Date(from.getTime() - days * DAY_MS);
}

/**
 * Truncates to the start of a bucket **in UTC**, matching Postgres `date_trunc`
 * on a `timestamp` column. Prisma stores `DateTime` as `timestamp(3)` without a
 * zone, holding UTC, so bucketing on either side agrees only if both use UTC.
 * Doing this in local time is the classic way to end up with a chart whose
 * zero-filled gaps sit half a day off the buckets the database returned.
 */
function truncateUtc(date: Date, bucket: 'week' | 'month'): Date {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (bucket === 'month') {
    return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  }
  // Postgres weeks start on Monday; JS `getUTCDay()` starts on Sunday.
  const mondayOffset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - mondayOffset);
  return day;
}

function advanceBucket(date: Date, bucket: 'week' | 'month'): Date {
  if (bucket === 'month') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  }
  return new Date(date.getTime() + 7 * DAY_MS);
}

function delta(current: number, previous: number): DashboardDeltaDto {
  return {
    current,
    previous,
    // A change from zero is not "infinite growth", it is a change with no
    // baseline. The UI renders `null` as "no prior data" rather than a number.
    changePct: previous === 0 ? null : ((current - previous) / previous) * 100,
  };
}

/** `won ÷ closed` as a percentage, or null when nothing closed. */
function rate(won: number, lost: number): number | null {
  const closed = won + lost;
  return closed === 0 ? null : (won / closed) * 100;
}

const round = (value: number, places = 1): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

export async function getDashboard(
  actor: Actor,
  query: DashboardQueryInput,
): Promise<DashboardDto> {
  const organizationId = actor.organizationId;
  const now = new Date();
  const windowDays = DASHBOARD_RANGE_DAYS[query.range];
  const trendBucket: 'week' | 'month' = query.range === '12m' ? 'month' : 'week';

  // Windows start at midnight so "last 30 days" means 30 whole days, not 30
  // days and however many hours have elapsed today.
  const from = subtractDays(startOfToday(), windowDays - 1);
  const previousFrom = subtractDays(from, windowDays);

  const inWindow = { gte: from };
  const inPreviousWindow = { gte: previousFrom, lt: from };
  /** Every non-archived lead in the workspace. The snapshot scope. */
  const live: Prisma.LeadWhereInput = { organizationId, archivedAt: null };

  const weekEnd = new Date(endOfToday().getTime() + 7 * DAY_MS);
  const pendingFollowUp = { organizationId, status: 'PENDING' } as const;

  const trendFrom = truncateUtc(from, trendBucket);

  const [
    [
      stages,
      organization,
      stageAggregates,
      createdCurrent,
      createdPrevious,
      wonCurrent,
      wonPrevious,
      lostCurrent,
      lostPrevious,
      closeTime,
      createdTrend,
      wonTrend,
      overdueCount,
      todayCount,
      weekCount,
      laterCount,
      upcoming,
    ],
    /* --- Attribution for leads created in the window -------------------- *
     * Grouped by source *and* stage in one pass: folding the stage types in
     * afterwards is what turns a single scan into won/lost/open per source.
     * Kept beside the batch rather than inside it because Prisma loses the
     * result typing of a grouped query nested in a `$transaction` array. */
    sourceGroups,
  ] = await Promise.all([
    prisma.$transaction([
      prisma.pipelineStage.findMany({
        where: { organizationId },
        select: {
          id: true,
          key: true,
          name: true,
          nameAr: true,
          color: true,
          order: true,
          type: true,
          winProbability: true,
        },
        orderBy: { order: 'asc' },
      }),
      prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { defaultCurrency: true },
      }),

      /* --- Snapshot: how each stage looks right now --------------------- *
       * Raw because the average age is a date arithmetic expression, which
       * Prisma's `groupBy` cannot express — `_avg` only takes numeric columns. */
      prisma.$queryRaw<StageAggregateRow[]>`
      SELECT "stageId",
             count(*)::int                                              AS "count",
             coalesce(sum("estimatedValue"), 0)::float8                  AS "value",
             avg(extract(epoch FROM (now() - "createdAt")) / 86400)::float8 AS "avgAgeDays"
      FROM "leads"
      WHERE "organizationId" = ${organizationId} AND "archivedAt" IS NULL
      GROUP BY "stageId"
    `,

      /* --- Windowed: what happened, and what happened before it ---------- */
      prisma.lead.count({ where: { ...live, createdAt: inWindow } }),
      prisma.lead.count({ where: { ...live, createdAt: inPreviousWindow } }),
      prisma.lead.aggregate({
        where: { ...live, wonAt: inWindow },
        _count: { _all: true },
        _sum: { estimatedValue: true },
      }),
      prisma.lead.aggregate({
        where: { ...live, wonAt: inPreviousWindow },
        _count: { _all: true },
        _sum: { estimatedValue: true },
      }),
      prisma.lead.count({ where: { ...live, lostAt: inWindow } }),
      prisma.lead.count({ where: { ...live, lostAt: inPreviousWindow } }),

      prisma.$queryRaw<Array<{ days: number | null }>>`
      SELECT avg(extract(epoch FROM ("wonAt" - "createdAt")) / 86400)::float8 AS "days"
      FROM "leads"
      WHERE "organizationId" = ${organizationId}
        AND "archivedAt" IS NULL
        AND "wonAt" >= ${from}
    `,

      prisma.$queryRaw<TrendRow[]>`
      SELECT date_trunc(${trendBucket}::text, "createdAt")     AS "bucket",
             count(*)::int                               AS "count",
             0::float8                                   AS "value"
      FROM "leads"
      WHERE "organizationId" = ${organizationId}
        AND "archivedAt" IS NULL
        AND "createdAt" >= ${trendFrom}
      GROUP BY 1
      ORDER BY 1
    `,
      prisma.$queryRaw<TrendRow[]>`
      SELECT date_trunc(${trendBucket}::text, "wonAt")         AS "bucket",
             count(*)::int                               AS "count",
             coalesce(sum("estimatedValue"), 0)::float8  AS "value"
      FROM "leads"
      WHERE "organizationId" = ${organizationId}
        AND "archivedAt" IS NULL
        AND "wonAt" >= ${trendFrom}
      GROUP BY 1
      ORDER BY 1
    `,

      /* --- Snapshot: open follow-up workload ------------------------------ */
      prisma.followUp.count({ where: { ...pendingFollowUp, dueAt: { lt: startOfToday() } } }),
      prisma.followUp.count({
        where: { ...pendingFollowUp, dueAt: { gte: startOfToday(), lte: endOfToday() } },
      }),
      prisma.followUp.count({
        where: { ...pendingFollowUp, dueAt: { gt: endOfToday(), lte: weekEnd } },
      }),
      prisma.followUp.count({ where: { ...pendingFollowUp, dueAt: { gt: weekEnd } } }),
      prisma.followUp.findMany({
        where: pendingFollowUp,
        select: FOLLOW_UP_WITH_LEAD_SELECT,
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
        take: 6,
      }),
    ] as const),
    prisma.lead.groupBy({
      by: ['source', 'stageId'],
      where: { ...live, createdAt: inWindow },
      _count: { _all: true },
      _sum: { estimatedValue: true },
    }),
  ]);

  /* --- Stage snapshot -------------------------------------------------- */

  const aggregateByStageId = new Map(stageAggregates.map((row) => [row.stageId, row]));
  const stageTypeById = new Map<string, StageType>(stages.map((stage) => [stage.id, stage.type]));

  const stageDtos: DashboardStageDto[] = stages.map((stage) => {
    const aggregate = aggregateByStageId.get(stage.id);
    const count = aggregate?.count ?? 0;
    const value = aggregate?.value ?? 0;
    return {
      key: stage.key,
      name: stage.name,
      nameAr: stage.nameAr,
      color: stage.color,
      order: stage.order,
      type: stage.type,
      winProbability: stage.winProbability,
      count,
      value,
      // Closed stages contribute nothing to a forecast: Won is already revenue
      // and Lost is not coming back.
      weightedValue: stage.type === 'OPEN' ? (value * stage.winProbability) / 100 : 0,
      avgAgeDays: count === 0 || aggregate?.avgAgeDays == null ? null : round(aggregate.avgAgeDays),
    };
  });

  const openStages = stageDtos.filter((stage) => stage.type === 'OPEN');
  const totalLeads = stageDtos.reduce((sum, stage) => sum + stage.count, 0);
  const openLeads = openStages.reduce((sum, stage) => sum + stage.count, 0);
  const pipelineValue = openStages.reduce((sum, stage) => sum + stage.value, 0);
  const weightedPipelineValue = openStages.reduce((sum, stage) => sum + stage.weightedValue, 0);

  /* --- Windowed summary ------------------------------------------------ */

  const wonCount = wonCurrent._count._all;
  const wonSum = wonCurrent._sum.estimatedValue?.toNumber() ?? 0;
  const previousWonSum = wonPrevious._sum.estimatedValue?.toNumber() ?? 0;
  const closedInWindow = wonCount + lostCurrent;
  const avgDaysToClose = closeTime[0]?.days ?? null;

  /* --- Source attribution ---------------------------------------------- */

  const bySource = new Map<LeadSource, DashboardSourceDto>();
  for (const group of sourceGroups) {
    const source = group.source as LeadSource;
    const entry = bySource.get(source) ?? {
      source,
      total: 0,
      open: 0,
      won: 0,
      lost: 0,
      value: 0,
      wonValue: 0,
      conversionRate: null,
    };

    const count = group._count._all;
    const value = group._sum.estimatedValue?.toNumber() ?? 0;
    entry.total += count;
    entry.value += value;

    switch (stageTypeById.get(group.stageId)) {
      case 'WON':
        entry.won += count;
        entry.wonValue += value;
        break;
      case 'LOST':
        entry.lost += count;
        break;
      default:
        entry.open += count;
    }

    bySource.set(source, entry);
  }

  const sources = [...bySource.values()]
    .map((entry) => ({ ...entry, conversionRate: rate(entry.won, entry.lost) }))
    .sort((a, b) => b.total - a.total || a.source.localeCompare(b.source));

  /* --- Trend ----------------------------------------------------------- *
   * Zero-filled here rather than in the chart: a line that simply skips a
   * quiet week draws a straight segment across it and overstates the gap. */

  const createdByBucket = new Map(createdTrend.map((row) => [row.bucket.getTime(), row.count]));
  const wonByBucket = new Map(wonTrend.map((row) => [row.bucket.getTime(), row]));

  const trend: DashboardTrendPointDto[] = [];
  const lastBucket = truncateUtc(now, trendBucket);
  for (
    let cursor = trendFrom;
    cursor.getTime() <= lastBucket.getTime();
    cursor = advanceBucket(cursor, trendBucket)
  ) {
    const key = cursor.getTime();
    const wonRow = wonByBucket.get(key);
    trend.push({
      bucket: cursor.toISOString(),
      created: createdByBucket.get(key) ?? 0,
      won: wonRow?.count ?? 0,
      wonValue: wonRow?.value ?? 0,
    });
  }

  return {
    range: query.range,
    from: from.toISOString(),
    generatedAt: now.toISOString(),
    currency: organization.defaultCurrency,
    trendBucket,
    summary: {
      totalLeads,
      openLeads,
      pipelineValue,
      weightedPipelineValue: round(weightedPipelineValue, 2),
      newLeads: delta(createdCurrent, createdPrevious),
      wonLeads: delta(wonCount, wonPrevious._count._all),
      wonValue: delta(wonSum, previousWonSum),
      conversionRate: {
        current: rate(wonCount, lostCurrent),
        previous: rate(wonPrevious._count._all, lostPrevious),
        closed: closedInWindow,
      },
      avgDealSize: wonCount === 0 ? null : wonSum / wonCount,
      avgDaysToClose: avgDaysToClose === null ? null : round(avgDaysToClose),
    },
    stages: stageDtos,
    sources,
    trend,
    followUps: {
      overdue: overdueCount,
      today: todayCount,
      thisWeek: weekCount,
      later: laterCount,
      upcoming: upcoming.map((row) => toFollowUpDto(row, actor)),
    },
  };
}
