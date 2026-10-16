import { useState, type SyntheticEvent } from 'react';
import { addDays, formatDate, weekdayShort } from '@shared/domain/time/localDate';
import { GOAL_IDS, type GoalId } from '@shared/schemas/common';
import { useToday } from '../../stores/app';
import { api, ApiError } from '../../lib/api';
import { cx } from '../../lib/cx';
import { GOAL_META } from '../../lib/goals';
import { toast } from '../../stores/toasts';
import { Card, EmptyState, Pill, SectionTitle } from '../../design/Card';
import { Button, IconButton } from '../../design/Button';
import { Field, LabeledInput, Select } from '../../design/Field';
import { useHabits, type HabitView } from './useHabits';

const DAYS = 14;

/**
 * Small daily habits with forgiving streaks: a missed day inside the grace allowance
 * (one in any seven by default) bends the streak rather than breaking it.
 */
export function HabitsPage() {
  const habits = useHabits();
  const [showArchived, setShowArchived] = useState(false);
  if (!habits.ready) return <div className="h-[300px]" />;
  return (
    <div className="flex flex-col gap-6">
      {habits.active.length === 0 ? (
        <EmptyState icon="check" title="No habits yet">
          Add the few small things that keep the big goals moving — “Weigh in before breakfast”,
          “Phone outside the bedroom”, “Ten minutes of revision on shift breaks”. Tick them from
          Today.
        </EmptyState>
      ) : (
        <Card as="div">
          <ul>
            {habits.active.map((h) => (
              <HabitRow key={h.id} habit={h} />
            ))}
          </ul>
        </Card>
      )}
      <AddHabit />
      {habits.archived.length > 0 ? (
        <section aria-labelledby="archived-habits">
          <SectionTitle
            id="archived-habits"
            action={
              <Button size="sm" variant="ghost" onClick={() => setShowArchived(!showArchived)}>
                {showArchived ? 'Hide' : `Show ${habits.archived.length}`}
              </Button>
            }
          >
            Archived
          </SectionTitle>
          {showArchived ? (
            <Card as="div">
              <ul>
                {habits.archived.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center gap-3 border-b border-rule px-5 py-2.5 last:border-0"
                  >
                    <span className="flex-1 text-[13.5px] text-ink-muted">{h.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void api('habits.save', { ...h, archived: false })}
                    >
                      Restore
                    </Button>
                    <IconButton
                      icon="trash"
                      size="sm"
                      tone="danger"
                      label={`Delete ${h.name} and its history`}
                      onClick={() => void api('habits.delete', { id: h.id })}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function HabitRow({ habit }: { habit: HabitView }) {
  const today = useToday();
  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, i - DAYS + 1));
  const s = habit.streak;
  const toggle = (date: string) =>
    void api('habits.check', { habitId: habit.id, date, done: !habit.checks.has(date) }).catch(() =>
      toast.error('Could not update the habit.'),
    );
  return (
    <li
      className="flex flex-wrap items-center gap-4 border-b border-rule px-5 py-3 last:border-0"
      data-goal={habit.goalId ?? undefined}
    >
      <div className="min-w-[180px] flex-1">
        <div className="text-[13.5px] font-medium text-ink">{habit.name}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
          {habit.goalId ? (
            <span className="text-accent">{GOAL_META[habit.goalId].short}</span>
          ) : null}
          <span>
            {s.length > 0 ? `${s.length}-day streak` : 'No streak yet'}
            {s.longest > s.length ? ` · best ${s.longest}` : ''}
          </span>
          {s.graceUsed > 0 ? <span>· grace used</span> : null}
          {s.atRisk ? <Pill tone="warning">At risk today</Pill> : null}
        </div>
      </div>
      <div className="flex gap-1" role="group" aria-label={`${habit.name}, last ${DAYS} days`}>
        {days.map((d) => {
          const done = habit.checks.has(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={done}
              aria-label={`${habit.name} on ${weekdayShort(d)} ${formatDate(d, { year: false })}`}
              title={`${weekdayShort(d)} ${formatDate(d, { year: false })}`}
              onClick={() => toggle(d)}
              className={cx(
                'h-5 w-5 rounded-[5px] border transition-colors',
                done ? 'border-accent bg-accent' : 'border-rule-strong bg-surface hover:bg-sunken',
                d === today && 'ring-1 ring-ink-faint ring-offset-1 ring-offset-surface',
              )}
            />
          );
        })}
      </div>
      <IconButton
        icon="folder"
        size="sm"
        label={`Archive ${habit.name}`}
        onClick={() => void api('habits.save', { ...habit, archived: true })}
      />
    </li>
  );
}

function AddHabit() {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState<GoalId | ''>('');
  const [grace, setGrace] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name the habit.');
      return;
    }
    try {
      await api('habits.save', {
        name: name.trim(),
        goalId: goal || null,
        graceDays: Number(grace),
        archived: false,
      });
      setName('');
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the habit.');
    }
  };
  return (
    <Card className="p-5">
      <form onSubmit={(e) => void submit(e)} aria-labelledby="add-habit">
        <h2 id="add-habit" className="mb-3 font-serif text-[17px] font-semibold text-ink">
          Add a habit
        </h2>
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_150px_170px_auto]">
          <LabeledInput
            label="Habit"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            error={error}
          />
          <Field label="Goal" htmlFor="habit-goal">
            <Select
              id="habit-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value as GoalId | '')}
            >
              <option value="">None</option>
              {GOAL_IDS.map((g) => (
                <option key={g} value={g}>
                  {GOAL_META[g].short}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Grace" htmlFor="habit-grace">
            <Select id="habit-grace" value={grace} onChange={(e) => setGrace(e.target.value)}>
              <option value="0">No missed days</option>
              <option value="1">1 missed day a week</option>
              <option value="2">2 missed days a week</option>
            </Select>
          </Field>
          <Button type="submit" variant="accent" icon="plus">
            Add habit
          </Button>
        </div>
      </form>
    </Card>
  );
}
