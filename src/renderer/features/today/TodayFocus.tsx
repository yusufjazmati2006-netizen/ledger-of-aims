import { useState } from 'react';
import { Link } from 'react-router';
import { availableTasks } from '@shared/domain/game/roadmap';
import { countdownText, nextDeadlines, urgencyOf } from '@shared/domain/degree/deadlines';
import { trainingStatus } from '@shared/domain/physique/schedule';
import { subtract, length } from '@shared/domain/planner/intervals';
import { candidates, pack, type TodayInputs } from '@shared/domain/today/prioritise';
import { durationLabel, fromMinutes } from '@shared/domain/time/clockTime';
import { addDays, diffDays, startOfWeek } from '@shared/domain/time/localDate';
import type { Goal } from '@shared/schemas/core';
import { useNowMinute, useSettings, useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { api } from '../../lib/api';
import { cx } from '../../lib/cx';
import { GOAL_META } from '../../lib/goals';
import { toast } from '../../stores/toasts';
import { Card, SectionTitle } from '../../design/Card';
import { Button } from '../../design/Button';
import { SegmentedControl } from '../../design/Field';
import { Icon } from '../../design/icons';
import { useQuran } from '../quran/useQuran';
import { usePhysique } from '../physique/usePhysique';
import { isDone, useDegree } from '../degree/useDegree';
import { usePlannerFrames } from '../planner/usePlannerFrames';
import { useWeekBudgets } from '../planner/useWeekBudgets';
import { completeBlock } from '../planner/completeBlock';
import { useHabits, type HabitView } from '../review/useHabits';

type TimeChoice = 'free' | '15' | '30' | '60' | '120';

/**
 * What to do with the time you have today: candidate actions from every goal, ranked
 * by urgency, how far behind each goal is and streaks at risk, then packed into the
 * free time left today (or the minutes you say you have).
 */
export function TodayFocus({ goals }: { goals: Goal[] }) {
  const today = useToday();
  const nowMinute = useNowMinute();
  const settings = useSettings();
  const [choice, setChoice] = useState<TimeChoice>('free');
  const quran = useQuran();
  const physique = usePhysique();
  const degree = useDegree();
  const { frames, ready: framesReady } = usePlannerFrames(today, 1);
  const budgets = useWeekBudgets(startOfWeek(today, settings.general.weekStartsOn));
  const roadmap = useLedger('game.roadmap', undefined, { domains: ['game'] });
  const habits = useHabits();

  const frame = frames[0];
  const freeLeft = frame
    ? subtract(frame.windows, [{ start: 0, end: nowMinute }]).reduce((n, w) => n + length(w), 0)
    : 0;
  const available = choice === 'free' ? freeLeft : Number(choice);

  const deadline = degree.ready
    ? nextDeadlines(
        degree.deadlines.map((a) => ({ ...a, due: a.dueDate ?? '', done: isDone(a) })),
        today,
        1,
      )[0]
    : undefined;
  const gameGoal = goals.find((g) => g.id === 'game');
  const nextTask = roadmap.data
    ? availableTasks(roadmap.data.phases, roadmap.data.tasks, roadmap.data.dependencies)[0]
    : undefined;
  const q = quran.setUp && quran.queue && quran.pace ? quran : null;

  const inputs: TodayInputs = {
    quran: q
      ? {
          dueCount: q.queue?.dueCount ?? 0,
          minutesPerPage: q.settings.minutesPerPage,
          revisionMinutes: q.settings.revisionMinutesPerDay,
          newMinutes: q.settings.newLearningMinutesPerDay,
          verdict: q.pace?.verdict ?? null,
          deficitPages: q.pace?.deficit ?? 0,
          revisedToday: q.records.some((r) => r.lastReviewedOn === today),
          learnedToday: q.records.some((r) => r.learnedOn === today),
          revisionStreakAtRisk: q.streak?.atRisk ?? false,
        }
      : null,
    training:
      settings.planner.trainingMinutes > 0
        ? {
            status: trainingStatus(budgets.lastWorkout, today, settings.physique.restDays),
            minutes: settings.planner.trainingMinutes,
          }
        : null,
    weighedToday: physique.weighIns.some((w) => w.date === today),
    deadline: deadline
      ? {
          title: deadline.title,
          urgency: urgencyOf(today, deadline.due),
          label: countdownText(today, deadline.due),
        }
      : null,
    study: {
      behindMinutes: Math.max(0, budgets.targets.study - budgets.studyLogged),
      sessionMinutes: settings.degree.sessionMinutes,
    },
    game: {
      task: nextTask?.title ?? (gameGoal?.nextAction || null),
      behindMinutes: Math.max(0, budgets.targets.game - Math.round(budgets.gameLogged)),
      sessionMinutes: settings.planner.gameSessionMinutes,
    },
    habitsAtRisk: habits.active
      .filter((h) => h.streak.atRisk)
      .map((h) => ({ id: h.id, name: h.name, goalId: h.goalId })),
  };
  const ready =
    quran.ready && physique.ready && degree.ready && budgets.ready && framesReady && habits.ready;
  const { now, later, usedMinutes } = pack(candidates(inputs), available);

  return (
    <Card className="p-6" aria-labelledby="focus-heading">
      <SectionTitle
        id="focus-heading"
        action={
          <SegmentedControl
            label="Time available"
            size="sm"
            value={choice}
            onChange={setChoice}
            options={[
              { value: 'free', label: `Free today · ${durationLabel(freeLeft)}` },
              { value: '15', label: '15m' },
              { value: '30', label: '30m' },
              { value: '60', label: '1h' },
              { value: '120', label: '2h' },
            ]}
          />
        }
      >
        Today’s focus
      </SectionTitle>
      {!ready ? (
        <div className="h-[140px]" />
      ) : now.length === 0 ? (
        <p className="py-3 text-[13.5px] text-ink-muted">
          {available === 0
            ? 'No free time left today by your shift pattern. Rest is part of the plan.'
            : 'Nothing pressing fits — everything due is done. Well done.'}
        </p>
      ) : (
        <ol className="flex flex-col" aria-label="Suggested actions">
          {now.map((c, i) => (
            <li
              key={c.id}
              data-goal={c.goalId ?? undefined}
              className="flex items-center gap-3 border-b border-rule py-2.5 last:border-0"
            >
              <span className="tabular w-4 text-[12.5px] text-ink-faint">{i + 1}</span>
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Icon name={c.goalId ? GOAL_META[c.goalId].icon : 'check'} size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  to={c.link}
                  className="block truncate text-[14px] font-medium text-ink hover:underline"
                >
                  {c.title}
                </Link>
                <div className="truncate text-[12px] text-ink-muted">{c.reason}</div>
              </div>
              <span className="tabular shrink-0 text-[12.5px] text-ink-muted">
                {durationLabel(c.minutes)}
              </span>
            </li>
          ))}
        </ol>
      )}
      {ready ? (
        <p className="mt-3 text-[12px] text-ink-faint">
          {now.length > 0
            ? `${durationLabel(usedMinutes)} of ${durationLabel(available)} planned.`
            : ''}
          {later.length > 0 ? (
            <>
              {' '}
              If you have more time:{' '}
              {later.map((c, i) => (
                <span key={c.id}>
                  {i > 0 ? ' · ' : ''}
                  <Link to={c.link} className="underline-offset-2 hover:underline">
                    {c.title}
                  </Link>
                </span>
              ))}
            </>
          ) : null}
        </p>
      ) : null}
    </Card>
  );
}

/** Today's blocks from the planner, tickable here. */
export function PlannedToday() {
  const today = useToday();
  const plan = useLedger('plan.list', { from: today, to: today }, { domains: ['plan'] });
  const blocks = plan.data ?? [];
  return (
    <Card className="p-5" aria-labelledby="planned-today">
      <SectionTitle
        id="planned-today"
        action={
          <Link to="/planner" className="text-[12.5px] text-ink-muted hover:text-ink">
            Planner
          </Link>
        }
      >
        Planned today
      </SectionTitle>
      {blocks.length === 0 ? (
        <p className="text-[13px] text-ink-muted">
          Nothing planned.{' '}
          <Link to="/planner" className="font-medium text-ink underline underline-offset-2">
            Plan your week
          </Link>{' '}
          around your shifts.
        </p>
      ) : (
        <ul className="flex flex-col">
          {blocks.map((b) => (
            <li key={b.id} data-goal={b.goalId} className="flex items-center gap-2.5 py-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              <span className="tabular w-[84px] shrink-0 text-[12.5px] text-ink-muted">
                {fromMinutes(b.start)}–{fromMinutes(b.end)}
              </span>
              <span
                className={cx(
                  'min-w-0 flex-1 truncate text-[13px]',
                  b.done ? 'text-ink-faint line-through' : 'text-ink',
                )}
              >
                {b.title || GOAL_META[b.goalId].short}
              </span>
              {b.done ? (
                <Icon name="check" size={14} className="text-positive" aria-label="Done" />
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Mark ${b.title || 'block'} done`}
                  onClick={() =>
                    void completeBlock(b).catch(() => toast.error('Could not mark the block done.'))
                  }
                >
                  Done
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Today's habits as a checklist. */
export function HabitsToday() {
  const habits = useHabits();
  if (!habits.ready || habits.active.length === 0) {
    return habits.ready ? (
      <Card className="p-5" aria-labelledby="habits-today">
        <SectionTitle id="habits-today">Habits</SectionTitle>
        <p className="text-[13px] text-ink-muted">
          <Link to="/review/habits" className="font-medium text-ink underline underline-offset-2">
            Add a habit
          </Link>{' '}
          to tick off here each day.
        </p>
      </Card>
    ) : null;
  }
  return (
    <Card className="p-5" aria-labelledby="habits-today">
      <SectionTitle id="habits-today">Habits</SectionTitle>
      <ul className="flex flex-col gap-1.5">
        {habits.active.map((h) => (
          <HabitCheck key={h.id} habit={h} />
        ))}
      </ul>
    </Card>
  );
}

function HabitCheck({ habit }: { habit: HabitView }) {
  const today = useToday();
  // Optimistic, so the box does not flicker back while the change round-trips.
  const actual = habit.checks.has(today);
  const [pending, setPending] = useState<boolean | null>(null);
  if (pending !== null && pending === actual) setPending(null);
  const done = pending ?? actual;
  return (
    <li data-goal={habit.goalId ?? undefined}>
      <label className="flex items-center gap-2.5 text-[13.5px]">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--accent)]"
          checked={done}
          onChange={() => {
            setPending(!done);
            void api('habits.check', { habitId: habit.id, date: today, done: !done }).catch(() => {
              setPending(null);
              toast.error('Could not update the habit.');
            });
          }}
        />
        <span className={cx('flex-1', done ? 'text-ink-muted' : 'text-ink')}>{habit.name}</span>
        <span className="tabular text-[12px] text-ink-faint">
          {habit.streak.length > 0 ? `${habit.streak.length}-day streak` : ''}
        </span>
      </label>
    </li>
  );
}

/** The three priorities set in last week's review, and a nudge when a review is due. */
export function WeekPriorities() {
  const today = useToday();
  const settings = useSettings();
  const weekStart = startOfWeek(today, settings.general.weekStartsOn);
  const last = useLedger(
    'review.get',
    { weekStart: addDays(weekStart, -7) },
    { domains: ['review'] },
  );
  const current = useLedger('review.get', { weekStart }, { domains: ['review'] });
  if (last.data === undefined || current.data === undefined) return null;
  const endOfWeek = addDays(weekStart, 6) === today;
  const lastOpen = !last.data?.completedAt && diffDays(weekStart, today) <= 1;
  const priorities = last.data?.priorities ?? [];
  return (
    <>
      {(endOfWeek && !current.data?.completedAt) || lastOpen ? (
        <Link
          to="/review"
          className="flex items-center gap-3 rounded-xl border border-rule-strong bg-surface px-4 py-3 text-[13.5px] text-ink hover:bg-sunken"
        >
          <Icon name="review" className="shrink-0 text-ink-muted" />
          <span className="flex-1">
            {endOfWeek
              ? 'The week ends today — ten minutes for your weekly review.'
              : 'Last week has not been reviewed yet.'}
          </span>
          <Icon name="chevronRight" size={16} className="text-ink-faint" />
        </Link>
      ) : null}
      {priorities.length > 0 ? (
        <Card className="p-5" aria-labelledby="week-priorities">
          <SectionTitle id="week-priorities">This week’s priorities</SectionTitle>
          <ol className="list-decimal pl-5 text-[13.5px] text-ink">
            {priorities.map((p) => (
              <li key={p} className="py-0.5">
                {p}
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
    </>
  );
}
