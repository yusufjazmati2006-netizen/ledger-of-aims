import type { Milestone } from '../../schemas/core';
import type { GoalId } from '../../schemas/common';
import { diffDays, type LocalDate } from '../time/localDate';

/** Milestones of one goal in their user-defined order. */
export function milestonesFor(milestones: readonly Milestone[], goalId: GoalId): Milestone[] {
  return milestones
    .filter((m) => m.goalId === goalId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.targetDate.localeCompare(b.targetDate));
}

/**
 * The next milestone to aim for: the earliest-dated incomplete milestone that is not
 * a hard stop. Overdue milestones still count — they are the most pressing.
 */
export function nextMilestone(
  milestones: readonly Milestone[],
  goalId: GoalId,
): Milestone | undefined {
  return milestones
    .filter((m) => m.goalId === goalId && m.completedAt === null && m.kind !== 'hard-stop')
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0];
}

export interface Countdown {
  days: number;
  overdue: boolean;
  label: string;
}

export function countdown(today: LocalDate, target: LocalDate): Countdown {
  const days = diffDays(today, target);
  if (days < 0)
    return { days, overdue: true, label: `${-days} day${days === -1 ? '' : 's'} overdue` };
  if (days === 0) return { days, overdue: false, label: 'due today' };
  if (days < 60) return { days, overdue: false, label: `${days} day${days === 1 ? '' : 's'} left` };
  const weeks = Math.round(days / 7);
  if (days < 365) return { days, overdue: false, label: `${days} days · ~${weeks} weeks` };
  const years = days / 365.25;
  return { days, overdue: false, label: `${days} days · ~${years.toFixed(1)} years` };
}
