import { describe, expect, it } from 'vitest';
import { createTestContext } from '../testing';
import { upsertWeighIn } from './weighIns';
import { logStudy } from './degree';
import { addManualTime } from './game';
import { applyProposal, createPlanBlock, listPlanBlocks, updatePlanBlock } from './plan';
import {
  checkHabit,
  getReview,
  habitsData,
  listReviews,
  saveHabit,
  saveReview,
  weekMetrics,
} from './review';

const WEEK = '2026-10-12'; // Monday; the clock is Thursday 15 Oct

describe('weekly review', () => {
  it('computes the week’s metrics from the data', () => {
    const ctx = createTestContext();
    upsertWeighIn(ctx, { date: '2026-10-12', weightKg: 66.4, note: '' });
    upsertWeighIn(ctx, { date: '2026-10-15', weightKg: 66.9, note: '' });
    upsertWeighIn(ctx, { date: '2026-10-19', weightKg: 70, note: '' }); // next week
    logStudy(ctx, { date: '2026-10-13', minutes: 90, moduleId: null, note: '' });
    addManualTime(ctx, {
      startIso: new Date(2026, 9, 14, 20, 0).toISOString(),
      endIso: new Date(2026, 9, 14, 21, 30).toISOString(),
      focus: true,
      note: '',
    });
    const m = weekMetrics(ctx, WEEK);
    expect(m).toMatchObject({
      weekStart: WEEK,
      weighIns: 2,
      weightChangeKg: 0.5,
      studyMinutes: 90,
      gameMinutes: 90,
      focusSessions: 1,
      workouts: 0,
      milestonesCompleted: [],
    });
  });

  it('saves reflections and priorities, snapshotting metrics on completion', () => {
    const ctx = createTestContext();
    expect(getReview(ctx, WEEK)).toBeNull();
    const draft = saveReview(ctx, {
      weekStart: WEEK,
      priorities: ['Finish the tutorial', '  ', 'Weigh in daily'],
      wentWell: 'Revision every day',
      wentBadly: '',
      adjust: '',
      complete: false,
    });
    expect(draft).toMatchObject({
      priorities: ['Finish the tutorial', 'Weigh in daily'],
      metrics: null,
      completedAt: null,
    });
    const done = saveReview(ctx, { ...draft, complete: true });
    expect(done.completedAt).not.toBeNull();
    expect(done.metrics?.weekStart).toBe(WEEK);
    expect(listReviews(ctx)).toHaveLength(1);
  });
});

describe('habits', () => {
  it('creates habits and records checks idempotently', () => {
    const ctx = createTestContext();
    const habit = saveHabit(ctx, {
      name: 'No phone in bed',
      goalId: null,
      graceDays: 1,
      archived: false,
    });
    checkHabit(ctx, habit.id, '2026-10-14', true);
    checkHabit(ctx, habit.id, '2026-10-15', true);
    checkHabit(ctx, habit.id, '2026-10-15', true);
    checkHabit(ctx, habit.id, '2026-10-14', false);
    const data = habitsData(ctx, '2026-10-01', '2026-10-31');
    expect(data.habits.map((h) => h.name)).toEqual(['No phone in bed']);
    expect(data.checks[habit.id]).toEqual(['2026-10-15']);
    expect(() => checkHabit(ctx, 'missing', '2026-10-15', true)).toThrow();
  });
});

describe('plan proposals', () => {
  it('replaces only unpinned, unfinished blocks', () => {
    const ctx = createTestContext();
    const base = { goalId: 'degree' as const, kind: 'study', title: 'Study' };
    const mine = createPlanBlock(ctx, {
      ...base,
      date: '2026-10-16',
      start: 600,
      end: 660,
      pinned: true,
    });
    const proposed = createPlanBlock(ctx, {
      ...base,
      date: '2026-10-16',
      start: 700,
      end: 760,
      pinned: false,
    });
    const finished = createPlanBlock(ctx, {
      ...base,
      date: '2026-10-15',
      start: 700,
      end: 760,
      pinned: false,
    });
    updatePlanBlock(ctx, finished.id, { done: true });

    applyProposal(ctx, '2026-10-12', '2026-10-18', [
      { ...base, date: '2026-10-17', start: 540, end: 600 },
    ]);
    const ids = listPlanBlocks(ctx, '2026-10-12', '2026-10-18').map((b) => b.id);
    expect(ids).toContain(mine.id);
    expect(ids).toContain(finished.id);
    expect(ids).not.toContain(proposed.id);
    expect(ids).toHaveLength(3);
    expect(() =>
      applyProposal(ctx, '2026-10-12', '2026-10-18', [
        { ...base, date: '2026-10-30', start: 1, end: 2 },
      ]),
    ).toThrow('outside');
    // The failed call rolled back: nothing was cleared.
    expect(listPlanBlocks(ctx, '2026-10-12', '2026-10-18')).toHaveLength(3);
  });
});
