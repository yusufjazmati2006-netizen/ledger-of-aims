import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  formatDate,
  formatMonthYear,
  fromDayNumber,
  toDayNumber,
} from '@shared/domain/time/localDate';
import { useReducedMotion } from '../../lib/useMedia';
import { ChartFrame, TooltipCard } from './ChartFrame';
import { useTokenColors } from './colors';

export interface TimeSeries {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
  /** Reference series (targets) draw thinner. */
  reference?: boolean;
  /** Draw unconnected dots (e.g. raw weigh-ins) instead of a line. */
  dots?: boolean;
  points: { date: string; value: number }[];
}

type Row = { t: number } & Record<string, number | undefined>;

/**
 * A single-axis time-series line chart: 2px lines, hairline grid, a crosshair
 * tooltip listing every series at the hovered date, and a "today" marker.
 */
export function TimeChart({
  title,
  summary,
  series,
  today,
  unit,
  format = (v) => v.toFixed(0),
  height = 230,
  yDomain = ['auto', 'auto'],
  yTicks,
}: {
  title: string;
  summary: string;
  series: TimeSeries[];
  today?: string;
  unit: string;
  format?: (value: number) => string;
  height?: number;
  yDomain?: [number | 'auto', number | 'auto'];
  yTicks?: number[];
}) {
  const reduced = useReducedMotion();
  const c = useTokenColors(['rule', 'ink-faint', 'surface', 'ink-muted'] as const);

  const byT = new Map<number, Row>();
  for (const s of series) {
    for (const p of s.points) {
      const t = toDayNumber(p.date);
      const row = byT.get(t) ?? { t };
      row[s.key] = p.value;
      byT.set(t, row);
    }
  }
  const rows = [...byT.values()].sort((a, b) => a.t - b.t);
  const minT = rows[0]?.t ?? 0;
  const maxT = rows[rows.length - 1]?.t ?? 1;
  const ticks = monthTicks(minT, maxT);

  return (
    <ChartFrame
      title={title}
      summary={summary}
      legend={series.map((s) => ({
        label: s.label,
        color: s.color,
        kind: s.dots ? 'dot' : s.dashed ? 'dashed' : 'line',
      }))}
      table={{
        columns: ['Date', ...series.map((s) => `${s.label} (${unit})`)],
        rows: rows.map((r) => [
          formatDate(fromDayNumber(r.t)),
          ...series.map((s) => {
            const v = r[s.key];
            return v === undefined ? '—' : format(v);
          }),
        ]),
      }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          accessibilityLayer={false}
          data={rows}
          margin={{ top: 22, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} stroke={c.rule} strokeWidth={1} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[minT, maxT]}
            ticks={ticks}
            tickFormatter={(t: number) => formatMonthYear(fromDayNumber(t))}
            tick={{ fill: c['ink-faint'], fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: c.rule }}
          />
          <YAxis
            domain={yDomain}
            ticks={yTicks}
            width={44}
            tick={{ fill: c['ink-faint'], fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => format(v)}
            allowDecimals={false}
          />
          {today ? (
            <ReferenceLine
              x={toDayNumber(today)}
              stroke={c['ink-faint']}
              strokeWidth={1}
              label={{ value: 'Today', position: 'top', fill: c['ink-muted'], fontSize: 11 }}
            />
          ) : null}
          <Tooltip
            cursor={{ stroke: c['ink-faint'], strokeWidth: 1 }}
            isAnimationActive={false}
            content={({ active, label, payload }) => {
              if (!active || typeof label !== 'number') return null;
              const values = payload as
                readonly { dataKey?: unknown; value?: unknown }[] | undefined;
              const lines = series.flatMap((s) => {
                const hit = values?.find((p) => p.dataKey === s.key);
                return typeof hit?.value === 'number'
                  ? [
                      {
                        label: s.label,
                        value: `${format(hit.value)} ${unit}`,
                        color: s.color,
                        dashed: s.dashed,
                      },
                    ]
                  : [];
              });
              return lines.length ? (
                <TooltipCard heading={formatDate(fromDayNumber(label))} rows={lines} />
              ) : null;
            }}
          />
          {series.map((s) =>
            s.dots ? (
              <Line
                key={s.key}
                dataKey={s.key}
                type="linear"
                stroke="transparent"
                strokeWidth={0}
                dot={{ r: 2.5, fill: s.color, stroke: 'none', fillOpacity: 0.55 }}
                activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2, fill: s.color }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={s.key}
                dataKey={s.key}
                type="linear"
                stroke={s.color}
                strokeWidth={s.reference ? 1.5 : 2}
                strokeDasharray={s.dashed ? '5 4' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2, fill: s.color }}
                connectNulls
                isAnimationActive={!reduced}
                animationDuration={500}
              />
            ),
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** First-of-month ticks across the range, thinned to at most ~8 labels. */
function monthTicks(minT: number, maxT: number): number[] {
  const ticks: number[] = [];
  const start = fromDayNumber(minT);
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7)) + 1;
  for (;;) {
    if (m > 12) {
      m = 1;
      y++;
    }
    const t = toDayNumber(`${y}-${String(m).padStart(2, '0')}-01`);
    if (t > maxT) break;
    ticks.push(t);
    m++;
  }
  const step = Math.max(1, Math.ceil(ticks.length / 8));
  return ticks.filter((_, i) => i % step === 0);
}
