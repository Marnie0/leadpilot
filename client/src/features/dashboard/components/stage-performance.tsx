import { Link } from 'react-router-dom';
import { Bar, BarChart, Cell, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardStageDto } from '@leadpilot/shared';
import { stageName } from '@/lib/labels';
import { useFormat, useI18n } from '@/lib/i18n';
import { AXIS_PROPS, ChartFrame, ChartTooltip, useChartDirection } from './chart-frame';

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
  const { t, locale } = useI18n();
  const format = useFormat();
  const direction = useChartDirection();

  // Closed stages carry no forecast, and including them would dwarf the open
  // ones on the value axis with money that has already been decided.
  const openStages = stages
    .filter((stage) => stage.type === 'OPEN')
    .map((stage) => ({ ...stage, label: stageName(stage, locale) }));

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
            // The value axis grows away from the reading-start edge, so in
            // Arabic the bars run right to left like everything beside them.
            {...direction.categoryAxis}
            // Three ticks: currency labels are wide, and five of them collide
            // into an unreadable smear at phone widths.
            tickCount={3}
            tickFormatter={(value: number) => format.currency(value, currency)}
          />
          <YAxis
            type="category"
            dataKey="label"
            {...AXIS_PROPS}
            orientation={direction.valueAxisSide}
            width={80}
          />
          <Tooltip
            cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const stage = payload[0]?.payload as (typeof openStages)[number];
              return (
                <ChartTooltip
                  title={stage.label}
                  rows={[
                    { label: t('dashboard.tableLeads'), value: format.number(stage.count) },
                    {
                      label: t('dashboard.pipelineValue'),
                      value: format.currency(stage.value, currency),
                      color: stage.color,
                    },
                    {
                      label: t('dashboard.weightedAt', { percent: stage.winProbability }),
                      value: format.currency(stage.weightedValue, currency),
                      color: stage.color,
                    },
                    {
                      label: t('dashboard.averageAge'),
                      value:
                        stage.avgAgeDays === null
                          ? t('common.dash')
                          : t('common.days', { count: stage.avgAgeDays }),
                    },
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="value"
            name={t('dashboard.pipelineValue')}
            radius={direction.horizontalBarRadius}
            maxBarSize={14}
          >
            {openStages.map((stage) => (
              <Cell key={stage.key} fill={stage.color} fillOpacity={0.28} />
            ))}
          </Bar>
          <Bar
            dataKey="weightedValue"
            name={t('dashboard.weightedLegend')}
            radius={direction.horizontalBarRadius}
            maxBarSize={14}
          >
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
          {t('dashboard.pipelineValue')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-foreground/70" aria-hidden />
          {t('dashboard.weightedLegend')}
        </span>
      </div>

      {/* The numbers behind the bars, including the closed stages the chart omits. */}
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-2 pb-2 text-start font-medium">{t('dashboard.tableStage')}</th>
              <th className="px-2 pb-2 text-end font-medium">{t('dashboard.tableLeads')}</th>
              <th className="px-2 pb-2 text-end font-medium">{t('dashboard.tableValue')}</th>
              <th className="px-2 pb-2 text-end font-medium">{t('dashboard.tableAvgAge')}</th>
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
                    <span className="truncate">{stageName(stage, locale)}</span>
                  </Link>
                </td>
                <td className="px-2 py-2 text-end tabular-nums">{format.number(stage.count)}</td>
                <td className="px-2 py-2 text-end tabular-nums">
                  {format.currency(stage.value, currency)}
                </td>
                <td className="px-2 py-2 text-end text-muted-foreground tabular-nums">
                  {/*
                    Age is time since the lead was created, which only means
                    something while the deal is live. On a deal closed six
                    months ago it reads as "this has been sitting here for 180
                    days", which is the opposite of true.
                  */}
                  {stage.type !== 'OPEN' || stage.avgAgeDays === null
                    ? t('common.dash')
                    : t('common.daysShort', { count: stage.avgAgeDays })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
