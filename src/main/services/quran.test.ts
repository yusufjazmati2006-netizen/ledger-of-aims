import { describe, expect, it } from 'vitest';
import { createTestContext } from '../db/testing';
import { listPages, listReviews } from '../db/repositories/quran';
import { listMilestones } from '../db/repositories/milestones';
import { getSettings, updateSettings } from '../db/repositories/settings';
import { learnNextPages, reviewPages, setPageStates, setupMushaf, undoMutation } from './quran';
import { DomainError } from '../errors';

const juz16to30 = Array.from({ length: 15 }, (_, i) => 16 + i);

describe('Quran service', () => {
  it('sets up the mushaf from the memorised juz and spreads their first revision', () => {
    const ctx = createTestContext();
    const result = setupMushaf(ctx, { juz: juz16to30, direction: 'backward' });
    const { records } = listPages(ctx);
    expect(records.filter((r) => r.state === 'memorized')).toHaveLength(303);
    expect(records.filter((r) => r.state === 'not_started')).toHaveLength(301);
    expect(result.after).toHaveLength(604);
    const dueToday = records.filter((r) => r.dueOn === '2026-10-15').length;
    expect(dueToday).toBeLessThanOrEqual(11);
    expect(getSettings(ctx, 'quran')).toMatchObject({
      setupOn: '2026-10-15',
      direction: 'backward',
    });
  });

  it('learns the next pages in order and records the learning date', () => {
    const ctx = createTestContext();
    setupMushaf(ctx, { juz: juz16to30, direction: 'backward' });
    const result = learnNextPages(ctx, 3);
    expect(result.after.map((r) => [r.page, r.state, r.learnedOn])).toEqual([
      [282, 'new', '2026-10-15'],
      [283, 'new', '2026-10-15'],
      [284, 'new', '2026-10-15'],
    ]);
    expect(learnNextPages(ctx, 1).after[0]?.page).toBe(285);
  });

  it('records reviews and can undo them exactly', () => {
    const ctx = createTestContext();
    setupMushaf(ctx, { juz: [30], direction: 'backward' });
    const before = listPages(ctx).records.find((r) => r.page === 582);
    const result = reviewPages(ctx, [582, 583, 1], 'forgotten');
    expect(result.before.map((r) => r.page)).toEqual([582, 583]); // page 1 is not learned
    expect(listPages(ctx).records.find((r) => r.page === 582)?.state).toBe('revision');
    expect(listReviews(ctx, '2026-10-15', '2026-10-15')).toHaveLength(2);

    undoMutation(ctx, result.batchId, result.before);
    expect(listPages(ctx).records.find((r) => r.page === 582)).toEqual(before);
    expect(listReviews(ctx, '2026-10-15', '2026-10-15')).toHaveLength(0);
  });

  it('refuses to review pages that are not learned', () => {
    const ctx = createTestContext();
    expect(() => reviewPages(ctx, [1, 2], 'solid')).toThrow(DomainError);
  });

  it('changes page states from the grid, ignoring no-op changes', () => {
    const ctx = createTestContext();
    setupMushaf(ctx, { juz: [1], direction: 'forward' });
    const flagged = setPageStates(ctx, [1, 2, 22], 'revision');
    expect(flagged.after.map((r) => r.page)).toEqual([1, 2]); // 22 is unlearned
    const reset = setPageStates(ctx, [1], 'not_started');
    expect(reset.after[0]).toMatchObject({ state: 'not_started', dueOn: null });
    expect(setPageStates(ctx, [3], 'memorized').after).toHaveLength(0); // already memorised
  });

  it('completes Quran milestones automatically when the pages reach them', () => {
    const ctx = createTestContext();
    setupMushaf(ctx, { juz: juz16to30, direction: 'backward' });
    // 20 juz = 303 + juz 15, 14, 13, 12 (20 pages each) + juz 11 (21) = 404 pages.
    learnNextPages(ctx, 40);
    learnNextPages(ctx, 40);
    expect(listMilestones(ctx, 'quran').filter((m) => m.completedAt)).toHaveLength(0);
    const almost = learnNextPages(ctx, 20);
    expect(almost.completedMilestones).toHaveLength(0);
    const done = learnNextPages(ctx, 1);
    expect(done.completedMilestones.map((m) => m.title)).toEqual(['20 juz memorised']);
    expect(learnNextPages(ctx, 1).completedMilestones).toEqual([]);
  });

  it('respects edited scheduler parameters', () => {
    const ctx = createTestContext();
    setupMushaf(ctx, { juz: [30], direction: 'backward' });
    updateSettings(ctx, 'quran', {
      scheduler: { ...getSettings(ctx, 'quran').scheduler, learningSteps: [3] },
    });
    expect(learnNextPages(ctx, 1).after[0]?.dueOn).toBe('2026-10-18');
  });
});
