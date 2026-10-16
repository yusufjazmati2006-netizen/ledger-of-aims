import { useState } from 'react';
import { findConflicts } from '@shared/domain/planner/conflicts';
import { planWeek, type WeekPlan } from '@shared/domain/planner/weekPlan';
import type { Interval } from '@shared/domain/planner/intervals';
import { durationLabel } from '@shared/domain/time/clockTime';
import {
  addDays,
  formatDate,
  maxDate,
  startOfWeek,
  weekdayShort,
  type LocalDate,
} from '@shared/domain/time/localDate';
import { GOAL_IDS } from '@shared/schemas/common';
import type { PlanBlock } from '@shared/schemas/degree';
import { useNowMinute, useSettings, useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { api, ApiError } from '../../lib/api';
import { GOAL_META } from '../../lib/goals';
import { toast } from '../../stores/toasts';
import { Card, EmptyState, Note, PageHeader, SectionTitle } from '../../design/Card';
import { Button, IconButton } from '../../design/Button';
import { Icon } from '../../design/icons';
import { BlockDialog } from './BlockDialog';
import { usePlannerFrames } from './usePlannerFrames';
import { isKept, useWeekBudgets } from './useWeekBudgets';
import { WeekGrid } from './WeekGrid';

/**
 * The week around your shifts. "Propose a plan" fills the free windows with every
 * goal's needs in priority order; you preview it, accept it, then drag blocks to suit.
 * Anything moved or added by hand is kept when you propose again.
 */
export function PlannerPage() {
  const today = useToday();
  const nowMinute = useNowMinute();
  const settings = useSettings();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(today, settings.general.weekStartsOn),
  );
  const weekEnd = addDays(weekStart, 6);
  const { frames, shiftTypeOn, ready } = usePlannerFrames(weekStart, 7);
  const shiftTypes = useLedger('shifts.types', undefined, { domains: ['shifts'] });
  const budgets = useWeekBudgets(weekStart);
  const [preview, setPreview] = useState<{ week: LocalDate; plan: WeekPlan } | null>(null);
  const [editing, setEditing] = useState<{ block: PlanBlock | null; date: LocalDate } | null>(null);
  const activePreview = preview?.week === weekStart ? preview.plan : null;
  const blocks = budgets.blocks;
  const isPastWeek = weekEnd < today;

  const kept = blocks.filter(isKept);
  // While previewing, hide the proposed blocks the preview would replace.
  const shown = activePreview ? blocks.filter((b) => isKept(b) || b.date < today) : blocks;
  const conflicts = findConflicts(frames, [
    ...shown,
    ...(activePreview?.blocks ?? []).map((b, i) => ({ ...b, id: `proposed-${i}` })),
  ]);
  const conflictIds = new Set(conflicts.flatMap((c) => c.blockIds));

  const propose = () => {
    const occupied = new Map<LocalDate, Interval[]>();
    for (const b of kept) occupied.set(b.date, [...(occupied.get(b.date) ?? []), b]);
    const plan = planWeek(frames, budgets.demands(kept), {
      occupied,
      now: { date: today, minute: nowMinute },
    });
    setPreview({ week: weekStart, plan });
  };

  const accept = async () => {
    if (!activePreview) return;
    try {
      await api('plan.apply', {
        from: maxDate(weekStart, today),
        to: weekEnd,
        blocks: activePreview.blocks.map(({ date, start, end, goalId, kind, title }) => ({
          date,
          start,
          end,
          goalId,
          kind,
          title,
        })),
      });
      setPreview(null);
      toast.success(`Added ${activePreview.blocks.length} blocks to your week.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save the plan.');
    }
  };

  const move = (block: PlanBlock, date: LocalDate, start: number) => {
    void api('plan.update', {
      id: block.id,
      patch: { date, start, end: start + block.end - block.start, pinned: true },
    }).catch((err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : 'Could not move the block.');
    });
  };

  const setShift = (date: LocalDate, shiftTypeId: string | null) => {
    void api('shifts.set', { days: [{ date, shiftTypeId }] }).catch(() => {
      toast.error('Could not update the shift.');
    });
  };

  const plannedBy = (goal: string) =>
    [...shown, ...(activePreview?.blocks ?? [])]
      .filter((b) => b.goalId === goal)
      .reduce((n, b) => n + b.end - b.start, 0);
  const proposedCount = blocks.filter((b) => !b.pinned && !b.done && b.date >= today).length;

  return (
    <div className="animate-fade-in pt-6">
      <PageHeader
        eyebrow="Planner"
        title={`Week of ${formatDate(weekStart, { year: false })}`}
        description="Free time comes from your shifts: nothing is planned in the hours after a night shift, or too late before a morning one."
        actions={
          <>
            <IconButton
              icon="chevronLeft"
              label="Previous week"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setWeekStart(startOfWeek(today, settings.general.weekStartsOn))}
            >
              This week
            </Button>
            <IconButton
              icon="chevronRight"
              label="Next week"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            />
          </>
        }
      />

      <Card className="mb-5 flex flex-wrap items-center gap-3 px-5 py-3.5">
        {activePreview ? (
          <>
            <div className="mr-auto text-[13px] text-ink">
              <span className="font-semibold">{activePreview.blocks.length} blocks proposed</span>{' '}
              <span className="text-ink-muted">
                — dashed below.
                {proposedCount > 0
                  ? ` Accepting replaces the ${proposedCount} earlier proposed block${proposedCount === 1 ? '' : 's'}; blocks you placed yourself stay.`
                  : ''}
              </span>
            </div>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Discard
            </Button>
            <Button variant="accent" icon="check" onClick={() => void accept()}>
              Accept plan
            </Button>
          </>
        ) : (
          <>
            <div className="mr-auto flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-ink-muted">
              {GOAL_IDS.map((g) => (
                <span key={g} data-goal={g} className="inline-flex items-center gap-1.5">
                  <Icon name={GOAL_META[g].icon} size={14} className="text-accent" />
                  {GOAL_META[g].short} {durationLabel(plannedBy(g))}
                </span>
              ))}
            </div>
            {proposedCount > 0 ? (
              <Button
                variant="ghost"
                onClick={() =>
                  void api('plan.clearProposed', { from: maxDate(weekStart, today), to: weekEnd })
                }
              >
                Clear proposed
              </Button>
            ) : null}
            <Button
              icon="plus"
              onClick={() => setEditing({ block: null, date: maxDate(weekStart, today) })}
            >
              Add block
            </Button>
            <Button
              variant="accent"
              icon="sparkle"
              disabled={!ready || !budgets.ready || isPastWeek}
              onClick={propose}
            >
              Propose a plan
            </Button>
          </>
        )}
      </Card>

      {activePreview && activePreview.unplaced.length > 0 ? (
        <div className="mb-4">
          <Note tone="warning" icon="alert">
            Not everything fits this week:{' '}
            {activePreview.unplaced
              .map((u) => `${u.title} (${durationLabel(u.minutes)} short)`)
              .join(', ')}
            . Consider a lighter target, or use a day off.
          </Note>
        </div>
      ) : null}

      {ready && shiftTypes.data ? (
        <WeekGrid
          frames={frames}
          blocks={shown}
          preview={activePreview?.blocks ?? []}
          conflictIds={conflictIds}
          today={today}
          nowMinute={nowMinute}
          shiftTypes={shiftTypes.data}
          shiftTypeOn={shiftTypeOn}
          onSetShift={setShift}
          onMove={move}
          onOpen={(block) => setEditing({ block, date: block.date })}
        />
      ) : (
        <div className="h-[600px] rounded-xl bg-sunken/50" />
      )}

      <section aria-labelledby="conflicts" className="mt-6">
        <SectionTitle id="conflicts">Conflicts</SectionTitle>
        {conflicts.length === 0 ? (
          blocks.length === 0 && !activePreview ? (
            <EmptyState icon="calendar" title="Nothing planned this week">
              Set each day’s shift in the column headers, then propose a plan. It fills your free
              windows with Quran revision, training, study, game sessions and meal prep, in that
              order of priority.
            </EmptyState>
          ) : (
            <p className="text-[13px] text-ink-muted">
              None — every block fits around your shifts and sleep.
            </p>
          )
        ) : (
          <ul className="flex flex-col gap-2">
            {conflicts.map((c, i) => (
              <li key={`${c.date}-${c.kind}-${i}`}>
                <Note tone="warning" icon="alert">
                  <span className="font-semibold">
                    {weekdayShort(c.date)} {formatDate(c.date, { year: false })}:
                  </span>{' '}
                  {c.message}
                </Note>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing ? (
        <BlockDialog block={editing.block} date={editing.date} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}
