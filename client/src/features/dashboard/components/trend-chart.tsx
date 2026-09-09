import { Area, Bar, CartesianGrid, ComposedChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardTrendPointDto } from '@leadpilot/shared';
import { EmptyState } from '@/components/common/empty-state';
import { LineChart } from 'lucide-react';
import { useFormat, useT } from '@/lib/i18n';
import { AXIS_PROPS, ChartFrame, ChartTooltip, SERIES, useChartDirection } from './chart-frame';

/**
 * New leads against deals won, over the reporting window.
 *
 * Two shapes rather than two lines: the volume of enquiries is a background
 * trend, the wins are discrete events. Drawing both as lines invites reading
 * them on the same scale, which they are not — there are always far more
 * enquiries than closes, so wins would sit flat against the axis.
 */
export function TrendChart({
  points,
  currency,
  bucket,
}: {
  points: DashboardTrendPointDto[];
  currency: string;
  bucket: 'week' | 'month';
}) {
  const t = useT();
  const format = useFormat();
  const direction = useChartDirection();

  const hasData = points.some((point) => point.created > 0 || point.won > 0);

  if (!hasData) {
    return (
      <EmptyState
        icon={LineChart}
        title={t('dashboard.trendEmptyTitle')}
        description={t('dashboard.trendEmptyBody')}
        className="flex-1 py-16"
      />
    );
  }

  // The axis label is derived here rather than sent by the API: the bucket is a
  // moment in time, and only the browser knows which language to name it in.
  const data = points.map((point) => ({
    ...point,
    label: format.trendLabel(point.bucket, bucket),
  }));

  return (
    <ChartFrame height="fill">
      <ComposedChart data={data} margin={{ top: 8, bottom: 0, ...direction.axisMargin(-12) }}>
        <defs>
          <linearGradient id="trend-created" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES.created} stopOpacity={0.28} />
            <stop offset="100%" stopColor={SERIES.created} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke="currentColor" strokeDasharray="3 3" vertical={false} opacity={0.5} />
        <XAxis
          dataKey="label"
          {...AXIS_PROPS}
          {...direction.categoryAxis}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          {...AXIS_PROPS}
          orientation={direction.valueAxisSide}
          allowDecimals={false}
          width={36}
        />

        <Tooltip
          cursor={{ stroke: 'currentColor', strokeOpacity: 0.35 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0]?.payload as (typeof data)[number];
            return (
              <ChartTooltip
                title={
                  bucket === 'month' ? point.label : t('dashboard.weekOf', { label: point.label })
                }
                rows={[
                  {
                    label: t('dashboard.newLeads'),
                    value: format.number(point.created),
                    color: SERIES.created,
                  },
                  {
                    label: t('dashboard.dealsWon'),
                    value: format.number(point.won),
                    color: SERIES.won,
                  },
                  {
                    label: t('dashboard.wonValue'),
                    value: format.currency(point.wonValue, currency),
                    color: SERIES.won,
                  },
                ]}
              />
            );
          }}
        />

        <Area
          type="monotone"
          dataKey="created"
          name={t('dashboard.newLeads')}
          stroke={SERIES.created}
          strokeWidth={2}
          fill="url(#trend-created)"
        />
        <Bar
          dataKey="won"
          name={t('dashboard.dealsWon')}
          fill={SERIES.won}
          radius={[3, 3, 0, 0]}
          maxBarSize={22}
        />
      </ComposedChart>
    </ChartFrame>
  );
}
