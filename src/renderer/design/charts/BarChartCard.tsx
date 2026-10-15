import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useReducedMotion } from '../../lib/useMedia';
import { ChartFrame, TooltipCard } from './ChartFrame';
import { useTokenColors } from './colors';

/**
 * A single-series column chart (e.g. pages per week) with an optional reference
 * value such as a target pace. Columns are ≤ 24px with 4px rounded data-ends.
 */
export function BarChartCard({
  title,
  summary,
  rows,
  color,
  seriesLabel,
  unit,
  reference,
  height = 200,
  format = (v) => String(Math.round(v * 10) / 10),
}: {
  title: string;
  summary: string;
  rows: { label: string; value: number; detail?: string }[];
  color: string;
  seriesLabel: string;
  unit: string;
  reference?: { value: number; label: string };
  height?: number;
  format?: (v: number) => string;
}) {
  const reduced = useReducedMotion();
  const c = useTokenColors(['rule', 'ink-faint', 'ink-muted', 'chart-reference'] as const);
  return (
    <ChartFrame
      title={title}
      summary={summary}
      legend={[
        { label: seriesLabel, color, kind: 'bar' },
        ...(reference
          ? [{ label: reference.label, color: c['chart-reference'], kind: 'line' as const }]
          : []),
      ]}
      table={{
        columns: ['Period', `${seriesLabel} (${unit})`],
        rows: rows.map((r) => [r.detail ?? r.label, format(r.value)]),
      }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={rows}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          barCategoryGap="30%"
        >
          <CartesianGrid vertical={false} stroke={c.rule} />
          <XAxis
            dataKey="label"
            tick={{ fill: c['ink-faint'], fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: c.rule }}
            interval="preserveStartEnd"
          />
          <YAxis
            width={32}
            allowDecimals={false}
            tick={{ fill: c['ink-faint'], fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: c.rule, opacity: 0.5 }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const first = payload[0] as
                { payload?: { label: string; value: number; detail?: string } } | undefined;
              const row = first?.payload;
              if (!active || !row) return null;
              return (
                <TooltipCard
                  heading={row.detail ?? row.label}
                  rows={[{ label: seriesLabel, value: `${format(row.value)} ${unit}`, color }]}
                />
              );
            }}
          />
          {reference ? (
            <ReferenceLine
              y={reference.value}
              stroke={c['chart-reference']}
              strokeWidth={1.5}
              ifOverflow="extendDomain"
            />
          ) : null}
          <Bar
            dataKey="value"
            fill={color}
            maxBarSize={24}
            radius={[4, 4, 0, 0]}
            isAnimationActive={!reduced}
            animationDuration={400}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
