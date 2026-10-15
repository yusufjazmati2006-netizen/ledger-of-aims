/**
 * Muraja'ah (revision) scheduler — a transparent spaced-repetition model.
 *
 * Every page carries a state, an interval (days until it should be revised again),
 * an ease (how much the interval grows after a solid review) and a due date.
 *
 *   not_started ── learn ──▶ new ── solid × learning steps ──▶ memorized
 *                             ▲                                  │   ▲
 *                             └─────────── (reset) ──────────────┘   │
 *                                         forgotten ──▶ revision ── solid × relearning steps
 *
 * Ratings on a memorised page (all parameters are tunable in Settings):
 *   solid      interval' = min(maxInterval, max(interval, round(elapsed × ease)))
 *              ease'     = min(easeMax, ease + easeBonus)
 *   shaky      interval' = max(1, round(interval × shakyMultiplier))
 *              ease'     = max(easeMin, ease − shakyPenalty)
 *   forgotten  → revision state; relearn over `relearnSteps`; lapses + 1
 *              ease'     = max(easeMin, ease − forgottenPenalty)
 *              then resumes at max(lapseMinInterval, round(interval × lapseMultiplier))
 *
 * `elapsed` is the number of days since the page was last revised. Using it (rather
 * than the scheduled interval) means a page recalled solidly after a long gap earns a
 * longer interval, while an early review never shortens one.
 *
 * Due dates are load-balanced: within ±loadBalanceFraction of the interval the
 * least-busy day is chosen, so revision does not pile up on particular days.
 */
import { addDays, diffDays, type LocalDate } from '../time/localDate';

export type PageState = 'not_started' | 'new' | 'memorized' | 'revision';
export type Rating = 'solid' | 'shaky' | 'forgotten';

export interface PageRecord {
  page: number;
  state: PageState;
  learnedOn: LocalDate | null;
  ease: number;
  intervalDays: number;
  /** Index into the learning or relearning steps while in `new` / `revision`. */
  step: number;
  dueOn: LocalDate | null;
  lastReviewedOn: LocalDate | null;
  lapses: number;
  reviews: number;
  /** The interval a page resumes with once relearning (after a lapse) completes. */
  relearnInterval: number;
}

export interface SchedulerParams {
  learningSteps: number[];
  relearnSteps: number[];
  graduatingInterval: number;
  initialEase: number;
  easeMin: number;
  easeMax: number;
  easeBonus: number;
  shakyPenalty: number;
  forgottenPenalty: number;
  shakyMultiplier: number;
  lapseMultiplier: number;
  lapseMinInterval: number;
  maxInterval: number;
  loadBalanceFraction: number;
}

export const DEFAULT_SCHEDULER: SchedulerParams = {
  learningSteps: [1, 2, 4, 7],
  relearnSteps: [1, 3, 7],
  graduatingInterval: 14,
  initialEase: 2.0,
  easeMin: 1.3,
  easeMax: 2.8,
  easeBonus: 0.05,
  shakyPenalty: 0.15,
  forgottenPenalty: 0.3,
  shakyMultiplier: 0.5,
  lapseMultiplier: 0.3,
  lapseMinInterval: 7,
  maxInterval: 30,
  loadBalanceFraction: 0.1,
};

/** Number of reviews already scheduled on each date (excluding the page being rescheduled). */
export type LoadMap = ReadonlyMap<LocalDate, number>;

const clampEase = (ease: number, p: SchedulerParams) =>
  Math.round(Math.min(p.easeMax, Math.max(p.easeMin, ease)) * 1000) / 1000;

export function blankPage(page: number): PageRecord {
  return {
    page,
    state: 'not_started',
    learnedOn: null,
    ease: DEFAULT_SCHEDULER.initialEase,
    intervalDays: 0,
    step: 0,
    dueOn: null,
    lastReviewedOn: null,
    lapses: 0,
    reviews: 0,
    relearnInterval: 0,
  };
}

/**
 * Picks the due date for an interval, preferring the least-loaded day within
 * ±fraction of it. Ties go to the day closest to the exact interval, then the
 * earlier day. Short intervals (< 4 days) are never moved.
 */
export function balancedDueDate(
  today: LocalDate,
  interval: number,
  load: LoadMap | undefined,
  fraction: number,
): LocalDate {
  const target = Math.max(1, Math.round(interval));
  const fuzz = target >= 4 && load ? Math.max(1, Math.round(target * fraction)) : 0;
  let best = target;
  let bestLoad = Number.POSITIVE_INFINITY;
  for (let offset = 0; offset <= fuzz; offset++) {
    for (const candidate of offset === 0 ? [target] : [target - offset, target + offset]) {
      if (candidate < 1) continue;
      const count = load?.get(addDays(today, candidate)) ?? 0;
      if (count < bestLoad) {
        best = candidate;
        bestLoad = count;
      }
    }
  }
  return addDays(today, best);
}

/** Days since the page was last revised; for never-revised pages, assume it is on schedule. */
export function elapsedDays(record: PageRecord, today: LocalDate): number {
  if (record.lastReviewedOn) return Math.max(0, diffDays(record.lastReviewedOn, today));
  if (record.dueOn) return Math.max(0, record.intervalDays - diffDays(today, record.dueOn));
  return record.intervalDays;
}

/**
 * Estimated retention now: R = 0.9^(elapsed / interval). It is 100% just after a
 * review and 90% on the due date, then keeps decaying while a page is overdue.
 */
export function strength(record: PageRecord, today: LocalDate): number | null {
  if (record.state === 'not_started') return null;
  const interval = Math.max(1, record.intervalDays);
  return Math.pow(0.9, elapsedDays(record, today) / interval);
}

/** Applies a review rating and returns the updated record. Pure. */
export function reviewPage(
  record: PageRecord,
  rating: Rating,
  today: LocalDate,
  params: SchedulerParams = DEFAULT_SCHEDULER,
  load?: LoadMap,
): PageRecord {
  if (record.state === 'not_started') {
    throw new RangeError(`Page ${record.page} has not been learned yet.`);
  }
  const reviewed = { ...record, lastReviewedOn: today, reviews: record.reviews + 1 };

  if (record.state === 'new' || record.state === 'revision') {
    const steps = record.state === 'new' ? params.learningSteps : params.relearnSteps;
    const graduate = (interval: number): PageRecord => ({
      ...reviewed,
      state: 'memorized',
      step: 0,
      intervalDays: interval,
      dueOn: balancedDueDate(today, interval, load, params.loadBalanceFraction),
    });
    const stepTo = (step: number, ease: number): PageRecord => {
      const interval = steps[step] ?? 1;
      return {
        ...reviewed,
        step,
        ease: clampEase(ease, params),
        intervalDays: interval,
        dueOn: addDays(today, interval),
      };
    };

    if (rating === 'solid') {
      const next = record.step + 1;
      if (next >= steps.length) {
        const interval =
          record.state === 'new'
            ? params.graduatingInterval
            : Math.max(params.lapseMinInterval, record.relearnInterval);
        return graduate(Math.min(params.maxInterval, interval));
      }
      return stepTo(next, record.ease);
    }
    if (rating === 'shaky') return stepTo(record.step, record.ease - params.shakyPenalty);
    return stepTo(0, record.ease - params.forgottenPenalty);
  }

  // Memorised pages.
  if (rating === 'solid') {
    const elapsed = Math.max(1, elapsedDays(record, today));
    const grown = Math.round(elapsed * record.ease);
    const interval = Math.min(params.maxInterval, Math.max(record.intervalDays, grown, 1));
    return {
      ...reviewed,
      ease: clampEase(record.ease + params.easeBonus, params),
      intervalDays: interval,
      dueOn: balancedDueDate(today, interval, load, params.loadBalanceFraction),
    };
  }
  if (rating === 'shaky') {
    const interval = Math.max(1, Math.round(record.intervalDays * params.shakyMultiplier));
    return {
      ...reviewed,
      ease: clampEase(record.ease - params.shakyPenalty, params),
      intervalDays: interval,
      dueOn: balancedDueDate(today, interval, load, params.loadBalanceFraction),
    };
  }
  const firstStep = params.relearnSteps[0] ?? 1;
  return {
    ...reviewed,
    state: 'revision',
    step: 0,
    lapses: record.lapses + 1,
    ease: clampEase(record.ease - params.forgottenPenalty, params),
    relearnInterval: Math.min(
      params.maxInterval,
      Math.max(params.lapseMinInterval, Math.round(record.intervalDays * params.lapseMultiplier)),
    ),
    intervalDays: firstStep,
    dueOn: addDays(today, firstStep),
  };
}

/** A page learned today: it enters the learning steps, first revision tomorrow. */
export function learnPage(
  record: PageRecord,
  today: LocalDate,
  params: SchedulerParams = DEFAULT_SCHEDULER,
): PageRecord {
  const first = params.learningSteps[0] ?? 1;
  return {
    ...blankPage(record.page),
    state: 'new',
    learnedOn: today,
    ease: params.initialEase,
    intervalDays: first,
    dueOn: addDays(today, first),
  };
}

/**
 * Directly marks a page as memorised (a correction, or a page memorised long ago).
 * It joins the rotation as though just revised.
 */
export function markMemorized(
  record: PageRecord,
  today: LocalDate,
  params: SchedulerParams = DEFAULT_SCHEDULER,
  load?: LoadMap,
): PageRecord {
  const interval = Math.min(params.maxInterval, params.graduatingInterval);
  return {
    ...record,
    state: 'memorized',
    learnedOn: record.learnedOn,
    ease: record.state === 'not_started' ? params.initialEase : record.ease,
    step: 0,
    intervalDays: interval,
    lastReviewedOn: today,
    dueOn: balancedDueDate(today, interval, load, params.loadBalanceFraction),
  };
}

/** Flags a page as weak: it is due today and goes through the relearning steps. */
export function flagForRevision(
  record: PageRecord,
  today: LocalDate,
  params: SchedulerParams = DEFAULT_SCHEDULER,
): PageRecord {
  if (record.state === 'not_started') {
    throw new RangeError(`Page ${record.page} has not been learned yet.`);
  }
  return {
    ...record,
    state: 'revision',
    step: 0,
    relearnInterval: Math.min(
      params.maxInterval,
      Math.max(params.lapseMinInterval, Math.round(record.intervalDays * params.lapseMultiplier)),
    ),
    intervalDays: params.relearnSteps[0] ?? 1,
    dueOn: today,
  };
}

export function resetPage(record: PageRecord): PageRecord {
  return blankPage(record.page);
}

/**
 * Seeds pages already memorised before the app was used. They have no history, so
 * their first revisions are spread evenly over one cycle of `ceil(N / capacity)` days
 * (at most `maxInterval`), in mushaf order. Day one therefore holds about one day's
 * capacity rather than every page at once.
 */
export function seedMemorizedPages(
  pages: readonly number[],
  today: LocalDate,
  dailyCapacity: number,
  params: SchedulerParams = DEFAULT_SCHEDULER,
): PageRecord[] {
  const sorted = [...pages].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return [];
  const capacity = Math.max(1, Math.floor(dailyCapacity));
  const cycle = Math.min(params.maxInterval, Math.max(1, Math.ceil(n / capacity)));
  return sorted.map((page, i) => ({
    ...blankPage(page),
    state: 'memorized' as const,
    ease: params.initialEase,
    intervalDays: Math.max(cycle, 1),
    dueOn: addDays(today, Math.floor((i * cycle) / n)),
  }));
}

/** Builds a load map (reviews due per date) from page records, optionally excluding pages. */
export function loadMapOf(
  records: readonly PageRecord[],
  exclude: ReadonlySet<number> = new Set(),
): Map<LocalDate, number> {
  const load = new Map<LocalDate, number>();
  for (const r of records) {
    if (r.dueOn === null || r.state === 'not_started' || exclude.has(r.page)) continue;
    load.set(r.dueOn, (load.get(r.dueOn) ?? 0) + 1);
  }
  return load;
}

/**
 * Rates several pages at once (e.g. a whole juz), feeding each new due date back
 * into the load map so a bulk review is itself spread across days.
 */
export function reviewMany(
  records: readonly PageRecord[],
  rating: Rating,
  today: LocalDate,
  params: SchedulerParams,
  allRecords: readonly PageRecord[],
): PageRecord[] {
  const targets = new Set(records.map((r) => r.page));
  const load = loadMapOf(allRecords, targets);
  return records.map((record) => {
    const next = reviewPage(record, rating, today, params, load);
    if (next.dueOn) load.set(next.dueOn, (load.get(next.dueOn) ?? 0) + 1);
    return next;
  });
}
