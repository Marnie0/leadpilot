import { DASHBOARD_RANGES, type DashboardRange } from '@leadpilot/shared';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, CircleDollarSign, Target, TrendingUp, Users } from 'lucide-react';
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
import { useFormat, useT } from '@/lib/i18n';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useDashboard } from '@/features/dashboard/api';
import { KpiCard, KpiCardSkeleton } from '@/features/dashboard/components/kpi-card';
import { ChartCard, ChartSkeleton } from '@/features/dashboard/components/chart-frame';
import { TrendChart } from '@/features/dashboard/components/trend-chart';
import { StagePerformance } from '@/features/dashboard/components/stage-performance';
import { SourceBreakdown } from '@/features/dashboard/components/source-breakdown';
import { FollowUpSummary } from '@/features/dashboard/components/follow-up-summary';

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
  const t = useT();
  const format = useFormat();
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

  /*
   * Three phrasings of the same window live in the dictionary, because a label
   * is not a sentence: `range.*` ("Last 90 days") heads the picker,
   * `rangeInline.*` reads inside a description, and `previous.*` is the bare
   * noun a comparison hangs off. English can get away with lower-casing one to
   * make another — `.toLowerCase()` was doing exactly that — but Arabic has no
   * case to lower, so each form is written out.
   */
  const rangeInline = t(`dashboard.rangeInline.${range}`);
  const previousNoun = t(`dashboard.previous.${range}`);

  const rangeSelect = (
    <Select value={range} onValueChange={(value) => setRange(value as DashboardRange)}>
      <SelectTrigger className="w-[164px]" aria-label={t('dashboard.period')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {DASHBOARD_RANGES.map((option) => (
          <SelectItem key={option} value={option}>
            {t(`dashboard.range.${option}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (dashboardQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <PageHeader title={t('dashboard.title')} description={user.organization.name} />
        <Card>
          <ErrorState
            error={dashboardQuery.error}
            onRetry={() => void dashboardQuery.refetch()}
            title={t('dashboard.couldNotLoad')}
          />
        </Card>
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title={t('dashboard.title')}
        description={
          data
            ? t('dashboard.reportingFrom', {
                organization: user.organization.name,
                date: format.date(data.from),
              })
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
              label={t('dashboard.newLeads')}
              value={format.number(summary.newLeads.current)}
              icon={Users}
              delta={summary.newLeads}
              hint={t('dashboard.newLeadsHint', {
                count: format.number(summary.newLeads.previous),
                period: previousNoun,
              })}
              explainer={t('dashboard.newLeadsExplainer', {
                range: rangeInline,
                period: previousNoun,
              })}
            />
            <KpiCard
              label={t('dashboard.conversionRate')}
              value={
                summary.conversionRate.current === null
                  ? t('common.dash')
                  : format.percent(summary.conversionRate.current)
              }
              icon={Target}
              hint={
                summary.conversionRate.closed === 0
                  ? t('dashboard.conversionNone')
                  : summary.conversionRate.previous === null
                    ? t('dashboard.conversionNoPrior', {
                        count: format.number(summary.conversionRate.closed),
                      })
                    : t('dashboard.conversionHint', {
                        count: format.number(summary.conversionRate.closed),
                        rate: summary.conversionRate.previous.toFixed(0),
                        period: previousNoun,
                      })
              }
              explainer={t('dashboard.conversionExplainer')}
            />
            <KpiCard
              label={t('dashboard.expectedRevenue')}
              value={format.currency(summary.weightedPipelineValue, currency)}
              icon={TrendingUp}
              tone="success"
              hint={t('dashboard.expectedRevenueHint', {
                value: format.currency(summary.pipelineValue, currency),
              })}
              explainer={t('dashboard.expectedRevenueExplainer')}
            />
            <KpiCard
              label={t('dashboard.wonRevenue')}
              value={format.currency(summary.wonValue.current, currency)}
              icon={CircleDollarSign}
              delta={summary.wonValue}
              tone="success"
              hint={
                summary.avgDealSize === null
                  ? t('dashboard.wonRevenueHint', {
                      count: format.number(summary.wonLeads.current),
                    })
                  : t('dashboard.wonRevenueHintAvg', {
                      count: format.number(summary.wonLeads.current),
                      average: format.currency(summary.avgDealSize, currency),
                    })
              }
              explainer={t('dashboard.wonRevenueExplainer', { range: rangeInline })}
            />
          </>
        )}
      </div>

      {/* --- Trend and follow-up workload -------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title={t('dashboard.trendTitle')}
          description={t('dashboard.trendDescription', {
            bucket: t(`dashboard.bucket.${data?.trendBucket ?? 'week'}`),
            range: rangeInline,
          })}
        >
          {isLoading || !data ? (
            <ChartSkeleton height={280} />
          ) : (
            <TrendChart points={data.trend} currency={currency} bucket={data.trendBucket} />
          )}
        </ChartCard>

        <ChartCard
          title={t('dashboard.followUpsTitle')}
          description={t('dashboard.followUpsDescription')}
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
          title={t('dashboard.stagesTitle')}
          description={
            summary
              ? t('dashboard.stagesDescription', {
                  count: format.number(summary.openLeads),
                  days:
                    summary.avgDaysToClose === null
                      ? t('common.dash')
                      : t('common.days', { count: summary.avgDaysToClose }),
                })
              : t('dashboard.stagesFallback')
          }
        >
          {isLoading || !data ? (
            <ChartSkeleton height={300} />
          ) : (
            <StagePerformance stages={data.stages} currency={currency} />
          )}
        </ChartCard>

        <ChartCard
          title={t('dashboard.sourcesTitle')}
          description={t('dashboard.sourcesDescription', { range: rangeInline })}
        >
          {isLoading || !data ? (
            <ChartSkeleton height={220} />
          ) : (
            <SourceBreakdown sources={data.sources} currency={currency} />
          )}
        </ChartCard>
      </div>

      {data && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('dashboard.footnote', { currency })}
        </p>
      )}
    </div>
  );
}
