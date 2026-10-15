import { useState } from 'react';
import { urgencyOf, type Urgency } from '@shared/domain/degree/deadlines';
import {
  addDays,
  addMonths,
  diffDays,
  formatDate,
  monthLong,
  parts,
  startOfWeek,
  weekdayNameShort,
} from '@shared/domain/time/localDate';
import { useSettings, useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { cx } from '../../lib/cx';
import { Card } from '../../design/Card';
import { IconButton, Button } from '../../design/Button';
import { Switch } from '../../design/Field';
import { GOAL_META } from '../../lib/goals';
import { isDone, useDegree } from './useDegree';

interface CalendarItem {
  id: string;
  date: string;
  title: string;
  kind: 'assessment' | 'milestone';
  goal: keyof typeof GOAL_META;
  done: boolean;
}

const URGENCY_CLASS: Record<Urgency, string> = {
  calm: 'bg-sunken text-ink',
  soon: 'bg-accent-soft text-accent',
  near: 'bg-warning-soft text-warning',
  imminent: 'bg-critical-soft text-critical font-semibold',
  overdue: 'bg-critical-soft text-critical font-semibold',
};

/** A month grid of assessment deadlines (coloured by urgency) and milestones. */
export function CalendarPage() {
  const today = useToday();
  const settings = useSettings();
  const degree = useDegree();
  const milestones = useLedger('milestones.list', undefined, { domains: ['milestones'] });
  const [month, setMonth] = useState(`${today.slice(0, 7)}-01`);
  const [allGoals, setAllGoals] = useState(false);

  const items: CalendarItem[] = [
    ...degree.deadlines.map((a) => ({
      id: a.id,
      date: a.dueDate ?? '',
      title: `${a.module?.code ? `${a.module.code} · ` : ''}${a.title}`,
      kind: 'assessment' as const,
      goal: 'degree' as const,
      done: isDone(a),
    })),
    ...(milestones.data ?? [])
      .filter((m) => allGoals || m.goalId === 'degree')
      .map((m) => ({
        id: m.id,
        date: m.targetDate,
        title: m.title,
        kind: 'milestone' as const,
        goal: m.goalId,
        done: m.completedAt !== null,
      })),
  ];

  const { year, month: mm } = parts(month);
  const gridStart = startOfWeek(month, settings.general.weekStartsOn);
  const nextMonth = addMonths(month, 1);
  const weeks = Math.ceil(diffDays(gridStart, nextMonth) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
  const monthItems = items
    .filter((i) => i.date >= month && i.date < nextMonth)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <IconButton
            icon="chevronLeft"
            label="Previous month"
            onClick={() => setMonth(addMonths(month, -1))}
          />
          <h2 className="w-48 text-center font-serif text-[20px] font-semibold" aria-live="polite">
            {monthLong(mm)} {year}
          </h2>
          <IconButton
            icon="chevronRight"
            label="Next month"
            onClick={() => setMonth(addMonths(month, 1))}
          />
          <Button size="sm" variant="ghost" onClick={() => setMonth(`${today.slice(0, 7)}-01`)}>
            Today
          </Button>
        </div>
        <div className="w-[260px]">
          <Switch label="Show milestones of all goals" checked={allGoals} onChange={setAllGoals} />
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div role="grid" aria-label={`${monthLong(mm)} ${year}`}>
          <div role="row" className="grid grid-cols-7 border-b border-rule">
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                role="columnheader"
                className="px-2 py-2 text-[11.5px] font-medium text-ink-muted"
              >
                {weekdayNameShort(settings.general.weekStartsOn + i)}
              </div>
            ))}
          </div>
          {Array.from({ length: weeks }, (_, w) => (
            <div key={w} role="row" className="grid grid-cols-7 border-b border-rule last:border-0">
              {days.slice(w * 7, w * 7 + 7).map((d) => {
                const inMonth = d >= month && d < nextMonth;
                const dayItems = items.filter((i) => i.date === d);
                return (
                  <div
                    key={d}
                    role="gridcell"
                    aria-label={`${formatDate(d)}${dayItems.length ? `: ${dayItems.map((i) => i.title).join(', ')}` : ''}`}
                    className={cx(
                      'min-h-[92px] border-r border-rule p-1.5 last:border-r-0',
                      !inMonth && 'bg-sunken/40',
                    )}
                  >
                    <div
                      className={cx(
                        'tabular mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px]',
                        d === today
                          ? 'bg-ink font-semibold text-paper'
                          : inMonth
                            ? 'text-ink'
                            : 'text-ink-faint',
                      )}
                    >
                      {Number(d.slice(8))}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {dayItems.map((i) => (
                        <div
                          key={i.id}
                          data-goal={i.goal}
                          className={cx(
                            'truncate rounded px-1.5 py-0.5 text-[11px]',
                            i.done
                              ? 'bg-sunken text-ink-faint line-through'
                              : i.kind === 'assessment'
                                ? URGENCY_CLASS[urgencyOf(today, i.date)]
                                : 'border border-accent text-accent',
                          )}
                          title={i.title}
                        >
                          {i.kind === 'milestone' ? '◆ ' : ''}
                          {i.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      <section aria-label="This month as a list">
        {monthItems.length === 0 ? (
          <p className="text-[13px] text-ink-muted">Nothing due in {monthLong(mm)}.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-[13px]">
            {monthItems.map((i) => (
              <li key={i.id} className="flex gap-3">
                <span className="w-28 text-ink-muted">{formatDate(i.date)}</span>
                <span className={cx(i.done ? 'text-ink-faint line-through' : 'text-ink')}>
                  {i.kind === 'milestone' ? `Milestone (${GOAL_META[i.goal].short}): ` : ''}
                  {i.title}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
