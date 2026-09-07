import { DASHBOARD_RANGES, type DashboardRange } from '@leadpilot/shared';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarClock,
  CircleDollarSign,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorState } from '@/components/common/error-state';
import { readOne } from '@/lib/search-params';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useDashboard } from '@/features/dashboard/api';
import { KpiCard, KpiCardSkeleton } from '@/features/dashboard/components/kpi-card';
import { ChartCard, ChartSkeleton } from '@/features/dashboard/components/chart-frame';
import { TrendChart } from '@/features/dashboard/components/trend-chart';
import { StagePerformance } from '@/features/dashboard/components/stage-performance';
import { SourceBreakdown } from '@/features/dashboard/components/source-breakdown';
import { FollowUpSummary } from '@/features/dashboard/components/follow-up-summary';

const RANGE_LABELS: Record<DashboardRange, string> = {
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '12m': 'Last 12 months',
};

/** Short form, for the "vs. previous …" line under a comparison. */
const RANGE_NOUNS: Record<DashboardRange, string> = {
  '30d': '30 days',
  '90d': '90 days',
  '12m': 'year',
};

/**
 * The business dashboard.
 *
 * Two scopes share the screen, and each panel says which one it is on:
 *
 *  - **Windowed** — what happened in the selected range, with a comparison
 *    against the equivalent window before it.
 *  - **Right now** — the state of the pipeline and the follow-up workload,
 *    which are not usefully sliced by a date range. A deal that has sat in
 *    Proposal for six weeks is still in Proposal today.
 *
 * Nothing here is decorative: every figure is aggregated in Postgres from the
 * workspace's own leads, and every panel links back into the leads table with
 * the matching filter applied.
 */
export function DashboardPage() {
  const user = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();

  // The range lives in the URL so a particular view of the numbers can be
  // shared or bookmarked, exactly like a filtered leads list.
  const range = readOne(searchParams, 'range', DASHBOARD_RANGES, '90d');
  const setRange = (next: DashboardRange) => {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (next === '90d') params.delete('range');
        else params.set('range', next);
        return params;
      },
      { replace: true },
    );
  };

  const dashboardQuery = useDashboard(range);
  const data = dashboardQuery.data;
  const currency = data?.currency ?? user.organization.defaultCurrency;
  const isLoading = dashboardQuery.isLoading && !data;

  const rangeSelect = (
    <Select value={range} onValueChange={(value) => setRange(value as DashboardRange)}>
      <SelectTrigger className="w-[164px]" aria-label="Reporting period">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {DASHBOARD_RANGES.map((option) => (
          <SelectItem key={option} value={option}>
            {RANGE_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (dashboardQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <PageHeader title="Dashboard" description={user.organization.name} />
        <Card>
          <ErrorState
            error={dashboardQuery.error}
            onRetry={() => void dashboardQuery.refetch()}
            title="Could not load the dashboard"
          />
        </Card>
      </div>
    );
  }

  const summary = data?.summary;
  const previousNoun = RANGE_NOUNS[range];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Dashboard"
        description={
          data
            ? `${user.organization.name} · reporting from ${formatDate(data.from)}`
            : user.organization.name
        }
        actions={rangeSelect}
      />

      {/* --- Headline figures ------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {isLoading || !summary ? (
          Array.from({ length: 4 }, (_, index) => <KpiCardSkeleton key={index} />)
        ) : (
          <>
            <KpiCard
              label="New leads"
              value={formatNumber(summary.newLeads.current)}
              icon={Users}
              delta={summary.newLeads}
              hint={`vs. ${formatNumber(summary.newLeads.previous)} the previous ${previousNoun}`}
              explainer={`Leads created in the ${RANGE_LABELS[range].toLowerCase()}, compared with the ${previousNoun} before it.`}
            />
            <KpiCard
              label="Conversion rate"
              value={
                summary.conversionRate.current === null
                  ? '—'
                  : `${summary.conversionRate.current.toFixed(0)}%`
              }
              icon={Target}
              hint={
                summary.conversionRate.closed === 0
                  ? 'No deals closed in this period'
                  : summary.conversionRate.previous === null
                    ? `${formatNumber(summary.conversionRate.closed)} deals closed · no prior data`
                    : `${formatNumber(summary.conversionRate.closed)} deals closed · ${summary.conversionRate.previous.toFixed(0)}% the previous ${previousNoun}`
              }
              explainer="Deals won as a share of deals closed — won plus lost — inside the selected period. Open leads are excluded, because a deal that has not been decided is not a loss."
            />
            <KpiCard
              label="Expected revenue"
              value={formatCurrency(summary.weightedPipelineValue, currency)}
              icon={TrendingUp}
              tone="success"
              hint={`of ${formatCurrency(summary.pipelineValue, currency)} open pipeline`}
              explainer="Every open lead's value multiplied by its stage's win probability, then summed. A proposal counts for more than an untouched enquiry, so this lands well below the headline pipeline figure — deliberately."
            />
            <KpiCard
              label="Won revenue"
              value={formatCurrency(summary.wonValue.current, currency)}
              icon={CircleDollarSign}
              delta={summary.wonValue}
              tone="success"
              hint={
                summary.avgDealSize === null
                  ? `${formatNumber(summary.wonLeads.current)} deals`
                  : `${formatNumber(summary.wonLeads.current)} deals · ${formatCurrency(summary.avgDealSize, currency)} average`
              }
              explainer={`Value of deals marked Won in the ${RANGE_LABELS[range].toLowerCase()}.`}
            />
          </>
        )}
      </div>

      {/* --- Trend and follow-up workload -------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Lead flow and closed deals"
          description={`New leads per ${data?.trendBucket ?? 'week'} against deals won, over the ${RANGE_LABELS[range].toLowerCase()}.`}
        >
          {isLoading || !data ? (
            <ChartSkeleton height={280} />
          ) : (
            <TrendChart points={data.trend} currency={currency} bucket={data.trendBucket} />
          )}
        </ChartCard>

        <ChartCard
          title="Follow-ups"
          description="Open tasks right now — not affected by the reporting period."
        >
          {isLoading || !data ? (
            <ChartSkeleton height={280} />
          ) : (
            <FollowUpSummary followUps={data.followUps} />
          )}
        </ChartCard>
      </div>

      {/* --- Pipeline composition ---------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Pipeline by stage"
          description={
            summary
              ? `${formatNumber(summary.openLeads)} open leads right now · average time to close ${
                  summary.avgDaysToClose === null ? '—' : `${summary.avgDaysToClose} days`
                }`
              : 'Where the open pipeline is sitting right now.'
          }
        >
          {isLoading || !data ? (
            <ChartSkeleton height={300} />
          ) : (
            <StagePerformance stages={data.stages} currency={currency} />
          )}
        </ChartCard>

        <ChartCard
          title="Lead sources"
          description={`Where the ${RANGE_LABELS[range].toLowerCase()}' leads came from, and how well each source converts.`}
        >
          {isLoading || !data ? (
            <ChartSkeleton height={220} />
          ) : (
            <SourceBreakdown sources={data.sources} currency={currency} />
          )}
        </ChartCard>
      </div>

      {data && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" aria-hidden />
          Figures are in {currency}, the workspace currency. Pipeline and follow-up panels show
          the current state; everything else covers the selected period.
        </p>
      )}
    </div>
  );
}
