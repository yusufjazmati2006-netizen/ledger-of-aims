/**
 * Shift-aware free time.
 *
 * Each day is modelled in minutes from its own midnight; a shift may end after
 * midnight (night shift 16:00–01:00 is start 960, end 1500). For a given day:
 *
 *   wake    = the later of the usual start of day and
 *             (yesterday's shift end + commute + wind-down + sleep + morning routine)
 *             — so after a night shift nothing is scheduled in the small hours or
 *             the morning after;
 *   bedtime = the earlier of the usual end of day and
 *             (tomorrow's shift start − commute − morning routine − sleep − wind-down)
 *             — so the evening before a morning shift ends early;
 *   busy    = today's shift with commute either side and a short recovery after it.
 *
 * Free windows are [wake, bedtime] minus busy time, at least `minWindowMinutes`
 * long, rounded to five minutes. Sleep between two consecutive shifts is checked
 * so a night-then-morning "clopen" is flagged.
 */
import { addDays, type LocalDate } from '../time/localDate';
import { length, merge, roundDown, roundUp, subtract, type Interval } from './intervals';

export interface ShiftSpan {
  start: number;
  end: number;
}

export interface PlannerRules {
  commuteMinutes: number;
  sleepMinutes: number;
  windDownMinutes: number;
  morningRoutineMinutes: number;
  postShiftRecoveryMinutes: number;
  /** Usual earliest start on a day with no constraint, minutes after midnight. */
  dayStart: number;
  /** Usual latest end for planned activity, minutes after midnight. */
  dayEnd: number;
  minWindowMinutes: number;
  /** Minimum sleep between two shifts before it is flagged. */
  minSleepBetweenShifts: number;
}

export const DEFAULT_PLANNER_RULES: PlannerRules = {
  commuteMinutes: 20,
  sleepMinutes: 8 * 60,
  windDownMinutes: 30,
  morningRoutineMinutes: 30,
  postShiftRecoveryMinutes: 30,
  dayStart: 7 * 60,
  dayEnd: 23 * 60,
  minWindowMinutes: 20,
  minSleepBetweenShifts: 7 * 60,
};

export interface DayFrame {
  date: LocalDate;
  shift: ShiftSpan | null;
  wake: number;
  bedtime: number;
  busy: Interval[];
  windows: Interval[];
  freeMinutes: number;
  /** Minutes available for sleep between yesterday's shift and today's, if both exist. */
  sleepBetweenShifts: number | null;
  shortSleep: boolean;
}

export type ShiftLookup = (date: LocalDate) => ShiftSpan | null;

export function dayFrame(
  date: LocalDate,
  shiftOn: ShiftLookup,
  rules: PlannerRules = DEFAULT_PLANNER_RULES,
): DayFrame {
  const prev = shiftOn(addDays(date, -1));
  const cur = shiftOn(date);
  const next = shiftOn(addDays(date, 1));
  const r = rules;

  let wake = r.dayStart;
  if (prev) {
    const prevEnd = prev.end - 1440; // relative to today's midnight (negative if it ended yesterday)
    wake = Math.max(
      wake,
      prevEnd + r.commuteMinutes + r.windDownMinutes + r.sleepMinutes + r.morningRoutineMinutes,
    );
  }

  let bedtime = r.dayEnd;
  if (next) {
    const nextStart = next.start + 1440;
    bedtime = Math.min(
      bedtime,
      nextStart - r.commuteMinutes - r.morningRoutineMinutes - r.sleepMinutes - r.windDownMinutes,
    );
  }

  const busy: Interval[] = [];
  if (cur) {
    busy.push({
      start: Math.max(0, cur.start - r.commuteMinutes),
      end: Math.min(1440, cur.end + r.commuteMinutes + r.postShiftRecoveryMinutes),
    });
    // After a shift that ends late or past midnight the day is over.
    if (cur.end + r.commuteMinutes + r.windDownMinutes >= bedtime)
      bedtime = Math.min(bedtime, cur.start - r.commuteMinutes);
  }

  const windows = subtract([{ start: wake, end: bedtime }], busy)
    .map((w) => ({ start: roundUp(w.start), end: roundDown(w.end) }))
    .filter((w) => length(w) >= r.minWindowMinutes);

  let sleepBetweenShifts: number | null = null;
  if (prev && cur) {
    const fallAsleep = prev.end - 1440 + r.commuteMinutes + r.windDownMinutes;
    const mustWake = cur.start - r.commuteMinutes - r.morningRoutineMinutes;
    sleepBetweenShifts = Math.max(0, mustWake - fallAsleep);
  }

  return {
    date,
    shift: cur,
    wake,
    bedtime,
    busy: merge(busy),
    windows,
    freeMinutes: windows.reduce((s, w) => s + length(w), 0),
    sleepBetweenShifts,
    shortSleep: sleepBetweenShifts !== null && sleepBetweenShifts < r.minSleepBetweenShifts,
  };
}

export function weekFrames(
  start: LocalDate,
  days: number,
  shiftOn: ShiftLookup,
  rules?: PlannerRules,
): DayFrame[] {
  return Array.from({ length: days }, (_, i) => dayFrame(addDays(start, i), shiftOn, rules));
}

export interface ProposedSession {
  date: LocalDate;
  start: number;
  end: number;
}

/**
 * Spreads `totalMinutes` of focused work across the days' free windows: sessions of
 * `sessionMinutes` (or a shorter remaining window, never under `minSession`), placed
 * at the start of each day's largest window, one per day per round, at most
 * `maxPerDay` per day. Already planned blocks are respected. Within each round days are
 * filled in date order — earlier study leaves slack before deadlines.
 */
export function proposeSessions(
  frames: readonly DayFrame[],
  options: {
    totalMinutes: number;
    sessionMinutes: number;
    minSession: number;
    maxPerDay: number;
    planned?: ReadonlyMap<LocalDate, Interval[]>;
    /** Minutes after midnight before which nothing is proposed today. */
    now?: { date: LocalDate; minute: number };
  },
): ProposedSession[] {
  const free = new Map<LocalDate, Interval[]>();
  for (const f of frames) {
    let windows = subtract(f.windows, options.planned?.get(f.date) ?? []);
    if (options.now && f.date === options.now.date)
      windows = subtract(windows, [{ start: 0, end: roundUp(options.now.minute + 10) }]);
    if (options.now && f.date < options.now.date) windows = [];
    free.set(
      f.date,
      windows.filter((w) => length(w) >= options.minSession),
    );
  }
  const usedPerDay = new Map<LocalDate, number>();
  const out: ProposedSession[] = [];
  let remaining = options.totalMinutes;
  for (let round = 0; round < options.maxPerDay && remaining >= options.minSession; round++) {
    const order = [...free.entries()]
      .filter(([, ws]) => ws.length > 0)
      .sort((a, b) => a[0].localeCompare(b[0]));
    let placed = false;
    for (const [date, windows] of order) {
      if (remaining < options.minSession) break;
      if ((usedPerDay.get(date) ?? 0) > round) continue;
      const largest = [...windows].sort((a, b) => length(b) - length(a))[0];
      if (!largest) continue;
      const duration = Math.min(
        options.sessionMinutes,
        length(largest),
        Math.max(remaining, options.minSession),
      );
      if (duration < options.minSession) continue;
      const session = { date, start: largest.start, end: largest.start + duration };
      out.push(session);
      remaining -= duration;
      usedPerDay.set(date, (usedPerDay.get(date) ?? 0) + 1);
      // A short break after a session before another could start in the same window.
      free.set(
        date,
        subtract(windows, [{ start: session.start, end: session.end + 15 }]).filter(
          (w) => length(w) >= options.minSession,
        ),
      );
      placed = true;
    }
    if (!placed) break;
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
}
