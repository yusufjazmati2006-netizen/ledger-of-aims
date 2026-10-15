import { useState, type SyntheticEvent } from 'react';
import { elapsedSeconds, formatElapsed, minutesByDay, weeklyHours } from '@shared/domain/game/time';
import { parseDuration } from '@shared/domain/time/duration';
import { durationLabel, fromMinutes } from '@shared/domain/time/clockTime';
import {
  addDays,
  diffDays,
  formatDate,
  localDateOf,
  startOfWeek,
  weekdayShort,
} from '@shared/domain/time/localDate';
import type { TimeEntryRecord } from '@shared/schemas/game';
import { useSettings, useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { useNow } from '../../lib/useNow';
import { api, ApiError } from '../../lib/api';
import { cx } from '../../lib/cx';
import { toast } from '../../stores/toasts';
import { Card, EmptyState, Note, Pill, SectionTitle, Stat } from '../../design/Card';
import { Button, IconButton } from '../../design/Button';
import { Dialog } from '../../design/Dialog';
import { LabeledInput, SegmentedControl, TextInput } from '../../design/Field';
import { Meter } from '../../design/Ring';
import { BarChartCard } from '../../design/charts/BarChartCard';
import { useTokenColors } from '../../design/charts/colors';

const MAX_WEEKS = 12;
const MIN_WEEKS = 4;

/**
 * Hours on the game: a timer that survives restarts, manual entries for time that
 * was not timed, the weekly total against a target, and a log of sessions in which
 * focus sessions — uninterrupted, deliberate work — are marked.
 */
export function TimePage() {
  const today = useToday();
  const settings = useSettings();
  const colors = useTokenColors(['game'] as const);
  const now = useNow(60_000);
  const weekStart = startOfWeek(today, settings.general.weekStartsOn);
  // Chart the weeks since the plan began (at least a few, at most twelve) rather than
  // a row of empty weeks from before the ledger existed.
  const planWeek = startOfWeek(settings.general.planStartDate, settings.general.weekStartsOn);
  const sincePlan = Math.floor(diffDays(weekStart, planWeek) / 7) + 1;
  const weekCount = Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, sincePlan));
  const running = useLedger('time.running', undefined, { domains: ['game'] });
  const entries = useLedger(
    'time.list',
    { from: addDays(weekStart, -7 * (weekCount - 1)), to: today },
    { domains: ['game'] },
  );
  const all = entries.data ?? [];
  const target = settings.game.weeklyHoursTarget;

  const weeks = weeklyHours(all, today, settings.general.weekStartsOn, weekCount, now);
  const thisWeek = weeks[weeks.length - 1]?.hours ?? 0;
  const fullWeeks = weeks
    .slice(0, -1)
    .filter((w) => w.weekStart >= planWeek)
    .slice(-4);
  const average = fullWeeks.reduce((n, w) => n + w.hours, 0) / Math.max(1, fullWeeks.length);
  const finished = all.filter((e) => e.endedAt !== null);
  const focusThisWeek = finished.filter(
    (e) => e.focus && localDateOf(new Date(e.startedAt)) >= weekStart,
  );
  const focusMinutes = [...minutesByDay(focusThisWeek, now).values()].reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-6">
      <Card className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <TimerPanel key={running.data?.id ?? 'idle'} running={running.data ?? null} />
        <Stat
          label="This week"
          value={thisWeek.toFixed(1)}
          unit={`of ${target} h`}
          hint={
            <>
              <Meter
                value={thisWeek / Math.max(0.1, target)}
                label="Game hours this week against target"
                className="mt-2"
              />
              <span className="mt-1.5 block">
                {fullWeeks.length > 0
                  ? `${average.toFixed(1)} h/week over the last ${fullWeeks.length === 1 ? 'week' : `${fullWeeks.length} weeks`}`
                  : 'Your weekly average appears after the first full week.'}
              </span>
            </>
          }
        />
        <Stat
          label="Focus sessions"
          value={focusThisWeek.length}
          unit="this week"
          hint={focusThisWeek.length > 0 ? `${spanLabel(focusMinutes)} of deep work` : 'None yet'}
        />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="p-6">
          <BarChartCard
            title="Hours per week"
            summary={`Hours on the game in each of the last ${weekCount} weeks against a ${target}-hour weekly target. This week: ${thisWeek.toFixed(1)} hours.`}
            rows={weeks.map((w) => ({
              label: formatDate(w.weekStart, { year: false }),
              detail: `Week of ${formatDate(w.weekStart)}`,
              value: w.hours,
            }))}
            color={colors.game}
            seriesLabel="Hours"
            unit="h"
            reference={target > 0 ? { value: target, label: 'Weekly target' } : undefined}
          />
        </Card>
        <Card className="p-5">
          <ManualEntry />
        </Card>
      </div>

      <SessionLog entries={finished} />
    </div>
  );
}

function TimerPanel({ running }: { running: TimeEntryRecord | null }) {
  const settings = useSettings();
  const now = useNow(1000, running !== null);
  const [note, setNote] = useState(running?.note ?? '');
  const [focus, setFocus] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong with the timer.');
    } finally {
      setBusy(false);
    }
  };

  if (!running) {
    return (
      <form
        aria-label="Start a timer"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => api('time.start', { note: note.trim() }));
        }}
      >
        <div className="eyebrow mb-1">Timer</div>
        <div className="tabular mb-3 text-[34px] leading-none font-semibold text-ink-faint">
          0:00
        </div>
        <div className="flex gap-2">
          <TextInput
            aria-label="What are you working on?"
            placeholder="What are you working on?"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button type="submit" variant="accent" icon="play" disabled={busy}>
            Start
          </Button>
        </div>
      </form>
    );
  }

  const seconds = elapsedSeconds(running.startedAt, now);
  const started = new Date(running.startedAt);
  const long = seconds >= settings.game.longTimerHours * 3600;
  return (
    <div role="group" aria-label="Running timer">
      <div className="eyebrow mb-1 !text-accent">
        Running since {fromMinutes(started.getHours() * 60 + started.getMinutes())}
      </div>
      <div
        className="tabular mb-3 text-[34px] leading-none font-semibold text-ink"
        role="timer"
        aria-label={`Elapsed ${durationLabel(seconds / 60)}`}
      >
        {formatElapsed(seconds)}
      </div>
      <div className="flex flex-col gap-2">
        <TextInput
          aria-label="What are you working on?"
          placeholder="What are you working on?"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="mr-auto flex items-center gap-2 text-[12.5px] text-ink-muted">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--game)]"
              checked={focus}
              onChange={(e) => setFocus(e.target.checked)}
            />
            Focus session
          </label>
          {confirmDiscard ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDiscard(false)}>
                Keep
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={() => void run(() => api('time.delete', { id: running.id }))}
              >
                Discard this time
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmDiscard(true)}>
              Discard
            </Button>
          )}
          <Button
            variant="accent"
            icon="stop"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const entry = await api('time.stop', { note: note.trim(), focus });
                const minutes =
                  (new Date(entry.endedAt ?? entry.startedAt).getTime() -
                    new Date(entry.startedAt).getTime()) /
                  60_000;
                toast.success(
                  minutes < 1
                    ? 'Logged under a minute. Discard or edit it in the session log if it was a slip.'
                    : `Logged ${durationLabel(minutes)} on the game.`,
                );
              })
            }
          >
            Stop
          </Button>
        </div>
        {long ? (
          <Note tone="warning" icon="clock">
            This timer has run for over {settings.game.longTimerHours} hours. If you forgot to stop
            it, stop it now and correct the entry in the session log below.
          </Note>
        ) : null}
      </div>
    </div>
  );
}

/** Shared by manual entry and editing an existing entry. */
function useEntryForm(initial?: {
  date: string;
  start: string;
  duration: string;
  focus: boolean;
  note: string;
}) {
  const today = useToday();
  const [date, setDate] = useState(initial?.date ?? today);
  const [start, setStart] = useState(initial?.start ?? '');
  const [duration, setDuration] = useState(initial?.duration ?? '');
  const [focus, setFocus] = useState(initial?.focus ?? false);
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const validate = () => {
    const minutes = parseDuration(duration);
    if (minutes === null) {
      setError('Enter a duration such as 45m, 1.5h or 1:30.');
      return null;
    }
    if (date > today) {
      setError('Time can only be logged for today or earlier.');
      return null;
    }
    setError(null);
    return { date, start: start || null, minutes, focus, note: note.trim() };
  };

  const fields = (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <LabeledInput
          label="Date"
          type="date"
          max={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <LabeledInput
          label="Started at"
          type="time"
          hint="Optional"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </div>
      <LabeledInput
        label="Duration"
        placeholder="e.g. 45m, 1.5h, 1:30"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        error={error}
        hint="A bare number means minutes."
      />
      <LabeledInput
        label="What did you work on?"
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
      />
      <label className="flex items-center gap-2 text-[13px] text-ink-muted">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--game)]"
          checked={focus}
          onChange={(e) => setFocus(e.target.checked)}
        />
        Focus session (uninterrupted, deliberate work)
      </label>
    </div>
  );

  const reset = () => {
    setDuration('');
    setNote('');
    setFocus(false);
    setStart('');
  };

  return { fields, validate, reset, setError };
}

function ManualEntry() {
  const form = useEntryForm();
  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const values = form.validate();
    if (!values) return;
    try {
      await api('time.addManual', values);
      form.reset();
      toast.success(`Logged ${durationLabel(values.minutes)} on the game.`);
    } catch (err) {
      form.setError(err instanceof ApiError ? err.message : 'Could not log the time.');
    }
  };
  return (
    <form onSubmit={(e) => void submit(e)} aria-labelledby="manual-time">
      <h2 id="manual-time" className="mb-3 font-serif text-[17px] font-semibold text-ink">
        Add time manually
      </h2>
      {form.fields}
      <Button type="submit" variant="accent" icon="plus" className="mt-4 w-full">
        Add entry
      </Button>
    </form>
  );
}

type LogFilter = 'all' | 'focus';

function SessionLog({ entries }: { entries: TimeEntryRecord[] }) {
  const today = useToday();
  const [filter, setFilter] = useState<LogFilter>('all');
  const [limit, setLimit] = useState(30);
  const [editing, setEditing] = useState<TimeEntryRecord | null>(null);
  const shown = entries
    .filter((e) => filter === 'all' || e.focus)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const visible = shown.slice(0, limit);

  const groups = new Map<string, TimeEntryRecord[]>();
  for (const e of visible) {
    const day = localDateOf(new Date(e.startedAt));
    groups.set(day, [...(groups.get(day) ?? []), e]);
  }
  const dayLabel = (day: string) => {
    const ago = diffDays(today, day);
    if (ago === 0) return 'Today';
    if (ago === 1) return 'Yesterday';
    return `${weekdayShort(day)} ${formatDate(day, { year: false })}`;
  };

  return (
    <section aria-labelledby="session-log">
      <SectionTitle
        id="session-log"
        action={
          <SegmentedControl
            label="Show sessions"
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All sessions' },
              { value: 'focus', label: 'Focus only' },
            ]}
          />
        }
      >
        Session log
      </SectionTitle>
      {visible.length === 0 ? (
        <EmptyState
          icon="clock"
          title={filter === 'focus' ? 'No focus sessions yet' : 'No time logged yet'}
        >
          {filter === 'focus'
            ? 'Tick “Focus session” when you stop the timer after a stretch of uninterrupted work.'
            : 'Start the timer when you sit down to work, or add time you have already spent.'}
        </EmptyState>
      ) : (
        <Card as="div">
          {[...groups.entries()].map(([day, items]) => (
            <div key={day} className="border-b border-rule last:border-0">
              <div className="flex items-baseline justify-between px-5 pt-3 pb-1">
                <h3 className="text-[12.5px] font-semibold text-ink-muted">{dayLabel(day)}</h3>
                <span className="tabular text-[12px] text-ink-faint">
                  {durationLabel(items.reduce((n, e) => n + minutesOf(e), 0))}
                </span>
              </div>
              <ul>
                {items.map((e) => (
                  <li key={e.id} className="group flex items-center gap-4 px-5 py-2">
                    <span className="tabular w-[92px] shrink-0 text-[12.5px] text-ink-muted">
                      {clockOf(e.startedAt)}–{e.endedAt ? clockOf(e.endedAt) : ''}
                    </span>
                    <span className="tabular w-[84px] shrink-0 text-[13px] font-medium text-ink">
                      {spanLabel(minutesOf(e))}
                    </span>
                    <span
                      className={cx(
                        'min-w-0 flex-1 truncate text-[13px]',
                        e.note ? 'text-ink' : 'text-ink-faint',
                      )}
                    >
                      {e.note || 'No note'}
                    </span>
                    {e.focus ? (
                      <Pill tone="accent" icon="bolt">
                        Focus
                      </Pill>
                    ) : null}
                    {e.kind === 'manual' ? (
                      <span className="text-[11.5px] text-ink-faint">manual</span>
                    ) : null}
                    <IconButton
                      icon="edit"
                      size="sm"
                      label={`Edit entry ${e.note || clockOf(e.startedAt)}`}
                      onClick={() => setEditing(e)}
                    />
                    <IconButton
                      icon="trash"
                      size="sm"
                      tone="danger"
                      label={`Delete entry ${e.note || clockOf(e.startedAt)}`}
                      onClick={() =>
                        void api('time.delete', { id: e.id }).then(() =>
                          toast.success('Entry deleted.'),
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}
      {shown.length > limit ? (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setLimit((n) => n + 30)}>
          Show more
        </Button>
      ) : null}
      {editing ? <EditEntryDialog entry={editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}

function EditEntryDialog({ entry, onClose }: { entry: TimeEntryRecord; onClose: () => void }) {
  const form = useEntryForm({
    date: localDateOf(new Date(entry.startedAt)),
    start: clockOf(entry.startedAt),
    duration: String(Math.round(minutesOf(entry))),
    focus: entry.focus,
    note: entry.note,
  });
  const save = async () => {
    const values = form.validate();
    if (!values) return;
    try {
      await api('time.update', { id: entry.id, ...values });
      onClose();
    } catch (err) {
      form.setError(err instanceof ApiError ? err.message : 'Could not save the entry.');
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      goal="game"
      title="Edit time entry"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      {form.fields}
    </Dialog>
  );
}

function minutesOf(e: TimeEntryRecord): number {
  if (!e.endedAt) return 0;
  return (new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) / 60_000;
}

function clockOf(iso: string): string {
  const d = new Date(iso);
  return fromMinutes(d.getHours() * 60 + d.getMinutes());
}

function spanLabel(minutes: number): string {
  return minutes > 0 && minutes < 1 ? '< 1 min' : durationLabel(minutes);
}
