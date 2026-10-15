import { describe, expect, it } from 'vitest';
import { elapsedSeconds, formatElapsed, minutesByDay, weeklyHours } from './time';

const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min).toISOString();

describe('time tracking', () => {
  it('splits an entry that runs past midnight', () => {
    const map = minutesByDay(
      [{ startedAt: at(2026, 10, 15, 23, 30), endedAt: at(2026, 10, 16, 1, 0) }],
      new Date(),
    );
    expect(map.get('2026-10-15')).toBeCloseTo(30);
    expect(map.get('2026-10-16')).toBeCloseTo(60);
  });

  it('counts a running timer up to now', () => {
    const now = new Date(2026, 9, 15, 10, 45);
    const map = minutesByDay([{ startedAt: at(2026, 10, 15, 10, 0), endedAt: null }], now);
    expect(map.get('2026-10-15')).toBeCloseTo(45);
    expect(elapsedSeconds(at(2026, 10, 15, 10, 0), now)).toBe(2700);
  });

  it('handles the clocks going back (25 Oct 2026, UK)', () => {
    // 00:30 → 02:30 local on the night the clocks change is three real hours.
    const map = minutesByDay(
      [{ startedAt: at(2026, 10, 25, 0, 30), endedAt: at(2026, 10, 25, 2, 30) }],
      new Date(),
    );
    expect(map.get('2026-10-25')).toBeCloseTo(180);
  });

  it('sums hours per week', () => {
    const entries = [
      { startedAt: at(2026, 10, 12, 18), endedAt: at(2026, 10, 12, 20) },
      { startedAt: at(2026, 10, 15, 18), endedAt: at(2026, 10, 15, 19, 30) },
      { startedAt: at(2026, 10, 6, 18), endedAt: at(2026, 10, 6, 19) },
    ];
    expect(weeklyHours(entries, '2026-10-15', 1, 2, new Date(2026, 9, 15, 21))).toEqual([
      { weekStart: '2026-10-05', hours: 1 },
      { weekStart: '2026-10-12', hours: 3.5 },
    ]);
  });

  it('formats elapsed time', () => {
    expect(formatElapsed(5)).toBe('0:05');
    expect(formatElapsed(754)).toBe('12:34');
    expect(formatElapsed(3725)).toBe('1:02:05');
  });
});
