import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { addDays, diffDays } from '../time/localDate';
import {
  balancedDueDate,
  blankPage,
  DEFAULT_SCHEDULER as P,
  flagForRevision,
  learnPage,
  loadMapOf,
  markMemorized,
  resetPage,
  reviewMany,
  reviewPage,
  seedMemorizedPages,
  strength,
  type PageRecord,
  type Rating,
} from './scheduler';

const T = '2026-10-15';

function memorized(overrides: Partial<PageRecord> = {}): PageRecord {
  return {
    ...blankPage(300),
    state: 'memorized',
    ease: 2,
    intervalDays: 10,
    dueOn: T,
    lastReviewedOn: addDays(T, -10),
    ...overrides,
  };
}

describe('learning a new page', () => {
  it('enters the first learning step, due tomorrow', () => {
    const page = learnPage(blankPage(281), T);
    expect(page).toMatchObject({
      state: 'new',
      learnedOn: T,
      step: 0,
      intervalDays: 1,
      dueOn: '2026-10-16',
    });
  });

  it('walks the learning steps 1 → 2 → 4 → 7 and then graduates at 14 days', () => {
    let page = learnPage(blankPage(281), T);
    let day = T;
    const intervals: number[] = [];
    for (let i = 0; i < P.learningSteps.length; i++) {
      day = page.dueOn ?? day;
      page = reviewPage(page, 'solid', day);
      intervals.push(page.intervalDays);
    }
    expect(intervals).toEqual([2, 4, 7, 14]);
    expect(page.state).toBe('memorized');
    expect(page.reviews).toBe(4);
  });

  it('repeats the step on shaky and restarts on forgotten, lowering ease', () => {
    const start = reviewPage(learnPage(blankPage(281), T), 'solid', '2026-10-16'); // step 1
    const shaky = reviewPage(start, 'shaky', '2026-10-18');
    expect(shaky).toMatchObject({ state: 'new', step: 1, intervalDays: 2 });
    expect(shaky.ease).toBeCloseTo(P.initialEase - P.shakyPenalty);
    const forgot = reviewPage(start, 'forgotten', '2026-10-18');
    expect(forgot).toMatchObject({ state: 'new', step: 0, intervalDays: 1, lapses: 0 });
    expect(forgot.ease).toBeCloseTo(P.initialEase - P.forgottenPenalty);
  });
});

describe('reviewing a memorised page', () => {
  it('grows the interval by ease on solid and nudges ease up', () => {
    const next = reviewPage(memorized(), 'solid', T);
    expect(next.intervalDays).toBe(20);
    expect(next.ease).toBeCloseTo(2.05);
    expect(next.lastReviewedOn).toBe(T);
  });

  it('rewards a solid recall after a long gap with a longer interval', () => {
    const late = reviewPage(memorized({ lastReviewedOn: addDays(T, -14) }), 'solid', T);
    expect(late.intervalDays).toBe(28);
  });

  it('never shortens the interval on an early solid review', () => {
    const early = reviewPage(
      memorized({ lastReviewedOn: addDays(T, -2), intervalDays: 12 }),
      'solid',
      T,
    );
    expect(early.intervalDays).toBe(12);
  });

  it('caps the interval at maxInterval', () => {
    const capped = reviewPage(
      memorized({ intervalDays: 25, lastReviewedOn: addDays(T, -25), ease: 2.8 }),
      'solid',
      T,
    );
    expect(capped.intervalDays).toBe(P.maxInterval);
  });

  it('halves the interval on shaky and lowers ease', () => {
    const next = reviewPage(memorized(), 'shaky', T);
    expect(next.intervalDays).toBe(5);
    expect(next.ease).toBeCloseTo(1.85);
    expect(next.state).toBe('memorized');
  });

  it('moves to revision on forgotten, counting a lapse', () => {
    const next = reviewPage(memorized({ intervalDays: 30 }), 'forgotten', T);
    expect(next).toMatchObject({
      state: 'revision',
      step: 0,
      lapses: 1,
      intervalDays: 1,
      dueOn: '2026-10-16',
      relearnInterval: 9, // round(30 × 0.3)
    });
    expect(next.ease).toBeCloseTo(1.7);
  });

  it('relearns over 1 → 3 → 7 days then resumes at the reduced interval', () => {
    let page = reviewPage(memorized({ intervalDays: 30 }), 'forgotten', T);
    const seen: string[] = [];
    while (page.state === 'revision') {
      page = reviewPage(page, 'solid', page.dueOn ?? T);
      seen.push(`${page.state}:${page.intervalDays}`);
    }
    expect(seen).toEqual(['revision:3', 'revision:7', 'memorized:9']);
  });

  it('never resumes below lapseMinInterval', () => {
    let page = reviewPage(memorized({ intervalDays: 4 }), 'forgotten', T);
    expect(page.relearnInterval).toBe(P.lapseMinInterval);
    while (page.state === 'revision') page = reviewPage(page, 'solid', page.dueOn ?? T);
    expect(page.intervalDays).toBe(P.lapseMinInterval);
  });

  it('refuses to review a page that has not been learned', () => {
    expect(() => reviewPage(blankPage(1), 'solid', T)).toThrow(RangeError);
  });
});

describe('invariants (property-based)', () => {
  const ratings: Rating[] = ['solid', 'shaky', 'forgotten'];
  const arbRatings = fc.array(fc.constantFrom(...ratings), { minLength: 1, maxLength: 60 });

  it('keeps ease within bounds, intervals within [1, max], and due dates in the future', () => {
    fc.assert(
      fc.property(arbRatings, fc.integer({ min: 0, max: 5 }), (sequence, lateness) => {
        let page = learnPage(blankPage(10), T);
        let day = T;
        for (const rating of sequence) {
          day = addDays(page.dueOn ?? day, lateness);
          page = reviewPage(page, rating, day);
          expect(page.ease).toBeGreaterThanOrEqual(P.easeMin);
          expect(page.ease).toBeLessThanOrEqual(P.easeMax);
          expect(page.intervalDays).toBeGreaterThanOrEqual(1);
          expect(page.intervalDays).toBeLessThanOrEqual(P.maxInterval);
          expect(page.dueOn && diffDays(day, page.dueOn)).toBeGreaterThanOrEqual(1);
          expect(page.state).not.toBe('not_started');
        }
      }),
    );
  });

  it('solid reviews never shrink a memorised interval; forgotten always leads to revision', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 0, max: 60 }),
        (interval, gap) => {
          const page = memorized({ intervalDays: interval, lastReviewedOn: addDays(T, -gap) });
          expect(reviewPage(page, 'solid', T).intervalDays).toBeGreaterThanOrEqual(interval);
          expect(reviewPage(page, 'forgotten', T).state).toBe('revision');
          expect(reviewPage(page, 'shaky', T).intervalDays).toBeLessThanOrEqual(interval);
        },
      ),
    );
  });
});

describe('load balancing', () => {
  it('keeps short intervals exact', () => {
    const load = new Map([[addDays(T, 2), 50]]);
    expect(balancedDueDate(T, 2, load, 0.1)).toBe(addDays(T, 2));
  });

  it('moves a due date to the quietest day within ±10%', () => {
    const load = new Map([
      [addDays(T, 20), 9],
      [addDays(T, 18), 4],
      [addDays(T, 19), 6],
      [addDays(T, 21), 1],
      [addDays(T, 22), 3],
    ]);
    expect(balancedDueDate(T, 20, load, 0.1)).toBe(addDays(T, 21));
  });

  it('prefers the exact day on a tie, then the earlier one', () => {
    expect(balancedDueDate(T, 20, new Map(), 0.1)).toBe(addDays(T, 20));
    const load = new Map([[addDays(T, 20), 3]]);
    expect(balancedDueDate(T, 20, load, 0.1)).toBe(addDays(T, 19));
  });

  it('spreads a bulk review of a whole juz across several days', () => {
    const pages = Array.from({ length: 20 }, (_, i) =>
      memorized({ page: 302 + i, intervalDays: 20, lastReviewedOn: addDays(T, -20) }),
    );
    const reviewed = reviewMany(pages, 'solid', T, P, pages);
    const perDay = loadMapOf(reviewed);
    expect(perDay.size).toBeGreaterThan(3);
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(5);
    // 20 days × ease 2 = 40, capped at the 30-day maximum, then spread ±3 days.
    for (const r of reviewed) {
      expect(r.intervalDays).toBe(30);
      const offset = diffDays(T, r.dueOn ?? T);
      expect(offset).toBeGreaterThanOrEqual(27);
      expect(offset).toBeLessThanOrEqual(33);
    }
  });
});

describe('seeding previously memorised pages', () => {
  const juz16to30 = Array.from({ length: 303 }, (_, i) => 302 + i);

  it('spreads the first cycle so no day exceeds capacity', () => {
    const seeded = seedMemorizedPages(juz16to30, T, 10);
    const load = loadMapOf(seeded);
    expect(Math.max(...load.values())).toBeLessThanOrEqual(11);
    expect(load.get(T)).toBeGreaterThan(0);
    const last = [...load.keys()].sort().at(-1);
    expect(last && diffDays(T, last)).toBe(P.maxInterval - 1);
    expect(seeded.every((r) => r.state === 'memorized' && r.intervalDays === 30)).toBe(true);
  });

  it('uses a shorter cycle when capacity allows', () => {
    const seeded = seedMemorizedPages(juz16to30.slice(0, 40), T, 20);
    expect(new Set(seeded.map((r) => r.dueOn)).size).toBe(2);
    expect(seeded[0]?.intervalDays).toBe(2);
  });

  it('keeps contiguous pages on the same days (mushaf order)', () => {
    const seeded = seedMemorizedPages([5, 3, 4, 1, 2, 6], T, 3);
    expect(seeded.map((r) => [r.page, r.dueOn])).toEqual([
      [1, T],
      [2, T],
      [3, T],
      [4, addDays(T, 1)],
      [5, addDays(T, 1)],
      [6, addDays(T, 1)],
    ]);
  });

  it('starts every seeded page at a believable strength', () => {
    for (const r of seedMemorizedPages(juz16to30, T, 10)) {
      const s = strength(r, T) ?? 0;
      expect(s).toBeGreaterThanOrEqual(0.9);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

describe('manual state changes', () => {
  it('marks memorised directly, joining the rotation', () => {
    const page = markMemorized(blankPage(50), T);
    expect(page).toMatchObject({
      state: 'memorized',
      intervalDays: 14,
      lastReviewedOn: T,
      dueOn: addDays(T, 14),
    });
  });

  it('flags a page for revision, due today', () => {
    const page = flagForRevision(memorized({ intervalDays: 20 }), T);
    expect(page).toMatchObject({ state: 'revision', dueOn: T, relearnInterval: 7 });
    expect(() => flagForRevision(blankPage(1), T)).toThrow(RangeError);
  });

  it('resets a page completely', () => {
    expect(resetPage(memorized())).toEqual(blankPage(300));
  });
});

describe('strength', () => {
  it('is 90% on the due date and decays when overdue', () => {
    const due = memorized({ lastReviewedOn: addDays(T, -10), intervalDays: 10 });
    expect(strength(due, T)).toBeCloseTo(0.9);
    expect(strength(due, addDays(T, 10))).toBeCloseTo(0.81);
    expect(strength({ ...due, lastReviewedOn: T }, T)).toBe(1);
    expect(strength(blankPage(1), T)).toBeNull();
  });
});
