import { z } from 'zod';
import type { LeadSource, StageKey, StageType } from './enums.js';
import type { FollowUpDto } from './followup.schema.js';

/**
 * Reporting windows.
 *
 * Deliberately short and fixed rather than a free date-range picker: every
 * range here has a *previous window of the same length* behind it, which is
 * what makes the "vs. previous 90 days" comparisons on the summary cards
 * meaningful. A custom range would need its own comparison rules.
 */
export const DASHBOARD_RANGES = ['30d', '90d', '12m'] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

export const DASHBOARD_RANGE_DAYS: Record<DashboardRange, number> = {
  '30d': 30,
  '90d': 90,
  '12m': 365,
};

export const dashboardQuerySchema = z.object({
  range: z.enum(DASHBOARD_RANGES).default('90d'),
});
export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;

/* ------------------------------------------------------------------ *
 * Response DTOs
 *
 * Two scopes live side by side on this dashboard, and the distinction is
 * deliberate rather than an oversight:
 *
 *  - **Windowed** — anything about what *happened*: leads created, deals
 *    closed, conversion, the trend chart, source attribution. These honour
 *    the selected range and carry a previous-window comparison.
 *  - **Snapshot** — anything about what *is*: open pipeline, the forecast,
 *    stage occupancy, follow-ups due. A pipeline is a current state; slicing
 *    it by a date range would answer a question nobody asked.
 *
 * Every card in the UI states which of the two it is.
 * ------------------------------------------------------------------ */

/** A windowed count or sum, against the equivalent preceding window. */
export interface DashboardDeltaDto {
  current: number;
  previous: number;
  /** Percent change, or `null` when the previous window was zero (∞ is not a trend). */
  changePct: number | null;
}

export interface DashboardSummaryDto {
  /* Snapshot */
  totalLeads: number;
  openLeads: number;
  /** Estimated value of every open lead. The optimistic number. */
  pipelineValue: number;
  /** Σ (open lead value × its stage's win probability). The honest number. */
  weightedPipelineValue: number;

  /* Windowed */
  newLeads: DashboardDeltaDto;
  wonLeads: DashboardDeltaDto;
  wonValue: DashboardDeltaDto;
  /**
   * Won ÷ (won + lost) among deals *closed inside the window*, as a percentage.
   * `null` when nothing closed — a rate over zero deals is not zero, it is unknown.
   */
  conversionRate: { current: number | null; previous: number | null; closed: number };
  /** Mean value of deals won in the window. */
  avgDealSize: number | null;
  /** Mean days from lead created to won, for deals won in the window. */
  avgDaysToClose: number | null;
}

/** Current occupancy of one pipeline stage. Snapshot, not windowed. */
export interface DashboardStageDto {
  key: StageKey;
  name: string;
  color: string;
  order: number;
  type: StageType;
  winProbability: number;
  count: number;
  value: number;
  /** `value × winProbability ÷ 100`. Zero for closed stages. */
  weightedValue: number;
  /** Mean days since the leads sitting here were created. */
  avgAgeDays: number | null;
}

/** Attribution for leads *created* inside the window. */
export interface DashboardSourceDto {
  source: LeadSource;
  total: number;
  open: number;
  won: number;
  lost: number;
  value: number;
  wonValue: number;
  /** Won ÷ closed for this source, or `null` when none of its leads have closed. */
  conversionRate: number | null;
}

export interface DashboardTrendPointDto {
  /** Bucket start, ISO. Weekly for 30d/90d, monthly for 12m. */
  bucket: string;
  /** Pre-formatted axis label, so the chart does not re-derive it per render. */
  label: string;
  created: number;
  won: number;
  wonValue: number;
}

/** Open follow-up workload. Snapshot — "what needs doing", not "what happened". */
export interface DashboardFollowUpsDto {
  overdue: number;
  today: number;
  thisWeek: number;
  later: number;
  /** The soonest pending follow-ups, each carrying its lead for the link out. */
  upcoming: FollowUpDto[];
}

export interface DashboardDto {
  range: DashboardRange;
  /** Start of the reporting window, ISO. */
  from: string;
  generatedAt: string;
  /** Workspace currency. Every figure here is in it. */
  currency: string;
  /** `week` or `month` — the bucket size behind `trend`. */
  trendBucket: 'week' | 'month';
  summary: DashboardSummaryDto;
  stages: DashboardStageDto[];
  sources: DashboardSourceDto[];
  trend: DashboardTrendPointDto[];
  followUps: DashboardFollowUpsDto;
}
