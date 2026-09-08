import { Link } from 'react-router-dom';
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import type { DashboardSourceDto } from '@leadpilot/shared';
import { PieChart as PieChartIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { useFormat, useT } from '@/lib/i18n';
import { useMoney } from '@/lib/money';
import { ChartFrame, ChartTooltip } from './chart-frame';

/**
 * Palette for the source ring.
 *
 * Sources have no colour of their own in the data model — unlike stages, which
 * carry a hex per tenant — so the ring assigns one by rank. Ordering the API
 * response by volume keeps a given source in the same slice colour between
 * renders, which is what stops the chart flickering a new palette on refresh.
 */
const SLICE_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
  '#f43f5e',
];

/** Beyond this the ring stops being readable, so the tail is grouped. */
const MAX_SLICES = 7;

export function SourceBreakdown({
  sources,
  currency,
}: {
  sources: DashboardSourceDto[];
  currency: string;
}) {
  const t = useT();
  const format = useFormat();
  const money = useMoney();

  if (sources.length === 0) {
    return (
      <EmptyState
        icon={PieChartIcon}
        title={t('dashboard.sourcesEmptyTitle')}
        description={t('dashboard.sourcesEmptyBody')}
        className="py-16"
      />
    );
  }

  const head = sources.slice(0, MAX_SLICES);
  const tail = sources.slice(MAX_SLICES);

  const slices = [
    ...head.map((source, index) => ({
      key: source.source as string,
      label: t(`source.${source.source}`),
      total: source.total,
      value: source.value,
      conversionRate: source.conversionRate,
      closed: source.won + source.lost,
      won: source.won,
      color: SLICE_COLORS[index % SLICE_COLORS.length] as string,
    })),
    ...(tail.length > 0
      ? [
          {
            key: '__other__',
            label: t('dashboard.otherSources', { count: format.number(tail.length) }),
            total: tail.reduce((sum, source) => sum + source.total, 0),
            value: tail.reduce((sum, source) => sum + source.value, 0),
            conversionRate: null,
            closed: 0,
            won: 0,
            color: '#94a3b8',
          },
        ]
      : []),
  ];

  const totalLeads = slices.reduce((sum, slice) => sum + slice.total, 0);

  return (
    <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
      {/* A ring needs no direction handling: it has no start edge to mirror. */}
      <ChartFrame height={180}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="total"
            nameKey="label"
            innerRadius={48}
            outerRadius={78}
            paddingAngle={2}
            strokeWidth={0}
          >
            {slices.map((slice) => (
              <Cell key={slice.key} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const slice = payload[0]?.payload as (typeof slices)[number];
              return (
                <ChartTooltip
                  title={slice.label}
                  rows={[
                    {
                      label: t('dashboard.tableLeads'),
                      value: t('dashboard.leadsWithShare', {
                        count: format.number(slice.total),
                        share: Math.round((slice.total / totalLeads) * 100),
                      }),
                      color: slice.color,
                    },
                    {
                      label: t('dashboard.tableValue'),
                      value: money.format(slice.value, currency),
                    },
                    ...(slice.conversionRate === null
                      ? []
                      : [
                          {
                            // The denominator matters: "100%" off a single
                            // closed deal is not the same claim as "100%" off
                            // twenty, and the ring cannot show the difference.
                            label: t('dashboard.conversion'),
                            value: t('dashboard.conversionOfClosed', {
                              rate: slice.conversionRate.toFixed(0),
                              closed: format.number(slice.closed),
                            }),
                          },
                        ]),
                  ]}
                />
              );
            }}
          />
        </PieChart>
      </ChartFrame>

      <ul className="min-w-0 space-y-1.5">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: slice.color }}
              aria-hidden
            />
            {slice.key === '__other__' ? (
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{slice.label}</span>
            ) : (
              <Link
                to={`/leads?source=${slice.key}`}
                className="min-w-0 flex-1 truncate rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {slice.label}
              </Link>
            )}
            <span className="shrink-0 tabular-nums">{format.number(slice.total)}</span>
            <span className="w-12 shrink-0 text-end text-xs text-muted-foreground tabular-nums">
              {slice.conversionRate === null
                ? t('common.dash')
                : format.percent(slice.conversionRate)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
