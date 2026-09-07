import { Area, Bar, CartesianGrid, ComposedChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardTrendPointDto } from '@leadpilot/shared';
import { EmptyState } from '@/components/common/empty-state';
import { LineChart } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/format';
import { AXIS_PROPS, ChartFrame, ChartTooltip, SERIES } from './chart-frame';

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
  const hasData = points.some((point) => point.created > 0 || point.won > 0);

  if (!hasData) {
    return (
      <EmptyState
        icon={LineChart}
        title="Nothing in this window"
        description="No leads were created and no deals closed in the period selected."
        className="flex-1 py-16"
      />
    );
  }

  return (
    <ChartFrame height="fill">
      <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="trend-created" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES.created} stopOpacity={0.28} />
            <stop offset="100%" stopColor={SERIES.created} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke="currentColor" strokeDasharray="3 3" vertical={false} opacity={0.5} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...AXIS_PROPS} allowDecimals={false} width={36} />

        <Tooltip
          cursor={{ stroke: 'currentColor', strokeOpacity: 0.35 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0]?.payload as DashboardTrendPointDto;
            return (
              <ChartTooltip
                title={bucket === 'month' ? point.label : `Week of ${point.label}`}
                rows={[
                  {
                    label: 'New leads',
                    value: formatNumber(point.created),
                    color: SERIES.created,
                  },
                  { label: 'Deals won', value: formatNumber(point.won), color: SERIES.won },
                  {
                    label: 'Won value',
                    value: formatCurrency(point.wonValue, currency),
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
          name="New leads"
          stroke={SERIES.created}
          strokeWidth={2}
          fill="url(#trend-created)"
        />
        <Bar
          dataKey="won"
          name="Deals won"
          fill={SERIES.won}
          radius={[3, 3, 0, 0]}
          maxBarSize={22}
        />
      </ComposedChart>
    </ChartFrame>
  );
}
