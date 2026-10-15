import { useState } from 'react';
import { Link } from 'react-router';
import {
  addDays,
  diffDays,
  formatDate,
  parts,
  monthLong,
  startOfWeek,
  weekdayLong,
  weekdayShort,
} from '@shared/domain/time/localDate';
import { countdown, nextMilestone } from '@shared/domain/milestones/milestones';
import { availableTasks, rollup } from '@shared/domain/game/roadmap';
import { weeklyHours } from '@shared/domain/game/time';
import { trainingStatus } from '@shared/domain/physique/schedule';
import { sumIntake } from '@shared/domain/physique/nutrition';
import type { RateStatus } from '@shared/domain/physique/trend';
import { GOAL_IDS, type GoalId } from '@shared/schemas/common';
import type { Goal, Milestone, ShiftType } from '@shared/schemas/core';
import { useSettings, useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { useNow } from '../../lib/useNow';
import { api } from '../../lib/api';
import { formatWeight } from '../../lib/units';
import { GOAL_META } from '../../lib/goals';
import { Card, PageHeader, Pill, type PillTone } from '../../design/Card';
import { usePhysique } from '../physique/usePhysique';
import { isDone, useDegree } from '../degree/useDegree';
import { countdownText, nextDeadlines } from '@shared/domain/degree/deadlines';
import { Ring } from '../../design/Ring';
import { useQuran } from '../quran/useQuran';
import { VERDICT_TONE, verdictHeadline } from '../quran/verdict';
import { SegmentedControl } from '../../design/Field';
import { Icon } from '../../design/icons';
import { toast } from '../../stores/toasts';

export function TodayPage() {
  const today = useToday();
  const settings = useSettings();
  const goals = useLedger('goals.list', undefined, { domains: ['goals'] });
  const milestones = useLedger('milestones.list', undefined, { domains: ['milestones'] });
  const shiftTypes = useLedger('shifts.types', undefined, { domains: ['shifts'] });
  const shiftDays = useLedger('shifts.range', { from: today, to: today }, { domains: ['shifts'] });

  const shiftId = shiftDays.data?.[0]?.shiftTypeId ?? null;
  const shift = shiftTypes.data?.find((t) => t.id === shiftId);
  const { day, month } = today ? parts(today) : { day: 0, month: 1 };
  const planDay = today ? diffDays(settings.general.planStartDate, today) + 1 : 0;

  return (
    <div className="animate-fade-in pt-6">
      <PageHeader
        eyebrow={today ? `${weekdayLong(today)} · ${shiftLabel(shift)}` : ''}
        title={`${day} ${monthLong(month)}`}
        description={
          planDay >= 1
            ? `Day ${planDay} of the ledger.`
            : `The plan begins on ${formatDate(settings.general.planStartDate)}.`
        }
        actions={
          shiftTypes.data ? (
            <SegmentedControl
              label="Today's shift"
              value={shiftId ?? ''}
              onChange={(value) => {
                void api('shifts.set', { days: [{ date: today, shiftTypeId: value }] }).catch(
                  () => {
                    toast.error('Could not update today’s shift.');
                  },
                );
              }}
              options={shiftTypes.data.map((t) => ({ value: t.id, label: t.label }))}
            />
          ) : null
        }
      />

      <section aria-labelledby="goals-heading">
        <h2 id="goals-heading" className="sr-only">
          Goals
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {GOAL_IDS.map((id) => {
            const goal = goals.data?.find((g) => g.id === id);
            if (!goal) return <div key={id} className="h-[208px] rounded-xl bg-sunken/50" />;
            return (
              <GoalCard key={id} goal={goal} today={today} milestones={milestones.data ?? []} />
            );
          })}
        </div>
      </section>
    </div>
  );
}

function shiftLabel(shift: ShiftType | undefined): string {
  if (!shift) return 'shift not set';
  if (!shift.start || !shift.end) return 'day off';
  return `${shift.label.toLowerCase()} shift ${shift.start}–${shift.end}`;
}

function GoalCard({
  goal,
  today,
  milestones,
}: {
  goal: Goal;
  today: string;
  milestones: Milestone[];
}) {
  const next = nextMilestone(milestones, goal.id);
  const due = next ? countdown(today, next.targetDate) : null;
  const meta = GOAL_META[goal.id];

  return (
    <Card
      as="article"
      data-goal={goal.id}
      className="flex flex-col p-5"
      aria-labelledby={`goal-${goal.id}`}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon name={meta.icon} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3
            id={`goal-${goal.id}`}
            className="font-serif text-[18px] leading-tight font-semibold text-ink"
          >
            {goal.title}
          </h3>
          <p className="truncate text-[12.5px] text-ink-muted">{goal.subtitle}</p>
        </div>
      </div>

      <GoalProgress goalId={goal.id} />

      {next && due ? (
        <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-rule pt-3">
          <div className="min-w-0">
            <div className="eyebrow">Next milestone</div>
            <div className="mt-0.5 truncate text-[13.5px] text-ink">{next.title}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[12.5px] text-ink-muted">{formatDate(next.targetDate)}</div>
            <div
              className={
                due.overdue
                  ? 'text-[12px] font-semibold text-critical'
                  : 'tabular text-[12px] text-ink-faint'
              }
            >
              {due.label}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 border-t border-rule pt-3 text-[13px] text-ink-muted">
          No open milestones.{' '}
          <Link to="/milestones" className="font-medium text-ink underline underline-offset-2">
            Add one
          </Link>
        </div>
      )}

      <NextAction goal={goal} />
    </Card>
  );
}

/**
 * Goal-specific progress. Each module contributes its own measure as it is built;
 * until then the card is honest that there is nothing to measure yet.
 */
function GoalProgress({ goalId }: { goalId: GoalId }) {
  if (goalId === 'quran') return <QuranProgress />;
  if (goalId === 'physique') return <PhysiqueProgress />;
  if (goalId === 'degree') return <DegreeProgress />;
  return <GameProgress />;
}

function GameProgress() {
  const settings = useSettings();
  const today = useToday();
  const weekStart = startOfWeek(today, settings.general.weekStartsOn);
  const roadmap = useLedger('game.roadmap', undefined, { domains: ['game'] });
  const time = useLedger('time.list', { from: weekStart, to: today }, { domains: ['game'] });
  const running = useLedger('time.running', undefined, { domains: ['game'] });
  const now = useNow(60_000);
  if (!roadmap.data || !time.data) return <div className="mt-4 h-[52px]" />;
  const { phases, tasks, dependencies } = roadmap.data;
  const progress = rollup(phases, tasks).overall.progress;
  const hours = weeklyHours(time.data, today, settings.general.weekStartsOn, 1, now)[0]?.hours ?? 0;
  const next = availableTasks(phases, tasks, dependencies)[0];
  return (
    <div className="mt-4 flex items-center gap-4">
      <Ring
        value={progress}
        size={52}
        stroke={5}
        label={`Roadmap ${Math.round(progress * 100)}% complete`}
      >
        <span className="tabular text-[11.5px] font-semibold text-ink">
          {Math.round(progress * 100)}%
        </span>
      </Ring>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] text-ink">
          <Link to="/game/time" className="underline-offset-2 hover:underline">
            <span className="font-semibold">{hours.toFixed(1)}</span> of{' '}
            {settings.game.weeklyHoursTarget} h this week
          </Link>
          {running.data ? (
            <Pill tone="accent" icon="clock" className="ml-2">
              Timer running
            </Pill>
          ) : null}
        </div>
        <div className="mt-1 truncate text-[12.5px] text-ink-muted">
          {next ? (
            <Link to="/game" className="underline-offset-2 hover:underline">
              Up next: {next.title}
            </Link>
          ) : (
            'Roadmap complete — or waiting on blocked tasks.'
          )}
        </div>
      </div>
    </div>
  );
}

const RATE_PILL: Record<RateStatus, { tone: PillTone; label: string }> = {
  'on-pace': { tone: 'positive', label: 'Gaining on pace' },
  'too-fast': { tone: 'warning', label: 'Gaining too fast' },
  'too-slow': { tone: 'warning', label: 'Gaining too slowly' },
  'insufficient-data': { tone: 'neutral', label: 'Building the trend' },
};

function PhysiqueProgress() {
  const settings = useSettings();
  const today = useToday();
  const view = usePhysique();
  const workouts = useLedger(
    'workouts.list',
    { from: addDays(today, -21), to: today },
    { domains: ['training'] },
  );
  const eaten = useLedger(
    'foodEntries.list',
    { from: today, to: today },
    { domains: ['nutrition'] },
  );
  const unit = settings.general.units;
  if (!view.ready) return <div className="mt-4 h-[52px]" />;
  if (!view.latest) {
    return (
      <p className="mt-4 text-[13px] text-ink-muted">
        <Link to="/physique" className="font-medium text-ink underline underline-offset-2">
          Log a weigh-in
        </Link>{' '}
        to start the trend.
      </p>
    );
  }
  const lastWeighIn = view.weighIns[view.weighIns.length - 1];
  const lastSession =
    [...(workouts.data ?? [])].reverse().find((w) => w.sets.length > 0)?.date ?? null;
  const status = trainingStatus(lastSession, today, settings.physique.restDays);
  const intake = sumIntake(eaten.data ?? []);
  const pill = RATE_PILL[view.verdict.status];
  return (
    <div className="mt-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[28px] leading-none font-semibold tracking-[-0.01em] text-ink">
            {formatWeight(view.latest.trend, unit)}
          </div>
          <div className="mt-1 text-[12.5px] text-ink-muted">
            trend ·{' '}
            {lastWeighIn?.date === today
              ? 'weighed today'
              : `last weighed ${lastWeighIn ? formatDate(lastWeighIn.date, { year: false }) : '—'}`}
            {view.targetToday !== null ? ` · plan ${formatWeight(view.targetToday, unit)}` : ''}
          </div>
        </div>
        <Pill tone={pill.tone}>{pill.label}</Pill>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-muted">
        <Link to="/physique/training" className="underline-offset-2 hover:underline">
          {status.kind === 'due' || status.kind === 'overdue'
            ? 'Training day'
            : status.kind === 'trained-today'
              ? 'Trained today'
              : `Rest day · next ${weekdayShort(status.next)}`}
        </Link>
        {view.nutrition ? (
          <Link to="/physique/nutrition" className="tabular underline-offset-2 hover:underline">
            {Math.round(intake.calories).toLocaleString('en-GB')} /{' '}
            {view.nutrition.calories.toLocaleString('en-GB')} kcal · {Math.round(intake.protein)} /{' '}
            {view.nutrition.protein} g protein
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function DegreeProgress() {
  const today = useToday();
  const degree = useDegree();
  if (!degree.ready) return <div className="mt-4 h-[52px]" />;
  const next = nextDeadlines(
    degree.deadlines.map((a) => ({ ...a, due: a.dueDate ?? '', done: isDone(a) })),
    today,
    1,
  )[0];
  const { projection } = degree;
  return (
    <div className="mt-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {next ? (
          <>
            <div className="text-[13.5px] text-ink">
              <span className="font-semibold">{countdownText(today, next.due)}</span> · {next.title}
            </div>
            <div className="truncate text-[12.5px] text-ink-muted">{next.module?.title}</div>
          </>
        ) : (
          <p className="text-[13px] text-ink-muted">
            <Link
              to="/degree/modules"
              className="font-medium text-ink underline underline-offset-2"
            >
              Add modules and assessments
            </Link>{' '}
            to see deadlines and your projected class.
          </p>
        )}
      </div>
      {projection.projected !== null ? (
        <Pill tone="accent">
          Projected {projection.band} · {projection.projected.toFixed(0)}%
        </Pill>
      ) : null}
    </div>
  );
}

function QuranProgress() {
  const quran = useQuran();
  if (!quran.ready) return <div className="mt-4 h-[52px]" />;
  if (!quran.setUp || !quran.pace || !quran.queue) {
    return (
      <p className="mt-4 text-[13px] text-ink-muted">
        <Link to="/quran" className="font-medium text-ink underline underline-offset-2">
          Set up your mushaf
        </Link>{' '}
        to track pages, pace and revision.
      </p>
    );
  }
  const { pace, queue } = quran;
  return (
    <div className="mt-4 flex items-center gap-4">
      <Ring
        value={pace.learned / 604}
        size={52}
        stroke={5}
        label={`${Math.round((pace.learned / 604) * 100)}% of the mushaf learned`}
      >
        <span className="tabular text-[11.5px] font-semibold text-ink">
          {Math.round((pace.learned / 604) * 100)}%
        </span>
      </Ring>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] text-ink">
          <span className="font-semibold">{pace.learned}</span> of 604 pages ·{' '}
          <Link to="/quran/revision" className="underline-offset-2 hover:underline">
            {queue.dueCount === 0
              ? 'revision up to date'
              : `${queue.dueCount} page${queue.dueCount === 1 ? '' : 's'} to revise`}
          </Link>
        </div>
        <div className="mt-1">
          <Pill tone={VERDICT_TONE[pace.verdict]}>{verdictHeadline(pace)}</Pill>
        </div>
      </div>
    </div>
  );
}

/** The single next physical action for a goal, editable in place. */
function NextAction({ goal }: { goal: Goal }) {
  // `draft` is non-null while editing; `pending` shows a just-saved value until the
  // refreshed goal arrives from the main process.
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const shown = pending ?? goal.nextAction;

  const commit = async () => {
    if (draft === null) return;
    const value = draft.trim();
    setDraft(null);
    if (value === goal.nextAction) return;
    setPending(value);
    try {
      await api('goals.update', { id: goal.id, patch: { nextAction: value } });
    } catch {
      toast.error('Could not save the next action.');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="mt-3 rounded-lg bg-sunken px-3 py-2">
      <div className="eyebrow">Next single action</div>
      {draft !== null ? (
        <input
          autoFocus
          aria-label={`Next single action for ${goal.title}`}
          className="mt-0.5 w-full bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-faint"
          value={draft}
          maxLength={280}
          placeholder="One concrete step you could take next"
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commit();
            if (e.key === 'Escape') setDraft(null);
          }}
        />
      ) : (
        <button
          type="button"
          className="mt-0.5 block w-full text-left text-[13.5px] text-ink"
          onClick={() => {
            setDraft(shown);
          }}
          aria-label={`Edit next single action for ${goal.title}`}
        >
          {shown || <span className="text-ink-faint">Add one concrete next step…</span>}
        </button>
      )}
    </div>
  );
}
