import { diffDays, type LocalDate } from '../time/localDate';

export type Urgency = 'calm' | 'soon' | 'near' | 'imminent' | 'overdue';

/**
 * Escalating urgency for a deadline:
 *   more than 14 days → calm · 7–14 → soon · 3–6 → near · 0–2 → imminent · past → overdue
 */
export function urgencyOf(today: LocalDate, due: LocalDate): Urgency {
  const days = diffDays(today, due);
  if (days < 0) return 'overdue';
  if (days <= 2) return 'imminent';
  if (days <= 6) return 'near';
  if (days <= 14) return 'soon';
  return 'calm';
}

export interface DeadlineItem {
  id: string;
  title: string;
  due: LocalDate;
  done: boolean;
}

/** The next `count` open deadlines, overdue ones first. */
export function nextDeadlines<T extends DeadlineItem>(
  items: readonly T[],
  today: LocalDate,
  count = 3,
): T[] {
  return items
    .filter((i) => !i.done)
    .sort((a, b) => a.due.localeCompare(b.due))
    .filter((i) => diffDays(today, i.due) >= -30)
    .slice(0, count);
}

export function countdownText(today: LocalDate, due: LocalDate): string {
  const days = diffDays(today, due);
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} overdue`;
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  return `${days} days`;
}
