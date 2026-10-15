import { useMemo, useState, type SyntheticEvent } from 'react';
import {
  estimatedOneRepMax,
  personalRecords,
  suggestNext,
  type Session,
} from '@shared/domain/physique/progression';
import { trainingCalendar, trainingStatus, type PlanDay } from '@shared/domain/physique/schedule';
import { addDays, formatDate, weekdayShort } from '@shared/domain/time/localDate';
import type { Exercise, Workout, WorkoutSet } from '@shared/schemas/physique';
import { useSettings, useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { api, ApiError } from '../../lib/api';
import { kgToUnit, parseDecimal, unitToKg, type WeightUnit } from '../../lib/units';
import { toast } from '../../stores/toasts';
import { cx } from '../../lib/cx';
import { Card, EmptyState, Pill, SectionTitle } from '../../design/Card';
import { Button, IconButton } from '../../design/Button';
import { TextInput } from '../../design/Field';
import { ExerciseLibrary } from './ExerciseLibrary';

function historyOf(workouts: readonly Workout[], exerciseId: string, before?: string): Session[] {
  return workouts
    .filter((w) => before === undefined || w.date < before)
    .map((w) => ({
      date: w.date,
      sets: w.sets
        .filter((s) => s.exerciseId === exerciseId)
        .map((s) => ({ reps: s.reps, loadKg: s.loadKg })),
    }))
    .filter((s) => s.sets.length > 0);
}

export function TrainingPage() {
  const today = useToday();
  const settings = useSettings();
  const unit = settings.general.units;
  const exercises = useLedger('exercises.list', undefined, { domains: ['training'] });
  const workouts = useLedger('workouts.list', {}, { domains: ['training'] });
  const [date, setDate] = useState(today);

  const all = workouts.data ?? [];
  const lastWorkout =
    [...all].reverse().find((w) => w.date <= today && w.sets.length > 0)?.date ?? null;
  const status = trainingStatus(lastWorkout, today, settings.physique.restDays);
  const calendar = trainingCalendar(
    all.filter((w) => w.sets.length > 0).map((w) => w.date),
    addDays(today, -7),
    addDays(today, 7),
    today,
    settings.physique.restDays,
  );
  const session = all.find((w) => w.date === date);
  const active = (exercises.data ?? []).filter((e) => !e.archived);
  const program = active.filter((e) => e.inProgram);
  const extraIds = new Set((session?.sets ?? []).map((s) => s.exerciseId));
  const shown = [...program, ...active.filter((e) => !e.inProgram && extraIds.has(e.id))];
  const [adding, setAdding] = useState('');

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="eyebrow">Full body, every other day</div>
            <h2 className="mt-1 font-serif text-[24px] font-semibold" data-testid="training-status">
              {status.kind === 'due'
                ? 'Training day'
                : status.kind === 'overdue'
                  ? 'Session due — train today'
                  : status.kind === 'trained-today'
                    ? 'Done for today'
                    : 'Rest day'}
            </h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              {status.kind === 'rest' || status.kind === 'trained-today'
                ? `Next session ${weekdayShort(status.next)} ${formatDate(status.next, { year: false })}. Rest is where the growth happens.`
                : status.kind === 'overdue'
                  ? `The last session was ${status.daysLate + 1 + settings.physique.restDays} days ago. Missed days shift the cycle — never double up.`
                  : 'Log each set as you go; suggestions follow double progression.'}
            </p>
          </div>
          <CalendarStrip days={calendar} today={today} />
        </div>
      </Card>

      <section aria-labelledby="session">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="session" className="font-serif text-[19px] font-semibold">
            {date === today ? 'Today’s session' : `Session on ${formatDate(date)}`}
          </h2>
          <div className="flex items-center gap-2">
            <TextInput
              type="date"
              aria-label="Session date"
              className="w-[150px]"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value || today)}
            />
            {date !== today ? (
              <Button size="sm" variant="ghost" onClick={() => setDate(today)}>
                Today
              </Button>
            ) : null}
          </div>
        </div>
        {program.length === 0 ? (
          <EmptyState icon="dumbbell" title="No exercises in your programme">
            Choose the exercises for your full-body session in the library below.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {shown.map((exercise) => (
              <ExerciseLogger
                key={exercise.id}
                exercise={exercise}
                date={date}
                unit={unit}
                todaySets={(session?.sets ?? []).filter((s) => s.exerciseId === exercise.id)}
                history={historyOf(all, exercise.id, date)}
              />
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <select
            aria-label="Add another exercise to this session"
            className="h-8 rounded-lg border border-control bg-surface px-2 text-[12.5px] text-ink"
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
          >
            <option value="">Add an exercise to this session…</option>
            {active
              .filter((e) => !shown.includes(e))
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
          {adding ? (
            <span className="text-[12px] text-ink-muted">Log a set below to add it.</span>
          ) : null}
        </div>
        {adding ? (
          <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {active
              .filter((e) => e.id === adding)
              .map((exercise) => (
                <ExerciseLogger
                  key={exercise.id}
                  exercise={exercise}
                  date={date}
                  unit={unit}
                  todaySets={[]}
                  history={historyOf(all, exercise.id, date)}
                  onLogged={() => setAdding('')}
                />
              ))}
          </div>
        ) : null}
      </section>

      <Records exercises={program} workouts={all} unit={unit} />
      <History workouts={all} exercises={exercises.data ?? []} unit={unit} />
      <ExerciseLibrary exercises={exercises.data ?? []} />
    </div>
  );
}

const DAY_STYLE: Record<PlanDay, string> = {
  trained: 'bg-accent text-paper border-accent',
  rest: 'border-rule text-ink-faint',
  missed: 'border-warning text-warning border-dashed',
  planned: 'border-accent text-accent',
  'planned-rest': 'border-rule text-ink-faint',
};
const DAY_LABEL: Record<PlanDay, string> = {
  trained: 'trained',
  rest: 'rest',
  missed: 'missed',
  planned: 'training planned',
  'planned-rest': 'rest',
};

function CalendarStrip({
  days,
  today,
}: {
  days: { date: string; kind: PlanDay }[];
  today: string;
}) {
  return (
    <ol className="flex gap-1" aria-label="Training calendar, last and next seven days">
      {days.map((d) => (
        <li
          key={d.date}
          aria-label={`${weekdayShort(d.date)} ${formatDate(d.date, { year: false })}: ${DAY_LABEL[d.kind]}${d.date === today ? ' (today)' : ''}`}
          className="flex flex-col items-center gap-1"
        >
          <span
            className={cx(
              'text-[10.5px]',
              d.date === today ? 'font-semibold text-ink' : 'text-ink-faint',
            )}
          >
            {weekdayShort(d.date).slice(0, 1)}
          </span>
          <span
            className={cx(
              'tabular flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-medium',
              DAY_STYLE[d.kind],
              d.date === today && 'ring-2 ring-ink/20 ring-offset-1 ring-offset-surface',
            )}
          >
            {Number(d.date.slice(8))}
          </span>
        </li>
      ))}
    </ol>
  );
}

const display = (kg: number, unit: WeightUnit) => {
  const v = kgToUnit(kg, unit);
  return Number.isInteger(v)
    ? String(v)
    : v.toFixed(unit === 'kg' ? (Number.isInteger(v * 2) ? 1 : 2) : 1);
};

function ExerciseLogger({
  exercise,
  date,
  unit,
  todaySets,
  history,
  onLogged,
}: {
  exercise: Exercise;
  date: string;
  unit: WeightUnit;
  todaySets: WorkoutSet[];
  history: Session[];
  onLogged?: () => void;
}) {
  const suggestion = suggestNext(exercise, history);
  const index = todaySets.length;
  const lastToday = todaySets[todaySets.length - 1];
  const suggestedLoad = lastToday?.loadKg ?? suggestion.loadKg ?? (exercise.bodyweight ? 0 : null);
  const suggestedReps =
    suggestion.targetReps[index] ?? suggestion.targetReps.at(-1) ?? exercise.repMax;
  // Keyed on the set count so the inputs refill with the next suggestion after each set.
  return (
    <Card className="p-5" aria-labelledby={`ex-${exercise.id}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`ex-${exercise.id}`} className="text-[14.5px] font-semibold text-ink">
          {exercise.name}
        </h3>
        <span className="text-[12px] text-ink-faint">
          {exercise.setsTarget} × {exercise.repMin}–{exercise.repMax}
          {exercise.incrementKg > 0 ? ` · +${display(exercise.incrementKg, unit)} ${unit}` : ''}
        </span>
      </div>
      <p className="mt-1 text-[12.5px] text-ink-muted">{suggestion.reason}</p>
      {todaySets.length > 0 ? (
        <ol className="mt-3 flex flex-col gap-1">
          {todaySets.map((s, i) => (
            <LoggedSetRow
              key={s.id}
              set={s}
              number={i + 1}
              unit={unit}
              bodyweight={exercise.bodyweight}
              isPr={isPrAt(s, todaySets.slice(0, i), history)}
              inRange={s.reps >= exercise.repMin && s.reps <= exercise.repMax}
            />
          ))}
        </ol>
      ) : null}
      <SetEntry
        key={`${exercise.id}-${index}-${date}`}
        exercise={exercise}
        date={date}
        unit={unit}
        number={index + 1}
        defaultLoad={suggestedLoad}
        defaultReps={suggestedReps}
        done={index >= exercise.setsTarget}
        onLogged={onLogged}
      />
    </Card>
  );
}

function isPrAt(set: WorkoutSet, earlierToday: WorkoutSet[], history: Session[]): boolean {
  const before =
    personalRecords([...history, { date: 'today', sets: earlierToday }]).bestE1rm?.value ?? 0;
  return set.reps > 0 && estimatedOneRepMax(set.loadKg, set.reps) > before + 1e-9;
}

function LoggedSetRow({
  set,
  number,
  unit,
  bodyweight,
  isPr,
  inRange,
}: {
  set: WorkoutSet;
  number: number;
  unit: WeightUnit;
  bodyweight: boolean;
  isPr: boolean;
  inRange: boolean;
}) {
  return (
    <li className="flex items-center gap-3 rounded-md bg-sunken px-3 py-1.5 text-[13px]">
      <span className="w-12 text-ink-faint">Set {number}</span>
      <span className="tabular flex-1 font-medium text-ink">
        {bodyweight && set.loadKg === 0
          ? 'Bodyweight'
          : `${bodyweight ? '+' : ''}${display(set.loadKg, unit)} ${unit}`}{' '}
        × {set.reps}
        {!inRange ? (
          <span className="ml-2 text-[11.5px] font-normal text-ink-faint">outside range</span>
        ) : null}
      </span>
      {isPr ? (
        <Pill tone="accent" icon="sparkle">
          PR
        </Pill>
      ) : null}
      <IconButton
        icon="close"
        size="sm"
        tone="danger"
        label={`Delete set ${number}`}
        onClick={() =>
          void api('workouts.deleteSet', { id: set.id }).catch(() =>
            toast.error('Could not delete the set.'),
          )
        }
      />
    </li>
  );
}

function SetEntry({
  exercise,
  date,
  unit,
  number,
  defaultLoad,
  defaultReps,
  done,
  onLogged,
}: {
  exercise: Exercise;
  date: string;
  unit: WeightUnit;
  number: number;
  defaultLoad: number | null;
  defaultReps: number;
  done: boolean;
  onLogged?: () => void;
}) {
  const [load, setLoad] = useState(defaultLoad === null ? '' : display(defaultLoad, unit));
  const [reps, setReps] = useState(String(defaultReps));
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const loadValue = load.trim() === '' && exercise.bodyweight ? 0 : parseDecimal(load);
    const repsValue = Number(reps);
    if (loadValue === null || loadValue < 0) {
      setError('Enter the load.');
      return;
    }
    if (!Number.isInteger(repsValue) || repsValue < 0 || repsValue > 100) {
      setError('Enter whole reps.');
      return;
    }
    setError(null);
    try {
      const kg = Math.round(unitToKg(loadValue, unit) * 100) / 100;
      const result = await api('workouts.logSet', {
        date,
        exerciseId: exercise.id,
        reps: repsValue,
        loadKg: kg,
      });
      if (result.isPersonalRecord) {
        toast.success(
          `New best for ${exercise.name}: ${display(kg, unit)} ${unit} × ${repsValue} (≈ ${display(estimatedOneRepMax(kg, repsValue), unit)} ${unit} one-rep max).`,
        );
      }
      onLogged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log the set.');
    }
  };

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="mt-3 flex flex-wrap items-center gap-2"
      aria-label={`Log set ${number} of ${exercise.name}`}
    >
      <span className="w-12 text-[12.5px] text-ink-faint">Set {number}</span>
      <div className="relative">
        <TextInput
          aria-label={`${exercise.bodyweight ? 'Added load' : 'Load'} in ${unit}`}
          inputMode="decimal"
          className="w-[96px] pr-8"
          placeholder={exercise.bodyweight ? '0' : unit}
          value={load}
          onChange={(e) => setLoad(e.target.value)}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[11.5px] text-ink-faint">
          {unit}
        </span>
      </div>
      <span className="text-ink-faint">×</span>
      <TextInput
        aria-label="Reps"
        inputMode="numeric"
        className="w-[64px]"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
      />
      <Button type="submit" size="sm" variant={done ? 'secondary' : 'accent'} icon="check">
        {done ? 'Extra set' : 'Log set'}
      </Button>
      {error ? (
        <span role="alert" className="text-[12px] text-critical">
          {error}
        </span>
      ) : null}
    </form>
  );
}

function Records({
  exercises,
  workouts,
  unit,
}: {
  exercises: Exercise[];
  workouts: Workout[];
  unit: WeightUnit;
}) {
  const rows = useMemo(
    () =>
      exercises
        .map((e) => ({ exercise: e, pr: personalRecords(historyOf(workouts, e.id)) }))
        .filter((r) => r.pr.bestE1rm),
    [exercises, workouts],
  );
  return (
    <section aria-labelledby="records">
      <SectionTitle id="records">Personal records</SectionTitle>
      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-muted">
          Records appear as soon as you log your first sets.
        </p>
      ) : (
        <Card as="div" className="overflow-hidden">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-rule text-[12px] text-ink-muted">
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Exercise
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Best estimated 1RM
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Heaviest set
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Best session volume
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ exercise, pr }) => (
                <tr key={exercise.id} className="border-b border-rule last:border-0">
                  <th scope="row" className="px-5 py-2.5 font-medium text-ink">
                    {exercise.name}
                  </th>
                  <td className="tabular px-3 py-2.5 text-ink">
                    {pr.bestE1rm ? `${display(pr.bestE1rm.value, unit)} ${unit}` : '—'}
                    <span className="ml-1.5 text-[12px] text-ink-faint">
                      {pr.bestE1rm ? formatDate(pr.bestE1rm.date, { year: false }) : ''}
                    </span>
                  </td>
                  <td className="tabular px-3 py-2.5 text-ink">
                    {pr.heaviest
                      ? `${display(pr.heaviest.loadKg, unit)} ${unit} × ${pr.heaviest.reps}`
                      : '—'}
                  </td>
                  <td className="tabular px-5 py-2.5 text-ink">
                    {pr.bestVolume
                      ? `${Math.round(kgToUnit(pr.bestVolume.value, unit)).toLocaleString('en-GB')} ${unit}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}

function History({
  workouts,
  exercises,
  unit,
}: {
  workouts: Workout[];
  exercises: Exercise[];
  unit: WeightUnit;
}) {
  const names = new Map(exercises.map((e) => [e.id, e.name]));
  const recent = workouts
    .filter((w) => w.sets.length > 0)
    .slice(-10)
    .reverse();
  if (recent.length === 0) return null;
  return (
    <section aria-labelledby="history">
      <SectionTitle id="history">Recent sessions</SectionTitle>
      <Card as="div">
        <ul>
          {recent.map((w) => {
            const byExercise = new Map<string, WorkoutSet[]>();
            for (const s of w.sets)
              byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s]);
            return (
              <li key={w.id} className="border-b border-rule px-5 py-3 last:border-0">
                <div className="text-[13px] font-semibold text-ink">
                  {weekdayShort(w.date)} {formatDate(w.date)}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-ink-muted">
                  {[...byExercise.entries()].map(([id, sets]) => (
                    <span key={id}>
                      <span className="text-ink">{names.get(id) ?? 'Exercise'}</span>{' '}
                      {sets.map((s) => `${display(s.loadKg, unit)}×${s.reps}`).join(', ')}
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
