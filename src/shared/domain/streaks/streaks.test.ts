import { describe, expect, it } from 'vitest';
import { addDays } from '../time/localDate';
import { computeStreak, longestStreak } from './streaks';

const T = '2026-11-10';
const days = (...offsets: number[]) => offsets.map((o) => addDays(T, -o));
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('forgiving streaks', () => {
  it('counts consecutive met days including today', () => {
    const s = computeStreak(days(...range(0, 9)), T);
    expect(s).toMatchObject({
      length: 10,
      metDays: 10,
      todayDone: true,
      graceUsed: 0,
      graceRemaining: 1,
      atRisk: false,
    });
  });

  it('does not break because today is not finished yet', () => {
    const s = computeStreak(days(...range(1, 5)), T);
    expect(s).toMatchObject({ length: 5, todayDone: false, atRisk: false });
  });

  it('forgives one missed day in a week', () => {
    const s = computeStreak(days(0, 1, 2, 4, 5, 6), T); // missed 3 days ago
    expect(s).toMatchObject({ length: 7, metDays: 6, graceUsed: 1, graceRemaining: 0 });
  });

  it('keeps the streak through a missed yesterday, but flags today as at risk', () => {
    const s = computeStreak(days(2, 3, 4, 5), T);
    expect(s).toMatchObject({
      length: 5,
      metDays: 4,
      todayDone: false,
      graceUsed: 1,
      atRisk: true,
    });
  });

  it('breaks on a second miss within seven days, keeping the first one forgiven', () => {
    const s = computeStreak(days(0, 1, 3, 5, 6, 7), T); // misses 2 and 4 days ago
    expect(s.length).toBe(4);
    expect(s.startedOn).toBe(addDays(T, -3));
    expect(s.graceUsed).toBe(1);
  });

  it('allows misses that are more than a week apart', () => {
    const met = days(...range(0, 20).filter((d) => d !== 3 && d !== 12));
    expect(computeStreak(met, T).length).toBe(21);
  });

  it('is zero when nothing was done recently', () => {
    expect(computeStreak(days(3, 4, 5), T).length).toBe(0);
    expect(computeStreak([], T)).toMatchObject({ length: 0, startedOn: null, atRisk: false });
  });

  it('honours a configurable grace allowance', () => {
    const met = days(0, 3, 6);
    expect(computeStreak(met, T, { graceDays: 1, windowDays: 7 }).length).toBe(1);
    expect(computeStreak(met, T, { graceDays: 4, windowDays: 7 }).length).toBe(7);
    expect(computeStreak(days(0, 2), T, { graceDays: 0, windowDays: 7 }).length).toBe(1);
  });

  it('finds the longest streak in history', () => {
    const met = new Set(days(...range(0, 2), ...range(10, 30)));
    expect(longestStreak(met, T)).toBe(21);
  });
});
