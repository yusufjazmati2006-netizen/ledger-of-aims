import { describe, expect, it } from 'vitest';
import { addDays } from '../time/localDate';
import { buildLayout, pagesOfJuz } from './mushaf';
import {
  computePace,
  cumulativeLearned,
  startingPages,
  weeklyLearned,
  type PaceInputs,
} from './pace';
import { blankPage, learnPage, seedMemorizedPages, type PageRecord } from './scheduler';

const START = '2026-10-15';
const layout = buildLayout();
const juz16to30 = Array.from({ length: 15 }, (_, i) => 16 + i);
const MILESTONES = [
  { date: '2027-03-04', juz: 20 },
  { date: '2027-07-22', juz: 25 },
  { date: '2027-12-09', juz: 30 },
];

/** Juz 16–30 memorised before the plan, plus pages of juz 15 learned on the given dates. */
function ledger(learnedOn: string[]): PageRecord[] {
  const base = new Map(
    seedMemorizedPages(
      juz16to30.flatMap((j) => pagesOfJuz(layout, j)),
      START,
      10,
    ).map((r) => [r.page, r]),
  );
  const juz15 = pagesOfJuz(layout, 15);
  learnedOn.forEach((date, i) => {
    const page = juz15[i] ?? 0;
    base.set(page, learnPage(blankPage(page), date));
  });
  return Array.from({ length: 604 }, (_, i) => base.get(i + 1) ?? blankPage(i + 1));
}

function inputs(records: PageRecord[], today: string, extra: Partial<PaceInputs> = {}): PaceInputs {
  return {
    records,
    layout,
    direction: 'backward',
    today,
    planStart: START,
    trackingStart: START,
    milestones: MILESTONES,
    baselinePerWeek: 5,
    tolerancePages: 2,
    ...extra,
  };
}

describe('Quran pace', () => {
  it('anchors the target line at the pages memorised on the plan start', () => {
    const records = ledger([]);
    expect(startingPages(records, START)).toBe(303);
    const pace = computePace(inputs(records, START));
    expect(pace.learned).toBe(303);
    expect(pace.targetToday).toBe(303);
    expect(pace.deficit).toBe(0);
    expect(pace.verdict).toBe('on-track');
  });

  it('blends with the baseline until four weeks of data exist', () => {
    const pace = computePace(inputs(ledger([]), START));
    expect(pace.blended).toBe(true);
    expect(pace.daysTracked).toBe(1);
    // 27 of 28 days filled with the 5 pages/week baseline.
    expect(pace.pacePerWeek).toBeCloseTo(((5 / 7) * 27) / 4, 6);
  });

  it('uses actual pace once 28 days have been tracked', () => {
    const dates = Array.from({ length: 20 }, (_, i) => addDays('2026-11-12', -i));
    const pace = computePace(inputs(ledger(dates), '2026-11-12'));
    expect(pace.blended).toBe(false);
    expect(pace.learnedLast28).toBe(20);
    expect(pace.pacePerWeek).toBe(5);
  });

  it('computes an exact page deficit against the interpolated target', () => {
    // 28 days in. The first segment rises 101 pages (juz 15, 14, 13, 12 = 20 each,
    // juz 11 = 21) over 140 days.
    const today = '2026-11-12';
    const pace = computePace(inputs(ledger(['2026-10-20', '2026-10-27']), today));
    const expectedTarget = 303 + (101 * 28) / 140;
    expect(pace.targetToday).toBeCloseTo(expectedTarget, 6);
    expect(pace.deficit).toBe(Math.round(305 - expectedTarget));
    expect(pace.verdict).toBe('behind');
    expect(pace.weeksEquivalent).toBeLessThan(0);
  });

  it('reports ahead when well over the line', () => {
    const dates = Array.from({ length: 20 }, () => '2026-10-20');
    const pace = computePace(inputs(ledger(dates), '2026-10-22'));
    expect(pace.verdict).toBe('ahead');
    expect(pace.deficit).toBeGreaterThan(2);
  });

  it('describes the next milestone and the pace it requires', () => {
    const pace = computePace(inputs(ledger([]), START));
    expect(pace.next).toMatchObject({
      date: '2027-03-04',
      juz: 20,
      pages: 404,
      pagesToGo: 101,
      daysLeft: 140,
    });
    expect(pace.next?.requiredPerWeek).toBeCloseTo(5.05, 6);
  });

  it('projects completion from the rolling pace and compares it with the final target', () => {
    const dates = Array.from({ length: 20 }, (_, i) => addDays('2026-11-12', -i));
    const pace = computePace(inputs(ledger(dates), '2026-11-12'));
    // 604 − 323 = 281 pages at 5/week ≈ 393.4 days → 394.
    expect(pace.projectedCompletion).toBe(addDays('2026-11-12', 394));
    expect(pace.finalTarget).toEqual({ date: '2027-12-09', pages: 604 });
    expect(pace.projectedSlipDays).toBeGreaterThan(0);
  });

  it('has no projection when nothing has been learned and no baseline', () => {
    const dates: string[] = [];
    const pace = computePace(inputs(ledger(dates), '2027-01-01', { baselinePerWeek: 0 }));
    expect(pace.pacePerWeek).toBe(0);
    expect(pace.projectedCompletion).toBeNull();
  });

  it('builds weekly and cumulative series', () => {
    const records = ledger(['2026-10-15', '2026-10-16', '2026-10-21']);
    const weeks = weeklyLearned(records, '2026-10-21', 3, 1);
    expect(weeks).toEqual([
      { weekStart: '2026-10-05', pages: 0 },
      { weekStart: '2026-10-12', pages: 2 },
      { weekStart: '2026-10-19', pages: 1 },
    ]);
    const cumulative = cumulativeLearned(records, START, '2026-10-30', 303);
    expect(cumulative).toEqual([
      { date: START, value: 303 },
      { date: '2026-10-22', value: 306 },
      { date: '2026-10-29', value: 306 },
      { date: '2026-10-30', value: 306 },
    ]);
  });
});
