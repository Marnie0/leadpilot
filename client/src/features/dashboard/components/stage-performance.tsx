import { Link } from 'react-router-dom';
import { Bar, BarChart, Cell, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardStageDto } from '@leadpilot/shared';
import { formatCurrency, formatNumber } from '@/lib/format';
import { AXIS_PROPS, ChartFrame, ChartTooltip } from './chart-frame';

/**
 * How much value sits in each stage right now, and how much of it the forecast
 * actually counts.
 *
 * Two bars per stage rather than one: the full estimated value, and that value
 * weighted by the stage's win probability. The gap between them is the point of
 * the chart — it is the difference between what the pipeline is worth if
 * everything closes and what it is worth on the odds.
 */
export function StagePerformance({
  stages,
  currency,
}: {
  stages: DashboardStageDto[];
  currency: string;
}) {
  // Closed stages carry no forecast, and including them would dwarf the open
  // ones on the value axis with money that has already been decided.
  const openStages = stages.filter((stage) => stage.type === 'OPEN');

  return (
    <div className="space-y-4">
      <ChartFrame height={200}>
        <BarChart
          data={openStages}
          layout="vertical"
          margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
          barGap={2}
        >
          <XAxis
            type="number"
            {...AXIS_PROPS}
            // Three ticks: currency labels are wide, and five of them collide
            // into an unreadable smear at phone widths.
            tickCount={3}
            tickFormatter={(value: number) => formatCurrency(value, currency)}
          />
          <YAxis type="category" dataKey="name" {...AXIS_PROPS} width={80} />
          <Tooltip
            cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const stage = payload[0]?.payload as DashboardStageDto;
              return (
                <ChartTooltip
                  title={stage.name}
                  rows={[
                    { label: 'Leads', value: formatNumber(stage.count) },
                    {
                      label: 'Pipeline value',
                      value: formatCurrency(stage.value, currency),
                      color: stage.color,
                    },
                    {
                      label: `Weighted at ${stage.winProbability}%`,
                      value: formatCurrency(stage.weightedValue, currency),
                      color: stage.color,
                    },
                    {
                      label: 'Average age',
                      value: stage.avgAgeDays === null ? '—' : `${stage.avgAgeDays} days`,
                    },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="value" name="Pipeline value" radius={[0, 3, 3, 0]} maxBarSize={14}>
            {openStages.map((stage) => (
              <Cell key={stage.key} fill={stage.color} fillOpacity={0.28} />
            ))}
          </Bar>
          <Bar dataKey="weightedValue" name="Weighted" radius={[0, 3, 3, 0]} maxBarSize={14}>
            {openStages.map((stage) => (
              <Cell key={stage.key} fill={stage.color} />
            ))}
          </Bar>
        </BarChart>
      </ChartFrame>

      {/* Without this the two bars per stage are just "a big one and a small
          one", which is the opposite of the point they are making. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-foreground/25" aria-hidden />
          Pipeline value
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-foreground/70" aria-hidden />
          Weighted by the stage's win probability
        </span>
      </div>

      {/* The numbers behind the bars, including the closed stages the chart omits. */}
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-2 pb-2 text-left font-medium">Stage</th>
              <th className="px-2 pb-2 text-right font-medium">Leads</th>
              <th className="px-2 pb-2 text-right font-medium">Value</th>
              <th className="px-2 pb-2 text-right font-medium">Avg age</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => (
              <tr key={stage.key} className="border-t">
                <td className="px-2 py-2">
                  <Link
                    to={`/leads?stage=${stage.key}`}
                    className="inline-flex items-center gap-2 rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: stage.color }}
                      aria-hidden
                    />
                    <span className="truncate">{stage.name}</span>
                  </Link>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{formatNumber(stage.count)}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatCurrency(stage.value, currency)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                  {/*
                    Age is time since the lead was created, which only means
                    something while the deal is live. On a deal closed six
                    months ago it reads as "this has been sitting here for 180
                    days", which is the opposite of true.
                  */}
                  {stage.type !== 'OPEN' || stage.avgAgeDays === null
                    ? '—'
                    : `${stage.avgAgeDays}d`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
