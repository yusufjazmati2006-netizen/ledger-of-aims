import { describe, expect, it } from 'vitest';
import { requiredWeeklyRate, targetWeightAt } from './trajectory';

const points = [
  { date: '2026-10-15', kg: 66.4 },
  { date: '2027-10-15', kg: 71.3 },
  { date: '2028-10-15', kg: 76.2 },
];

describe('weight trajectory', () => {
  it('interpolates linearly between checkpoints', () => {
    expect(targetWeightAt(points, '2026-10-15')).toBeCloseTo(66.4);
    expect(targetWeightAt(points, '2027-10-15')).toBeCloseTo(71.3);
    // Halfway through the second segment (366 days long: it contains 29 Feb 2028).
    expect(targetWeightAt(points, '2028-04-15')).toBeCloseTo(71.3 + 4.9 * (183 / 366), 5);
  });

  it('clamps outside the trajectory', () => {
    expect(targetWeightAt(points, '2020-01-01')).toBe(66.4);
    expect(targetWeightAt(points, '2035-01-01')).toBe(76.2);
    expect(targetWeightAt([], '2026-10-15')).toBeNull();
  });

  it('reports the required weekly rate for the current segment', () => {
    expect(requiredWeeklyRate(points, '2026-12-01')).toBeCloseTo((4.9 / 365) * 7, 6);
    expect(requiredWeeklyRate(points, '2030-01-01')).toBe(0);
  });
});
