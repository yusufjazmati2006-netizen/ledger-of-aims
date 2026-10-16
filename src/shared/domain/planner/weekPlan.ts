/**
 * Proposes a week of blocks for every goal at once, inside the shift-aware free
 * windows from `freeTime.ts`.
 *
 * Demands are placed in priority order, so the things that must happen on a given
 * day (Quran revision, a training session) claim their time before flexible weekly
 * budgets (study, game) are spread across what remains. Each placement leaves a short
 * break after it. Existing blocks — accepted, pinned or done — are never moved; their
 * time is simply unavailable. Whatever cannot be placed is reported, never hidden.
 */
import type { GoalId } from '../../schemas/common';
import type { LocalDate } from '../time/localDate';
import type { DayFrame } from './freeTime';
import { length, roundUp, subtract, type Interval } from './intervals';

export type Preference = 'early' | 'late';

export interface Demand {
  key: string;
  goalId: GoalId;
  kind: string;
  title: string;
  /** One block on each listed date (e.g. daily revision, training days). */
  daily?: { dates: readonly LocalDate[]; minutes: number; minMinutes: number };
  /** A budget spread over the week, one session per day per round. */
  weekly?: { minutes: number; session: number; minSession: number; maxPerDay: number };
  /** Only on days without a shift (e.g. meal prep). */
  offDaysOnly?: boolean;
  prefer: Preference;
}

export interface ProposedBlock {
  date: LocalDate;
  start: number;
  end: number;
  goalId: GoalId;
  kind: string;
  title: string;
  demand: string;
}

export interface Unplaced {
  demand: string;
  title: string;
  goalId: GoalId;
  minutes: number;
}

export interface WeekPlan {
  blocks: ProposedBlock[];
  unplaced: Unplaced[];
}

export interface PlanOptions {
  /** Time already taken by existing blocks, per date. */
  occupied?: ReadonlyMap<LocalDate, readonly Interval[]>;
  /** Nothing is placed before this moment (plus a short lead time). */
  now?: { date: LocalDate; minute: number };
  breakMinutes?: number;
  /** Windows shorter than this are ignored. */
  minWindow?: number;
}

export function planWeek(
  frames: readonly DayFrame[],
  demands: readonly Demand[],
  options: PlanOptions = {},
): WeekPlan {
  const pause = options.breakMinutes ?? 10;
  const minWindow = options.minWindow ?? 15;
  const free = new Map<LocalDate, Interval[]>();
  const offDay = new Map<LocalDate, boolean>();
  for (const f of frames) {
    const taken = (options.occupied?.get(f.date) ?? []).map((i) => ({
      start: i.start - pause,
      end: i.end + pause,
    }));
    let windows = subtract(f.windows, taken);
    if (options.now) {
      if (f.date < options.now.date) windows = [];
      else if (f.date === options.now.date)
        windows = subtract(windows, [{ start: 0, end: roundUp(options.now.minute + 10) }]);
    }
    free.set(
      f.date,
      windows.filter((w) => length(w) >= minWindow),
    );
    offDay.set(f.date, f.shift === null);
  }

  const blocks: ProposedBlock[] = [];
  const unplaced: Unplaced[] = [];
  const allowed = (d: Demand, date: LocalDate) =>
    free.has(date) && (!d.offDaysOnly || offDay.get(date) === true);

  const place = (d: Demand, date: LocalDate, minutes: number, minMinutes: number): number => {
    const windows = free.get(date) ?? [];
    const fits = windows.filter((w) => length(w) >= minutes);
    let window: Interval | undefined;
    let duration = minutes;
    if (fits.length > 0) {
      window = d.prefer === 'early' ? fits[0] : fits[fits.length - 1];
    } else {
      // Nothing holds the full length: take the largest window if it holds the minimum.
      window = [...windows].sort((a, b) => length(b) - length(a))[0];
      duration = window ? length(window) : 0;
      if (duration < minMinutes) return 0;
    }
    if (!window) return 0;
    const start = d.prefer === 'early' ? window.start : window.end - duration;
    const block = { start, end: start + duration };
    blocks.push({ date, ...block, goalId: d.goalId, kind: d.kind, title: d.title, demand: d.key });
    free.set(
      date,
      subtract(windows, [{ start: block.start - pause, end: block.end + pause }]).filter(
        (w) => length(w) >= minWindow,
      ),
    );
    return duration;
  };

  for (const d of demands) {
    if (d.daily) {
      let missing = 0;
      for (const date of d.daily.dates) {
        if (!free.has(date)) continue; // outside this week, or already past
        if (options.now && date < options.now.date) continue;
        if (!allowed(d, date)) {
          missing += d.daily.minutes;
          continue;
        }
        missing += d.daily.minutes - place(d, date, d.daily.minutes, d.daily.minMinutes);
      }
      if (missing > 0)
        unplaced.push({ demand: d.key, title: d.title, goalId: d.goalId, minutes: missing });
    }

    if (d.weekly && d.weekly.minutes > 0) {
      const w = d.weekly;
      let remaining = w.minutes;
      const perDay = new Map<LocalDate, number>();
      const dates = [...free.keys()].filter((date) => allowed(d, date)).sort();
      for (let round = 0; round < w.maxPerDay && remaining >= w.minSession; round++) {
        let placedThisRound = false;
        for (const date of dates) {
          if (remaining < w.minSession) break;
          if ((perDay.get(date) ?? 0) > round) continue;
          const want = Math.min(w.session, Math.max(remaining, w.minSession));
          const got = place(d, date, want, w.minSession);
          if (got === 0) continue;
          remaining -= got;
          perDay.set(date, (perDay.get(date) ?? 0) + 1);
          placedThisRound = true;
        }
        if (!placedThisRound) break;
      }
      if (remaining > 0)
        unplaced.push({ demand: d.key, title: d.title, goalId: d.goalId, minutes: remaining });
    }
  }

  blocks.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  return { blocks, unplaced };
}
