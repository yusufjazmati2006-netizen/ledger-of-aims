import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { addDays } from '../time/localDate';
import { rateVerdict, smoothTrend, weeklyRate } from './trend';

const T = '2026-10-15';
const series = (values: number[], step = 1) =>
  values.map((kg, i) => ({ date: addDays(T, i * step), kg }));

describe('weight trend', () => {
  it('starts at the first weigh-in and smooths with α', () => {
    const trend = smoothTrend(series([70, 71]), 0.1);
    expect(trend.map((p) => p.trend)).toEqual([70, 70.1]);
    expect(trend[1]?.actual).toBe(71);
  });

  it('fills gaps with interpolated weights, one point per day', () => {
    const trend = smoothTrend(
      [
        { date: T, kg: 70 },
        { date: addDays(T, 4), kg: 72 },
      ],
      0.5,
    );
    expect(trend.map((p) => p.date)).toEqual([
      T,
      addDays(T, 1),
      addDays(T, 2),
      addDays(T, 3),
      addDays(T, 4),
    ]);
    expect(trend.map((p) => p.actual)).toEqual([70, null, null, null, 72]);
    // 70 → +0.5×(70.5−70) → … each step moves halfway to the interpolated weight
    expect(trend[1]?.trend).toBeCloseTo(70.25);
  });

  it('is unaffected by input order and empty input', () => {
    expect(smoothTrend([])).toEqual([]);
    const shuffled = [
      { date: addDays(T, 2), kg: 71 },
      { date: T, kg: 70 },
    ];
    expect(smoothTrend(shuffled)[0]?.date).toBe(T);
  });

  it('stays within the range of the weigh-ins (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 50, max: 100, noNaN: true }), { minLength: 1, maxLength: 60 }),
        (values) => {
          const trend = smoothTrend(series(values));
          const lo = Math.min(...values);
          const hi = Math.max(...values);
          for (const p of trend) {
            expect(p.trend).toBeGreaterThanOrEqual(lo - 1e-9);
            expect(p.trend).toBeLessThanOrEqual(hi + 1e-9);
          }
        },
      ),
    );
  });
});

describe('weekly rate', () => {
  it('needs enough data before reporting', () => {
    expect(weeklyRate(smoothTrend(series([70, 70.1, 70.2])))).toBeNull();
    expect(weeklyRate(smoothTrend(series([70, 70.1, 70.2, 70.3, 70.4], 1)))).toBeNull(); // spans 5 days
    expect(weeklyRate(smoothTrend(series([70, 70.1, 70.2, 70.3, 70.4], 3)))).not.toBeNull();
  });

  it('recovers a steady gain', () => {
    // +0.1 kg/day for 60 days → the trend converges to +0.7 kg/week.
    const values = Array.from({ length: 60 }, (_, i) => 70 + i * 0.1);
    expect(weeklyRate(smoothTrend(series(values)))).toBeCloseTo(0.7, 1);
  });

  it('reports zero for a flat weight', () => {
    expect(weeklyRate(smoothTrend(series(Array.from({ length: 20 }, () => 72))))).toBeCloseTo(0, 6);
  });
});

describe('rate verdict', () => {
  const required = 0.094; // ≈ 4.9 kg a year
  it('is on pace within the band', () => {
    expect(rateVerdict(0.1, required, 70).status).toBe('on-pace');
  });
  it('warns when too fast', () => {
    const v = rateVerdict(0.4, required, 70);
    expect(v.status).toBe('too-fast');
    expect(v.message).toContain('Trim the surplus');
  });
  it('caps the band at 0.5% of bodyweight per week', () => {
    // A steep required rate would allow 0.65; the ceiling is 0.35 for 70 kg.
    expect(rateVerdict(0.4, 0.5, 70).band?.high).toBeCloseTo(0.35);
  });
  it('warns when too slow, including losing weight', () => {
    expect(rateVerdict(-0.1, required, 70).status).toBe('too-slow');
    expect(rateVerdict(-0.1, required, 70).message).toContain('−0.10 kg/week');
  });
  it('explains missing data', () => {
    expect(rateVerdict(null, required, 70).status).toBe('insufficient-data');
  });
});
