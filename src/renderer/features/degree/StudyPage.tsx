import { useState, type SyntheticEvent } from 'react';
import { proposeSessions } from '@shared/domain/planner/freeTime';
import { fromMinutes, durationLabel } from '@shared/domain/time/clockTime';
import { addDays, formatDate, startOfWeek, weekdayShort } from '@shared/domain/time/localDate';
import type { Interval } from '@shared/domain/planner/intervals';
import { useNowMinute, useSettings, useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { api, ApiError } from '../../lib/api';
import { parseDecimal } from '../../lib/units';
import { toast } from '../../stores/toasts';
import { Card, EmptyState, Note, SectionTitle, Stat } from '../../design/Card';
import { Button, IconButton } from '../../design/Button';
import { Select, TextInput } from '../../design/Field';
import { Meter } from '../../design/Ring';
import { BarChartCard } from '../../design/charts/BarChartCard';
import { useTokenColors } from '../../design/charts/colors';
import { usePlannerFrames } from '../planner/usePlannerFrames';
import { useDegree } from './useDegree';

/**
 * Study planning around shifts: free windows come from the shift pattern (with sleep
 * after night shifts respected), and sessions are proposed into them to meet the
 * weekly study target. Accepted sessions become plan blocks; ticking one logs the time.
 */
export function StudyPage() {
  const today = useToday();
  const nowMinute = useNowMinute();
  const settings = useSettings();
  const degree = useDegree();
  const colors = useTokenColors(['degree'] as const);
  const weekStart = startOfWeek(today, settings.general.weekStartsOn);
  const { frames, ready } = usePlannerFrames(today, 7);
  const plan = useLedger(
    'plan.list',
    { from: addDays(today, -1), to: addDays(today, 7) },
    { domains: ['plan'] },
  );
  const sessions = useLedger(
    'study.list',
    { from: addDays(weekStart, -7 * 7), to: addDays(weekStart, 6) },
    { domains: ['degree'] },
  );
  const target = settings.degree.studyHoursPerWeek * 60;

  const thisWeek = (sessions.data ?? [])
    .filter((s) => s.date >= weekStart)
    .reduce((n, s) => n + s.minutes, 0);
  const plannedStudy = (plan.data ?? []).filter(
    (b) => b.goalId === 'degree' && !b.done && b.date >= today,
  );
  const plannedMinutes = plannedStudy
    .filter((b) => b.date <= addDays(weekStart, 6))
    .reduce((n, b) => n + b.end - b.start, 0);

  // Cheap to compute (seven days of windows), so no memoisation is needed.
  const occupied = new Map<string, Interval[]>();
  for (const b of plan.data ?? []) {
    occupied.set(b.date, [...(occupied.get(b.date) ?? []), { start: b.start, end: b.end }]);
  }
  const proposals = ready
    ? proposeSessions(frames, {
        totalMinutes: Math.max(0, target - thisWeek - plannedMinutes),
        sessionMinutes: settings.degree.sessionMinutes,
        minSession: 30,
        maxPerDay: 2,
        planned: occupied,
        now: { date: today, minute: nowMinute },
      })
    : [];

  const accept = async (p: { date: string; start: number; end: number }) => {
    await api('plan.create', {
      date: p.date,
      start: p.start,
      end: p.end,
      goalId: 'degree',
      kind: 'study',
      title: 'Study',
    });
  };

  const complete = async (b: { id: string; date: string; start: number; end: number }) => {
    await api('study.log', { date: b.date, minutes: b.end - b.start, note: 'Planned session' });
    await api('plan.update', { id: b.id, patch: { done: true } });
    toast.success(`Logged ${durationLabel(b.end - b.start)} of study.`);
  };

  const weeks = Array.from({ length: 8 }, (_, i) => addDays(weekStart, -7 * (7 - i)));
  const weekly = weeks.map((w) => ({
    label: formatDate(w, { year: false }),
    detail: `Week of ${formatDate(w)}`,
    value:
      (sessions.data ?? [])
        .filter((s) => s.date >= w && s.date < addDays(w, 7))
        .reduce((n, s) => n + s.minutes, 0) / 60,
  }));
  const shortSleep = frames.filter((f) => f.shortSleep);

  return (
    <div className="flex flex-col gap-6">
      <Card className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[1fr_1fr_1.3fr]">
        <Stat
          label="Studied this week"
          value={(thisWeek / 60).toFixed(1)}
          unit={`of ${settings.degree.studyHoursPerWeek} h`}
          hint={
            <Meter
              value={thisWeek / Math.max(1, target)}
              label="Study this week against target"
              className="mt-2"
            />
          }
        />
        <Stat
          label="Planned, not yet done"
          value={(plannedMinutes / 60).toFixed(1)}
          unit="h"
          hint="in the rest of this week"
        />
        <LogStudy
          modules={degree.data.modules.map((m) => ({ id: m.id, label: m.code || m.title }))}
        />
      </Card>

      {shortSleep.length > 0 ? (
        <Note tone="warning" icon="alert">
          Short sleep between shifts on{' '}
          {shortSleep
            .map((f) => `${weekdayShort(f.date)} ${formatDate(f.date, { year: false })}`)
            .join(', ')}{' '}
          ({shortSleep.map((f) => durationLabel(f.sleepBetweenShifts ?? 0)).join(', ')}). Nothing is
          proposed in those hours; consider keeping that day light.
        </Note>
      ) : null}

      <section aria-labelledby="proposals">
        <SectionTitle
          id="proposals"
          action={
            proposals.length > 1 ? (
              <Button
                size="sm"
                onClick={() =>
                  void Promise.all(proposals.map(accept)).then(() =>
                    toast.success('Added to your plan.'),
                  )
                }
              >
                Add all
              </Button>
            ) : null
          }
        >
          Suggested sessions
        </SectionTitle>
        <p className="-mt-1 mb-3 text-[12.5px] text-ink-muted">
          Fitted into your free time around shifts — never in the hours after a night shift or too
          late before a morning one.
        </p>
        {proposals.length === 0 ? (
          <EmptyState
            icon="check"
            title={
              target - thisWeek - plannedMinutes <= 0
                ? 'This week’s study is covered'
                : 'No free windows left this week'
            }
          >
            {target - thisWeek - plannedMinutes <= 0
              ? 'Your weekly target is met by what you have studied and planned.'
              : 'Set your shifts on the Today screen, or reduce the weekly target in Settings → Degree.'}
          </EmptyState>
        ) : (
          <Card as="div">
            <ul>
              {proposals.map((p) => (
                <li
                  key={`${p.date}-${p.start}`}
                  className="flex items-center gap-4 border-b border-rule px-5 py-2.5 last:border-0"
                >
                  <span className="w-28 text-[13px] font-medium text-ink">
                    {p.date === today
                      ? 'Today'
                      : `${weekdayShort(p.date)} ${formatDate(p.date, { year: false })}`}
                  </span>
                  <span className="tabular flex-1 text-[13px] text-ink">
                    {fromMinutes(p.start)}–{fromMinutes(p.end)}{' '}
                    <span className="text-ink-faint">· {durationLabel(p.end - p.start)}</span>
                  </span>
                  <Button size="sm" variant="secondary" icon="plus" onClick={() => void accept(p)}>
                    Add to plan
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section aria-labelledby="planned">
        <SectionTitle id="planned">Planned study</SectionTitle>
        {plannedStudy.length === 0 ? (
          <p className="text-[13px] text-ink-muted">Nothing planned yet. Add a suggestion above.</p>
        ) : (
          <Card as="div">
            <ul>
              {plannedStudy.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-4 border-b border-rule px-5 py-2.5 last:border-0"
                >
                  <span className="w-28 text-[13px] font-medium text-ink">
                    {b.date === today
                      ? 'Today'
                      : `${weekdayShort(b.date)} ${formatDate(b.date, { year: false })}`}
                  </span>
                  <span className="tabular flex-1 text-[13px] text-ink">
                    {fromMinutes(b.start)}–{fromMinutes(b.end)}
                  </span>
                  <Button
                    size="sm"
                    variant="accent"
                    icon="check"
                    disabled={b.date > today}
                    onClick={() => void complete(b)}
                  >
                    Done
                  </Button>
                  <IconButton
                    icon="trash"
                    size="sm"
                    tone="danger"
                    label="Remove from plan"
                    onClick={() => void api('plan.delete', { id: b.id })}
                  />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <Card className="p-6">
        <BarChartCard
          title="Study hours per week"
          summary={`Hours studied in each of the last 8 weeks against a ${settings.degree.studyHoursPerWeek}-hour target.`}
          rows={weekly}
          color={colors.degree}
          seriesLabel="Hours studied"
          unit="h"
          reference={{ value: settings.degree.studyHoursPerWeek, label: 'Weekly target' }}
        />
      </Card>
    </div>
  );
}

function LogStudy({ modules }: { modules: { id: string; label: string }[] }) {
  const today = useToday();
  const [hours, setHours] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const h = parseDecimal(hours);
    if (h === null || h <= 0 || h > 16) {
      setError('Enter hours studied, e.g. 1.5');
      return;
    }
    setError(null);
    try {
      await api('study.log', {
        date: today,
        minutes: Math.round(h * 60),
        moduleId: moduleId || null,
      });
      setHours('');
      toast.success(`Logged ${durationLabel(Math.round(h * 60))} of study.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log study time.');
    }
  };
  return (
    <form onSubmit={(e) => void submit(e)} aria-label="Log study time">
      <div className="eyebrow mb-2">Log study today</div>
      <div className="flex flex-wrap gap-2">
        <TextInput
          aria-label="Hours studied"
          inputMode="decimal"
          placeholder="hours"
          className="w-[80px]"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
        <Select
          aria-label="Module"
          className="w-[150px]"
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
        >
          <option value="">General study</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="accent">
          Log
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-[12px] text-critical">
          {error}
        </p>
      ) : null}
    </form>
  );
}
