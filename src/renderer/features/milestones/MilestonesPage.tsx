import { countdown, milestonesFor } from '@shared/domain/milestones/milestones';
import { formatDate } from '@shared/domain/time/localDate';
import { GOAL_IDS } from '@shared/schemas/common';
import { useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { GOAL_META } from '../../lib/goals';
import { Card, PageHeader, Pill } from '../../design/Card';
import { Icon } from '../../design/icons';
import { cx } from '../../lib/cx';

export function MilestonesPage() {
  const today = useToday();
  const goals = useLedger('goals.list', undefined, { domains: ['goals'] });
  const milestones = useLedger('milestones.list', undefined, { domains: ['milestones'] });

  return (
    <div className="animate-fade-in pt-6">
      <PageHeader
        title="Milestones"
        description="Every dated checkpoint across your four aims. All dates are editable defaults."
      />
      <div className="flex flex-col gap-6">
        {GOAL_IDS.map((goalId) => {
          const goal = goals.data?.find((g) => g.id === goalId);
          const items = milestonesFor(milestones.data ?? [], goalId);
          return (
            <Card key={goalId} data-goal={goalId} className="p-5" aria-labelledby={`ms-${goalId}`}>
              <div className="mb-3 flex items-center gap-2.5">
                <Icon name={GOAL_META[goalId].icon} className="text-accent" />
                <h2 id={`ms-${goalId}`} className="font-serif text-[18px] font-semibold">
                  {goal?.title ?? GOAL_META[goalId].short}
                </h2>
              </div>
              <ol className="flex flex-col">
                {items.map((m) => {
                  const due = countdown(today, m.targetDate);
                  const done = m.completedAt !== null;
                  return (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 border-t border-rule py-2.5 first:border-t-0"
                    >
                      <span
                        className={cx(
                          'h-2.5 w-2.5 shrink-0 rounded-full border-2',
                          done ? 'border-accent bg-accent' : 'border-accent',
                        )}
                        aria-hidden="true"
                      />
                      <span
                        className={cx(
                          'flex-1 text-[13.5px]',
                          done ? 'text-ink-faint line-through' : 'text-ink',
                        )}
                      >
                        {m.title}
                      </span>
                      {m.kind === 'hard-stop' ? <Pill tone="critical">Hard stop</Pill> : null}
                      <span className="w-28 text-right text-[12.5px] text-ink-muted">
                        {formatDate(m.targetDate)}
                      </span>
                      <span
                        className={cx(
                          'tabular w-40 text-right text-[12px]',
                          due.overdue && !done ? 'text-critical' : 'text-ink-faint',
                        )}
                      >
                        {done ? 'completed' : due.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
