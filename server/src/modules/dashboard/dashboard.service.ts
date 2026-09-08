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
import { convertedSum, currenciesIn, moneyContext, totalFrom } from '../../lib/money-totals.js';
import { comparableAmount } from '@leadpilot/shared';
import { FOLLOW_UP_WITH_LEAD_SELECT, toFollowUpDto } from '../../lib/serializers.js';
import { dayWindow, normaliseTimeZone } from '../../lib/day-window.js';
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
  /** One row per stage *per currency* — see `lib/money-totals.ts`. */
  currency: string;
  count: number;
  value: number;
  avgAgeDays: number | null;
}

/**
 * A currency-grouped won/lost aggregate.
 *
 * Declared explicitly because these `groupBy` calls sit inside a large
 * `Promise.all([...] as const`, and Prisma's conditional result types do not
 * survive that — the tuple widens `_sum` and `_count` back to their optional
 * forms. Naming the shape here is clearer than casting at four call sites.
 */
interface WonGroupRow {
  currency: string;
  _count: { _all: number };
  _sum: { estimatedValue: Prisma.Decimal | null };
}

interface TrendRow {
  bucket: Date;
  /** Only present on the won-value series, which is money. */
  currency?: string;
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

  // Windows start at midnight *in the reader's timezone* so "last 30 days"
  // means 30 whole days of their calendar, not 30 days and however many hours
  // have elapsed wherever this process happens to run.
  const { startOfToday, endOfToday, weekEnd } = dayWindow(normaliseTimeZone(query.tz), now);
  const from = subtractDays(startOfToday, windowDays - 1);
  const previousFrom = subtractDays(from, windowDays);

  const inWindow = { gte: from };
  const inPreviousWindow = { gte: previousFrom, lt: from };
  /** Every non-archived lead in the workspace. The snapshot scope. */
  const live: Prisma.LeadWhereInput = { organizationId, archivedAt: null, deletedAt: null };

  // Trashed follow-ups are gone as far as every count is concerned.
  const pendingFollowUp = {
    organizationId,
    status: 'PENDING',
    deletedAt: null,
    lead: { deletedAt: null },
  } satisfies Prisma.FollowUpWhereInput;

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
             "currency",
             count(*)::int                                              AS "count",
             coalesce(sum("estimatedValue"), 0)::float8                  AS "value",
             avg(extract(epoch FROM (now() - "createdAt")) / 86400)::float8 AS "avgAgeDays"
      FROM "leads"
      WHERE "organizationId" = ${organizationId} AND "archivedAt" IS NULL AND "deletedAt" IS NULL
      GROUP BY "stageId", "currency"
    `,

      /* --- Windowed: what happened, and what happened before it ---------- */
      prisma.lead.count({ where: { ...live, createdAt: inWindow } }),
      prisma.lead.count({ where: { ...live, createdAt: inPreviousWindow } }),
      prisma.lead.groupBy({
        by: ['currency'],
        where: { ...live, wonAt: inWindow },
        _count: { _all: true },
        _sum: { estimatedValue: true },
        orderBy: { currency: 'asc' },
      }),
      prisma.lead.groupBy({
        by: ['currency'],
        where: { ...live, wonAt: inPreviousWindow },
        _count: { _all: true },
        _sum: { estimatedValue: true },
        orderBy: { currency: 'asc' },
      }),
      prisma.lead.count({ where: { ...live, lostAt: inWindow } }),
      prisma.lead.count({ where: { ...live, lostAt: inPreviousWindow } }),

      prisma.$queryRaw<Array<{ days: number | null }>>`
      SELECT avg(extract(epoch FROM ("wonAt" - "createdAt")) / 86400)::float8 AS "days"
      FROM "leads"
      WHERE "organizationId" = ${organizationId}
        AND "archivedAt" IS NULL AND "deletedAt" IS NULL
        AND "wonAt" >= ${from}
    `,

      prisma.$queryRaw<TrendRow[]>`
      SELECT date_trunc(${trendBucket}::text, "createdAt")     AS "bucket",
             count(*)::int                               AS "count",
             0::float8                                   AS "value"
      FROM "leads"
      WHERE "organizationId" = ${organizationId}
        AND "archivedAt" IS NULL AND "deletedAt" IS NULL
        AND "createdAt" >= ${trendFrom}
      GROUP BY 1
      ORDER BY 1
    `,
      prisma.$queryRaw<TrendRow[]>`
      SELECT date_trunc(${trendBucket}::text, "wonAt")         AS "bucket",
             "currency",
             count(*)::int                               AS "count",
             coalesce(sum("estimatedValue"), 0)::float8  AS "value"
      FROM "leads"
      WHERE "organizationId" = ${organizationId}
        AND "archivedAt" IS NULL AND "deletedAt" IS NULL
        AND "wonAt" >= ${trendFrom}
      GROUP BY 1, 2
      ORDER BY 1
    `,

      /* --- Snapshot: open follow-up workload ------------------------------ */
      prisma.followUp.count({ where: { ...pendingFollowUp, dueAt: { lt: startOfToday } } }),
      prisma.followUp.count({
        where: { ...pendingFollowUp, dueAt: { gte: startOfToday, lte: endOfToday } },
      }),
      prisma.followUp.count({
        where: { ...pendingFollowUp, dueAt: { gt: endOfToday, lte: weekEnd } },
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
      by: ['source', 'stageId', 'currency'],
      where: { ...live, createdAt: inWindow },
      _count: { _all: true },
      _sum: { estimatedValue: true },
    }),
  ]);

  /* --- Stage snapshot -------------------------------------------------- */

  const money = await moneyContext(query.display, organization.defaultCurrency);
  const stageTypeById = new Map<string, StageType>(stages.map((stage) => [stage.id, stage.type]));

  // One stage now arrives as several rows, one per currency it holds.
  const stageRows = new Map<string, StageAggregateRow[]>();
  for (const row of stageAggregates) {
    stageRows.set(row.stageId, [...(stageRows.get(row.stageId) ?? []), row]);
  }

  const stageDtos: DashboardStageDto[] = stages.map((stage) => {
    const rows = stageRows.get(stage.id) ?? [];
    const count = rows.reduce((sum, row) => sum + row.count, 0);
    const total = totalFrom(
      rows.map((row) => ({ currency: row.currency, amount: row.value })),
      money,
    );
    // Weighted across currencies rather than per currency: a forecast is one
    // number by nature, and the probability is a property of the stage, not of
    // the currency a lead happens to be quoted in.
    const weighted =
      stage.type === 'OPEN' ? (comparableAmount(total) * stage.winProbability) / 100 : 0;
    // A mean of per-row means, weighted by the rows behind each — the plain
    // average of the averages would let a stage's one EUR lead count as much as
    // its forty AED ones.
    const aged = rows.filter((row) => row.avgAgeDays != null && row.count > 0);
    const agedCount = aged.reduce((sum, row) => sum + row.count, 0);
    const avgAgeDays =
      agedCount === 0
        ? null
        : round(aged.reduce((sum, row) => sum + (row.avgAgeDays ?? 0) * row.count, 0) / agedCount);

    return {
      key: stage.key,
      name: stage.name,
      nameAr: stage.nameAr,
      color: stage.color,
      order: stage.order,
      type: stage.type,
      winProbability: stage.winProbability,
      count,
      value: total,
      // Closed stages contribute nothing to a forecast: Won is already revenue
      // and Lost is not coming back.
      weightedValue: weighted,
      avgAgeDays,
    };
  });

  const openStageIds = new Set(stages.filter((s) => s.type === 'OPEN').map((s) => s.id));
  const openRows = stageAggregates.filter((row) => openStageIds.has(row.stageId));
  const openStages = stageDtos.filter((stage) => stage.type === 'OPEN');
  const totalLeads = stageDtos.reduce((sum, stage) => sum + stage.count, 0);
  const openLeads = openStages.reduce((sum, stage) => sum + stage.count, 0);
  const pipelineValue = totalFrom(
    openRows.map((row) => ({ currency: row.currency, amount: row.value })),
    money,
  );
  const weightedPipelineValue = openStages.reduce((sum, stage) => sum + stage.weightedValue, 0);

  /* --- Windowed summary ------------------------------------------------ */

  const wonRows = (wonCurrent as WonGroupRow[]).map((row) => ({
    currency: row.currency,
    amount: row._sum.estimatedValue?.toNumber() ?? 0,
  }));
  const previousWonRows = (wonPrevious as WonGroupRow[]).map((row) => ({
    currency: row.currency,
    amount: row._sum.estimatedValue?.toNumber() ?? 0,
  }));
  const wonCount = (wonCurrent as WonGroupRow[]).reduce((sum, row) => sum + row._count._all, 0);
  const previousWonCount = (wonPrevious as WonGroupRow[]).reduce(
    (sum, row) => sum + row._count._all,
    0,
  );
  const wonTotal = totalFrom(wonRows, money);
  // A delta is a single number by nature, so it uses the comparable figure —
  // see `comparableAmount`. `wonValueTotal` beside it carries the breakdown.
  const wonSum = comparableAmount(wonTotal);
  const previousWonSum = convertedSum(previousWonRows, money);
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
    // Converted per row: `group` is now one source × stage × currency, so
    // adding the raw figure would mix units inside one source's total.
    const value = convertedSum(
      [{ currency: group.currency, amount: group._sum.estimatedValue?.toNumber() ?? 0 }],
      money,
    );
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

  // A chart line is one number per bucket, so the won-value series converts
  // rather than breaking down — but it converts each currency separately and
  // adds, which is not the same as summing mixed units and hoping.
  const wonByBucket = new Map<number, { count: number; value: number }>();
  for (const row of wonTrend) {
    const key = row.bucket.getTime();
    const entry = wonByBucket.get(key) ?? { count: 0, value: 0 };
    entry.count += row.count;
    entry.value += convertedSum([{ currency: row.currency ?? '', amount: row.value }], money);
    wonByBucket.set(key, entry);
  }

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
    displayCurrency: money.target,
    currencies: currenciesIn(stageAggregates, money),
    trendBucket,
    summary: {
      totalLeads,
      openLeads,
      pipelineValue,
      weightedPipelineValue: round(weightedPipelineValue, 2),
      wonValueTotal: wonTotal,
      newLeads: delta(createdCurrent, createdPrevious),
      wonLeads: delta(wonCount, previousWonCount),
      wonValue: delta(wonSum, previousWonSum),
      conversionRate: {
        current: rate(wonCount, lostCurrent),
        previous: rate(previousWonCount, lostPrevious),
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
