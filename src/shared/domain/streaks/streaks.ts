import { addDays, diffDays, type LocalDate } from '../time/localDate';

export interface StreakRule {
  /** Misses forgiven within any window of `windowDays` consecutive days. */
  graceDays: number;
  windowDays: number;
}

export const DEFAULT_STREAK_RULE: StreakRule = { graceDays: 1, windowDays: 7 };

export interface StreakResult {
  /** Calendar days in the current streak, including forgiven misses. */
  length: number;
  /** Days within the streak on which the habit was actually met. */
  metDays: number;
  /** Misses forgiven inside the current trailing window. */
  graceUsed: number;
  graceRemaining: number;
  /** True when today is not yet done and missing it would end the streak. */
  atRisk: boolean;
  todayDone: boolean;
  startedOn: LocalDate | null;
  longest: number;
}

/**
 * A forgiving streak: it survives up to `graceDays` missed days in any window of
 * `windowDays` consecutive days, so one bad day does not zero months of work.
 *
 * Today counts if done, but an unfinished today never breaks the streak — the day
 * is not over. A streak always begins on a day that was actually met.
 */
export function computeStreak(
  metDates: Iterable<LocalDate>,
  today: LocalDate,
  rule: StreakRule = DEFAULT_STREAK_RULE,
): StreakResult {
  const met = new Set(metDates);
  const todayDone = met.has(today);
  const result = walk(met, todayDone ? today : addDays(today, -1), rule);
  const length = result.length;

  // Grace used in the trailing window that ends today.
  let graceUsed = 0;
  if (result.startedOn) {
    for (let i = 1; i < rule.windowDays; i++) {
      const d = addDays(today, -i);
      if (d < result.startedOn) break;
      if (!met.has(d)) graceUsed++;
    }
  }
  const graceRemaining = Math.max(0, rule.graceDays - graceUsed);

  return {
    length,
    metDays: result.metDays,
    graceUsed,
    graceRemaining,
    atRisk: !todayDone && length > 0 && graceRemaining === 0,
    todayDone,
    startedOn: result.startedOn,
    longest: longestStreak(met, today, rule),
  };
}

function walk(
  met: ReadonlySet<LocalDate>,
  from: LocalDate,
  rule: StreakRule,
): { length: number; metDays: number; startedOn: LocalDate | null } {
  // Walk backwards, keeping the misses seen so far. A miss breaks the streak when
  // the window starting at that day would hold more than `graceDays` misses.
  const misses: LocalDate[] = [];
  let earliestMet: LocalDate | null = null;
  let metDays = 0;
  for (let d = from; ; d = addDays(d, -1)) {
    if (met.has(d)) {
      earliestMet = d;
      metDays++;
    } else {
      misses.push(d);
      const windowEnd = addDays(d, rule.windowDays - 1);
      const inWindow = misses.filter((m) => m <= windowEnd).length;
      if (inWindow > rule.graceDays) break;
    }
    if (diffDays(d, from) > 3650) break; // a decade is plenty
  }
  if (earliestMet === null) return { length: 0, metDays: 0, startedOn: null };
  return { length: diffDays(earliestMet, from) + 1, metDays, startedOn: earliestMet };
}

/** The longest streak ending on or before `today`. */
export function longestStreak(
  met: ReadonlySet<LocalDate>,
  today: LocalDate,
  rule: StreakRule = DEFAULT_STREAK_RULE,
): number {
  let best = 0;
  // Evaluate a candidate streak ending at each met day; cheap for realistic sizes.
  for (const d of met) {
    if (d > today) continue;
    if (met.has(addDays(d, 1)) && addDays(d, 1) <= today) continue; // not an end point
    best = Math.max(best, walk(met, d, rule).length);
  }
  return best;
}
