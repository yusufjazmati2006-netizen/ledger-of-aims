import type { WeekMetrics } from '@shared/schemas/review';
import { durationLabel } from '@shared/domain/time/clockTime';
import { GOAL_META } from '../../lib/goals';
import { Icon } from '../../design/icons';
import type { GoalId } from '@shared/schemas/common';

/** The week in figures, grouped by goal. */
export function MetricsGrid({
  m,
  unitWeight,
}: {
  m: WeekMetrics;
  unitWeight: (kg: number) => string;
}) {
  const groups: { goal: GoalId; lines: string[] }[] = [
    {
      goal: 'quran',
      lines: [
        `${m.quranPagesLearned} new page${m.quranPagesLearned === 1 ? '' : 's'}`,
        `${m.quranPagesRevised} pages revised on ${m.quranDaysRevised} day${m.quranDaysRevised === 1 ? '' : 's'}`,
      ],
    },
    {
      goal: 'game',
      lines: [
        `${durationLabel(m.gameMinutes)} worked · ${m.focusSessions} focus session${m.focusSessions === 1 ? '' : 's'}`,
        `${m.tasksFinished} task${m.tasksFinished === 1 ? '' : 's'} finished · ${m.devlogEntries} devlog entr${m.devlogEntries === 1 ? 'y' : 'ies'}`,
      ],
    },
    { goal: 'degree', lines: [`${durationLabel(m.studyMinutes)} studied`] },
    {
      goal: 'physique',
      lines: [
        `${m.workouts} workout${m.workouts === 1 ? '' : 's'}`,
        m.weightChangeKg === null
          ? `${m.weighIns} weigh-in${m.weighIns === 1 ? '' : 's'}`
          : `${m.weighIns} weigh-ins · ${m.weightChangeKg >= 0 ? '+' : '−'}${unitWeight(Math.abs(m.weightChangeKg))} over the week`,
      ],
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {groups.map((g) => (
        <div key={g.goal} data-goal={g.goal} className="min-w-0">
          <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-accent">
            <Icon name={GOAL_META[g.goal].icon} size={14} />
            {GOAL_META[g.goal].short}
          </div>
          {g.lines.map((line) => (
            <p key={line} className="text-[13px] text-ink">
              {line}
            </p>
          ))}
        </div>
      ))}
      <p className="text-[12.5px] text-ink-muted sm:col-span-2 lg:col-span-4">
        Plan: {m.planBlocksDone} of {m.planBlocksPlanned} planned blocks done
        {m.milestonesCompleted.length > 0
          ? ` · Milestones reached: ${m.milestonesCompleted.join(', ')}`
          : ''}
        .
      </p>
    </div>
  );
}
