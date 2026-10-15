import { describe, expect, it } from 'vitest';
import { buildLayout, pagesOfJuz } from './mushaf';
import { juzCompletionOrder, juzSummaries, nextPagesToLearn, pagesForJuzCount } from './progress';
import { blankPage, seedMemorizedPages, type PageRecord } from './scheduler';

const T = '2026-10-15';
const layout = buildLayout();

function ledger(memorisedJuz: number[], extraPages: number[] = []): PageRecord[] {
  const learned = new Set([...memorisedJuz.flatMap((j) => pagesOfJuz(layout, j)), ...extraPages]);
  const seeded = new Map(seedMemorizedPages([...learned], T, 10).map((r) => [r.page, r]));
  return Array.from({ length: 604 }, (_, i) => seeded.get(i + 1) ?? blankPage(i + 1));
}

const juz16to30 = Array.from({ length: 15 }, (_, i) => 16 + i);
const juz1to15 = Array.from({ length: 15 }, (_, i) => 1 + i);

describe('learning order', () => {
  it('continues forward from juz 16 for forward memorisers', () => {
    expect(nextPagesToLearn(ledger(juz1to15), layout, 'forward', 3)).toEqual([302, 303, 304]);
  });

  it('moves to juz 15, read from its first page, for backward memorisers', () => {
    expect(nextPagesToLearn(ledger(juz16to30), layout, 'backward', 3)).toEqual([282, 283, 284]);
  });

  it('finishes a partly learned juz before starting another', () => {
    const records = ledger(juz16to30, [282, 283]);
    expect(nextPagesToLearn(records, layout, 'backward', 2)).toEqual([284, 285]);
  });

  it('crosses juz boundaries when needed', () => {
    const records = ledger(juz16to30, pagesOfJuz(layout, 15).slice(0, 19));
    expect(nextPagesToLearn(records, layout, 'backward', 3)).toEqual([301, 262, 263]);
  });
});

describe('milestone page targets', () => {
  it('converts juz counts into exact page counts for this person', () => {
    const records = ledger(juz16to30);
    const order = juzCompletionOrder(records, layout, 'backward');
    expect(order.slice(0, 15).sort((a, b) => a - b)).toEqual(juz16to30);
    expect(order.slice(15, 18)).toEqual([15, 14, 13]);
    expect(pagesForJuzCount(15, order, layout)).toBe(303); // juz 16–30
    expect(pagesForJuzCount(20, order, layout)).toBe(303 + 20 + 20 + 20 + 20 + 21); // + juz 15, 14, 13, 12, 11
  });

  it('reaches all 604 pages at 30 juz', () => {
    const order = juzCompletionOrder(ledger(juz1to15), layout, 'forward');
    expect(pagesForJuzCount(30, order, layout)).toBe(604);
    expect(pagesForJuzCount(15.5, order, layout)).toBe(301 + 10);
  });
});

describe('juz summaries', () => {
  it('summarises learned pages and strength per juz', () => {
    const summaries = juzSummaries(ledger([30], [1, 2]), layout, T);
    expect(summaries[29]).toMatchObject({ juz: 30, size: 23, learned: 23, complete: true });
    expect(summaries[0]).toMatchObject({ juz: 1, learned: 2, complete: false });
    expect(summaries[1]).toMatchObject({ learned: 0, strength: null });
    expect(summaries[29]?.strength).toBeGreaterThan(0.9);
  });
});
