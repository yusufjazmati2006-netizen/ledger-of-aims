import { addDays, localDateOf, startOfWeek, type LocalDate } from '../time/localDate';

export interface TimeEntry {
  startedAt: string;
  /** null while the timer is running. */
  endedAt: string | null;
}

/**
 * Minutes per local calendar day. An entry that runs past midnight (common after a
 * night shift) is split across the two days. A running entry counts up to `now`.
 */
export function minutesByDay(entries: readonly TimeEntry[], now: Date): Map<LocalDate, number> {
  const out = new Map<LocalDate, number>();
  for (const e of entries) {
    let start = new Date(e.startedAt);
    const end = e.endedAt ? new Date(e.endedAt) : now;
    while (start < end) {
      const nextMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
      const sliceEnd = end < nextMidnight ? end : nextMidnight;
      const day = localDateOf(start);
      out.set(day, (out.get(day) ?? 0) + (sliceEnd.getTime() - start.getTime()) / 60000);
      start = sliceEnd;
    }
  }
  return out;
}

export function weeklyHours(
  entries: readonly TimeEntry[],
  today: LocalDate,
  weekStartsOn: number,
  weeks: number,
  now: Date,
): { weekStart: LocalDate; hours: number }[] {
  const byDay = minutesByDay(entries, now);
  const current = startOfWeek(today, weekStartsOn);
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(current, -7 * (weeks - 1 - i));
    let minutes = 0;
    for (let d = 0; d < 7; d++) minutes += byDay.get(addDays(weekStart, d)) ?? 0;
    return { weekStart, hours: minutes / 60 };
  });
}

/** Elapsed whole seconds of a running timer. */
export function elapsedSeconds(startedAt: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000));
}

export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h > 0 ? `${h}:` : ''}${String(m).padStart(h > 0 ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
}
