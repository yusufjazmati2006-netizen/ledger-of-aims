import { useState } from 'react';
import { Link } from 'react-router';
import { diffDays, formatDate, parts, monthLong, weekdayLong } from '@shared/domain/time/localDate';
import { countdown, nextMilestone } from '@shared/domain/milestones/milestones';
import { targetWeightAt, type TrajectoryPoint } from '@shared/domain/physique/trajectory';
import { GOAL_IDS, type GoalId } from '@shared/schemas/common';
import type { Goal, Milestone, ShiftType, WeighIn } from '@shared/schemas/core';
import { useSettings, useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { api } from '../../lib/api';
import { formatWeight } from '../../lib/units';
import { GOAL_META } from '../../lib/goals';
import { Card, PageHeader, Pill } from '../../design/Card';
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
  const weighIns = useLedger('weighIns.list', {}, { domains: ['weighIns'] });

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
              <GoalCard
                key={id}
                goal={goal}
                today={today}
                milestones={milestones.data ?? []}
                weighIns={weighIns.data ?? []}
              />
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
  weighIns,
}: {
  goal: Goal;
  today: string;
  milestones: Milestone[];
  weighIns: WeighIn[];
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

      <GoalProgress goalId={goal.id} today={today} milestones={milestones} weighIns={weighIns} />

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
function GoalProgress({
  goalId,
  today,
  milestones,
  weighIns,
}: {
  goalId: GoalId;
  today: string;
  milestones: Milestone[];
  weighIns: WeighIn[];
}) {
  const settings = useSettings();
  if (goalId === 'physique') {
    const latest = weighIns[weighIns.length - 1];
    const { startWeightKg, startDate } = settings.profile;
    if (!latest || startWeightKg === null || startDate === null) {
      return <p className="mt-4 text-[13px] text-ink-muted">Log a weigh-in to start the trend.</p>;
    }
    const points: TrajectoryPoint[] = [
      { date: startDate, kg: startWeightKg },
      ...milestones
        .filter((m) => m.goalId === 'physique' && m.targetValue !== null)
        .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
        .map((m) => ({ date: m.targetDate, kg: m.targetValue ?? 0 })),
    ];
    const target = targetWeightAt(points, today);
    const finalKg = points[points.length - 1]?.kg ?? startWeightKg;
    const progress =
      finalKg === startWeightKg ? 0 : (latest.weightKg - startWeightKg) / (finalKg - startWeightKg);
    return (
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <div className="tabular font-serif text-[28px] leading-none font-semibold text-ink">
            {formatWeight(latest.weightKg, settings.general.units)}
          </div>
          <div className="mt-1 text-[12.5px] text-ink-muted">
            {latest.date === today
              ? 'weighed today'
              : `last weighed ${formatDate(latest.date, { year: false })}`}
            {target !== null
              ? ` · target today ${formatWeight(target, settings.general.units)}`
              : ''}
          </div>
        </div>
        <Pill tone="accent">
          {Math.round(Math.max(0, Math.min(1, progress)) * 100)}% of the way
        </Pill>
      </div>
    );
  }
  return (
    <p className="mt-4 text-[13px] text-ink-muted">
      Progress tracking for this goal arrives with its module.
    </p>
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
