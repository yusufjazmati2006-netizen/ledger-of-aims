import { describe, expect, it } from 'vitest';
import { countdownText, nextDeadlines, urgencyOf } from './deadlines';

const T = '2026-10-15';

describe('deadline urgency', () => {
  it('escalates as the date approaches', () => {
    expect(urgencyOf(T, '2026-11-15')).toBe('calm');
    expect(urgencyOf(T, '2026-10-29')).toBe('soon');
    expect(urgencyOf(T, '2026-10-22')).toBe('soon');
    expect(urgencyOf(T, '2026-10-21')).toBe('near');
    expect(urgencyOf(T, '2026-10-18')).toBe('near');
    expect(urgencyOf(T, '2026-10-17')).toBe('imminent');
    expect(urgencyOf(T, T)).toBe('imminent');
    expect(urgencyOf(T, '2026-10-14')).toBe('overdue');
  });

  it('describes countdowns', () => {
    expect(countdownText(T, T)).toBe('due today');
    expect(countdownText(T, '2026-10-16')).toBe('due tomorrow');
    expect(countdownText(T, '2026-10-25')).toBe('10 days');
    expect(countdownText(T, '2026-10-13')).toBe('2 days overdue');
  });

  it('picks the next three open deadlines, including recent overdue ones', () => {
    const items = [
      { id: 'a', title: 'A', due: '2026-12-01', done: false },
      { id: 'b', title: 'B', due: '2026-10-20', done: false },
      { id: 'c', title: 'C', due: '2026-10-10', done: false },
      { id: 'd', title: 'D', due: '2026-10-18', done: true },
      { id: 'e', title: 'E', due: '2026-11-01', done: false },
      { id: 'f', title: 'F', due: '2026-05-01', done: false },
    ];
    expect(nextDeadlines(items, T).map((i) => i.id)).toEqual(['c', 'b', 'e']);
  });
});
