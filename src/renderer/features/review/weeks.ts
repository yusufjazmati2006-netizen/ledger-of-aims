import { addDays, diffDays, startOfWeek, type LocalDate } from '@shared/domain/time/localDate';

/**
 * The week to review: the current one from its last day, or last week's early in the
 * next if it was never completed (a missed Sunday should not lose the review).
 */
export function defaultReviewWeek(
  today: LocalDate,
  weekStartsOn: number,
  lastWeekDone: boolean,
): LocalDate {
  const current = startOfWeek(today, weekStartsOn);
  return !lastWeekDone && diffDays(current, today) <= 1 ? addDays(current, -7) : current;
}
