import { describe, expect, it } from 'vitest';
import type { Milestone } from '../../schemas/core';
import { countdown, milestonesFor, nextMilestone } from './milestones';

const base: Omit<Milestone, 'id' | 'title' | 'targetDate' | 'sortOrder'> = {
  goalId: 'game',
  targetValue: null,
  unit: null,
  kind: 'milestone',
  completedAt: null,
  notes: '',
};

const ms = (id: string, targetDate: string, extra: Partial<Milestone> = {}): Milestone => ({
  ...base,
  id,
  title: id,
  targetDate,
  sortOrder: 0,
  ...extra,
});

describe('milestones', () => {
  const list = [
    ms('a', '2027-04-30', { sortOrder: 0 }),
    ms('b', '2028-04-30', { sortOrder: 1 }),
    ms('stop', '2026-11-01', { sortOrder: 2, kind: 'hard-stop' }),
    ms('q', '2027-03-04', { goalId: 'quran' }),
  ];

  it('picks the earliest open non-hard-stop milestone for a goal', () => {
    expect(nextMilestone(list, 'game')?.id).toBe('a');
    expect(nextMilestone(list, 'quran')?.id).toBe('q');
    expect(nextMilestone(list, 'degree')).toBeUndefined();
  });

  it('skips completed milestones', () => {
    const done = list.map((m) =>
      m.id === 'a' ? { ...m, completedAt: '2027-01-01T00:00:00Z' } : m,
    );
    expect(nextMilestone(done, 'game')?.id).toBe('b');
  });

  it('orders by the user’s sort order', () => {
    const reordered = list.map((m) => (m.id === 'b' ? { ...m, sortOrder: -1 } : m));
    expect(milestonesFor(reordered, 'game').map((m) => m.id)).toEqual(['b', 'a', 'stop']);
  });

  it('describes countdowns', () => {
    expect(countdown('2026-10-15', '2026-10-15').label).toBe('due today');
    expect(countdown('2026-10-15', '2026-10-16').label).toBe('1 day left');
    expect(countdown('2026-10-15', '2027-03-04').label).toBe('140 days · ~20 weeks');
    expect(countdown('2026-10-15', '2026-10-13')).toMatchObject({
      overdue: true,
      label: '2 days overdue',
    });
    expect(countdown('2026-10-15', '2029-10-31').label).toMatch(/years$/);
  });
});
