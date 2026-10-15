import { useState } from 'react';
import { addDays, diffDays, formatDate, maxDate } from '@shared/domain/time/localDate';
import { useSettings } from '../../stores/app';
import { formatWeight, kgToUnit } from '../../lib/units';
import { Card, Note, Pill, SectionTitle, Stat, type PillTone } from '../../design/Card';
import { SegmentedControl } from '../../design/Field';
import { Meter } from '../../design/Ring';
import { TimeChart } from '../../design/charts/TimeChart';
import { useTokenColors } from '../../design/charts/colors';
import type { RateStatus } from '@shared/domain/physique/trend';
import { targetWeightAt } from '@shared/domain/physique/trajectory';
import { usePhysique } from './usePhysique';
import { WeighInForm } from './WeighInForm';

const RANGES = { '30': 30, '90': 90, '365': 365, all: 0 } as const;
type Range = keyof typeof RANGES;

const RATE_TONE: Record<RateStatus, PillTone> = {
  'on-pace': 'positive',
  'too-fast': 'warning',
  'too-slow': 'warning',
  'insufficient-data': 'neutral',
};
const RATE_LABEL: Record<RateStatus, string> = {
  'on-pace': 'On pace',
  'too-fast': 'Too fast',
  'too-slow': 'Too slow',
  'insufficient-data': 'Not enough data',
};

export function WeightPage() {
  const view = usePhysique();
  const settings = useSettings();
  const unit = settings.general.units;
  const colors = useTokenColors(['physique', 'chart-reference'] as const);
  const [range, setRange] = useState<Range>('90');
  const { today, latest } = view;

  const first = view.trend[0]?.date ?? today;
  const from = RANGES[range] === 0 ? first : maxDate(first, addDays(today, -RANGES[range]));
  const end =
    range === 'all' && view.trajectory.length > 0
      ? (view.trajectory.at(-1)?.date ?? today)
      : addDays(today, 14);
  const conv = (kg: number) => kgToUnit(kg, unit);
  const trendPoints = view.trend
    .filter((p) => p.date >= from)
    .map((p) => ({ date: p.date, value: conv(p.trend) }));
  const rawPoints = view.weighIns
    .filter((w) => w.date >= from)
    .map((w) => ({ date: w.date, value: conv(w.weightKg) }));
  const targetPoints = sampleTrajectory(view, from, end).map((p) => ({
    date: p.date,
    value: conv(p.value),
  }));
  const values = [...trendPoints, ...rawPoints, ...targetPoints].map((p) => p.value);
  const lo = values.length ? Math.floor(Math.min(...values) - 1) : 0;
  const hi = values.length ? Math.ceil(Math.max(...values) + 1) : 1;

  const next = view.checkpoints.find((m) => m.completedAt === null);
  const start = view.trajectory[0];
  const fmtRate = (r: number) => `${r >= 0 ? '+' : '−'}${Math.abs(conv(r)).toFixed(2)}`;

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Morning weigh-in</div>
            <p className="mt-1 mb-3 text-[13px] text-ink-muted">
              Same time, same conditions — after waking, before eating. The trend does the rest.
            </p>
            <WeighInForm existing={view.weighIns} />
          </div>
          <Pill
            tone={RATE_TONE[view.verdict.status]}
            icon={view.verdict.status === 'on-pace' ? 'check' : 'info'}
          >
            {RATE_LABEL[view.verdict.status]}
          </Pill>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-6 border-t border-rule pt-5 md:grid-cols-4">
          <Stat
            label="Trend weight"
            value={latest ? conv(latest.trend).toFixed(1) : '—'}
            unit={latest ? unit : undefined}
            hint={
              latest
                ? `${view.weighIns.length} weigh-in${view.weighIns.length === 1 ? '' : 's'}`
                : 'Log your first weigh-in'
            }
          />
          <Stat
            label="Weekly rate"
            value={view.rate === null ? '—' : fmtRate(view.rate)}
            unit={view.rate === null ? undefined : `${unit} / week`}
            hint={`Plan needs ${fmtRate(view.required)} ${unit}/week`}
          />
          <Stat
            label="Target today"
            value={view.targetToday === null ? '—' : conv(view.targetToday).toFixed(1)}
            unit={view.targetToday === null ? undefined : unit}
            hint={
              latest && view.targetToday !== null
                ? `${latest.trend >= view.targetToday ? 'Above' : 'Below'} the line by ${formatWeight(Math.abs(latest.trend - view.targetToday), unit)}`
                : undefined
            }
          />
          <Stat
            label="Next checkpoint"
            value={next ? formatWeight(next.targetValue ?? 0, unit) : '—'}
            hint={
              next
                ? `by ${formatDate(next.targetDate)} · ${diffDays(today, next.targetDate)} days`
                : 'All checkpoints reached'
            }
          />
        </div>
        <div className="mt-5">
          <Note
            icon={
              view.verdict.status === 'on-pace' || view.verdict.status === 'insufficient-data'
                ? 'info'
                : 'alert'
            }
            tone={
              view.verdict.status === 'too-fast' || view.verdict.status === 'too-slow'
                ? 'warning'
                : 'neutral'
            }
          >
            {view.verdict.message}
          </Note>
        </div>
      </Card>

      <Card className="p-6">
        {trendPoints.length === 0 ? (
          <p className="text-[13px] text-ink-muted">The chart appears after your first weigh-in.</p>
        ) : (
          <TimeChart
            title="Weight trend against the plan"
            summary={`Trend weight ${latest ? formatWeight(latest.trend, unit) : ''}; target today ${view.targetToday === null ? 'unknown' : formatWeight(view.targetToday, unit)}.`}
            unit={unit}
            today={today}
            format={(v) => v.toFixed(1)}
            yDomain={[lo, hi]}
            series={[
              {
                key: 'target',
                label: 'Plan',
                color: colors['chart-reference'],
                reference: true,
                points: targetPoints,
              },
              {
                key: 'raw',
                label: 'Weigh-ins',
                color: colors.physique,
                dots: true,
                points: rawPoints,
              },
              { key: 'trend', label: 'Trend', color: colors.physique, points: trendPoints },
            ]}
          />
        )}
        <div className="mt-3 flex justify-end">
          <SegmentedControl
            size="sm"
            label="Chart range"
            value={range}
            onChange={setRange}
            options={[
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
              { value: '365', label: 'Year' },
              { value: 'all', label: 'Whole plan' },
            ]}
          />
        </div>
      </Card>

      <section aria-labelledby="checkpoints">
        <SectionTitle id="checkpoints">Checkpoints</SectionTitle>
        <Card as="div">
          <ul>
            {view.checkpoints.map((m) => {
              const target = m.targetValue ?? 0;
              const progress =
                start && latest && target !== start.kg
                  ? (latest.trend - start.kg) / (target - start.kg)
                  : 0;
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-4 border-b border-rule px-5 py-3 last:border-0"
                >
                  <span className="w-24 text-[13.5px] font-semibold text-ink">
                    {formatWeight(target, unit)}
                  </span>
                  <Meter
                    value={m.completedAt ? 1 : progress}
                    label={`Progress towards ${formatWeight(target, unit)}`}
                    className="flex-1"
                  />
                  <span className="w-32 text-right text-[12.5px] text-ink-muted">
                    {formatDate(m.targetDate)}
                  </span>
                  <span className="w-24 text-right text-[12px] text-ink-faint">
                    {m.completedAt
                      ? 'reached'
                      : `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
        <p className="mt-2 text-[12px] text-ink-faint">
          A checkpoint is marked reached when the smoothed trend — not a single weigh-in — passes
          it. About {formatWeight(4.9, unit)} a year is the plan; the first year asks more if you
          start lighter.
        </p>
      </section>
    </div>
  );
}

/** Points on the plan line within the visible window (its edges and any checkpoints). */
function sampleTrajectory(view: ReturnType<typeof usePhysique>, from: string, to: string) {
  if (view.trajectory.length === 0) return [];
  const at = (d: string) => targetWeightAt(view.trajectory, d) ?? 0;
  const inside = view.trajectory
    .filter((p) => p.date > from && p.date < to)
    .map((p) => ({ date: p.date, value: p.kg }));
  return [{ date: from, value: at(from) }, ...inside, { date: to, value: at(to) }];
}
