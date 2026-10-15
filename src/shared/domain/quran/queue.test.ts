import { describe, expect, it } from 'vitest';
import { addDays } from '../time/localDate';
import { buildLayout } from './mushaf';
import { buildQueue, upcomingLoad } from './queue';
import { blankPage, type PageRecord } from './scheduler';

const T = '2026-10-15';
const layout = buildLayout();
const rec = (page: number, o: Partial<PageRecord>): PageRecord => ({
  ...blankPage(page),
  state: 'memorized',
  intervalDays: 10,
  dueOn: T,
  ...o,
});

describe('revision queue', () => {
  it('includes only learned pages that are due', () => {
    const q = buildQueue(
      [
        rec(1, {}),
        rec(2, { dueOn: addDays(T, 1) }),
        blankPage(3),
        rec(4, { dueOn: addDays(T, -3) }),
      ],
      T,
      layout,
      { availableMinutes: 60, minutesPerPage: 3 },
    );
    expect(q.selected.sort()).toEqual([1, 4]);
    expect(q.dueCount).toBe(2);
    expect(q.backlog).toBe(0);
  });

  it('sizes the queue to the time available and reports the backlog honestly', () => {
    const records = Array.from({ length: 30 }, (_, i) => rec(302 + i, {}));
    const q = buildQueue(records, T, layout, { availableMinutes: 30, minutesPerPage: 3 });
    expect(q.capacity).toBe(10);
    expect(q.selected).toHaveLength(10);
    expect(q.backlog).toBe(20);
    expect(q.minutes).toBe(30);
  });

  it('puts learning pages first, then relearning, then the rotation by relative overdueness', () => {
    const records = [
      rec(400, { intervalDays: 30, dueOn: addDays(T, -5) }), // 5/30 overdue
      rec(401, { intervalDays: 7, dueOn: addDays(T, -5) }), // 5/7 overdue — more urgent
      rec(281, { state: 'new', intervalDays: 1 }),
      rec(150, { state: 'revision', intervalDays: 1 }),
    ];
    const q = buildQueue(records, T, layout, { availableMinutes: 9, minutesPerPage: 3 });
    expect(q.selected).toEqual([281, 150, 401]);
    expect(q.backlog).toBe(1);
  });

  it('groups consecutive pages of the same juz and kind into sessions', () => {
    const records = [322, 323, 324, 326, 341, 342].map((p) => rec(p, {}));
    const q = buildQueue(records, T, layout, { availableMinutes: 60, minutesPerPage: 3 });
    expect(q.sessions.map((s) => [s.juz, s.pages])).toEqual([
      [17, [322, 323, 324]],
      [17, [326]],
      [17, [341]],
      [18, [342]],
    ]);
  });

  it('returns an empty queue when there is no time', () => {
    const q = buildQueue([rec(1, {})], T, layout, { availableMinutes: 0, minutesPerPage: 3 });
    expect(q.selected).toEqual([]);
    expect(q.backlog).toBe(1);
  });

  it('projects upcoming load with overdue pages counted today', () => {
    const records = [
      rec(1, { dueOn: addDays(T, -2) }),
      rec(2, {}),
      rec(3, { dueOn: addDays(T, 2) }),
      blankPage(4),
    ];
    expect(upcomingLoad(records, T, 4)).toEqual([2, 0, 1, 0]);
  });
});
