import { addDays, diffDays, toDayNumber, type LocalDate } from '../time/localDate';

export interface WeightPoint {
  date: LocalDate;
  kg: number;
}

export interface TrendPoint {
  date: LocalDate;
  trend: number;
  /** The weigh-in recorded that day, if any. */
  actual: number | null;
}

/**
 * Exponentially smoothed weight trend, one point per calendar day.
 *
 *   trend[t] = trend[t−1] + α × (weight[t] − trend[t−1])
 *
 * Days without a weigh-in use a weight interpolated linearly between the
 * neighbouring weigh-ins, so a gap neither freezes the trend nor makes it jump.
 * α = 0.1 is the classic choice: daily water swings of a kilo barely move it.
 */
export function smoothTrend(weighIns: readonly WeightPoint[], alpha = 0.1): TrendPoint[] {
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  if (!first) return [];
  const out: TrendPoint[] = [];
  let trend = first.kg;
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (!a) continue;
    const b = sorted[i + 1];
    trend = i === 0 ? a.kg : trend + alpha * (a.kg - trend);
    out.push({ date: a.date, trend, actual: a.kg });
    if (!b) break;
    const gap = diffDays(a.date, b.date);
    for (let d = 1; d < gap; d++) {
      const interpolated = a.kg + ((b.kg - a.kg) * d) / gap;
      trend += alpha * (interpolated - trend);
      out.push({ date: addDays(a.date, d), trend, actual: null });
    }
  }
  return out;
}

/**
 * Weekly rate of change of the trend: the least-squares slope of the trend over the
 * last `windowDays` days, × 7. Returns null without enough data to be meaningful
 * (at least `minWeighIns` weigh-ins spanning `minSpanDays`).
 */
export function weeklyRate(
  trend: readonly TrendPoint[],
  options: { windowDays?: number; minWeighIns?: number; minSpanDays?: number } = {},
): number | null {
  const { windowDays = 14, minWeighIns = 5, minSpanDays = 10 } = options;
  const last = trend[trend.length - 1];
  if (!last) return null;
  const from = addDays(last.date, -(windowDays - 1));
  const window = trend.filter((p) => p.date >= from);
  const weighed = trend.filter((p) => p.actual !== null);
  const firstWeighed = weighed[0];
  if (weighed.length < minWeighIns || !firstWeighed) return null;
  if (diffDays(firstWeighed.date, last.date) < minSpanDays - 1) return null;
  if (window.length < 2) return null;
  const xs = window.map((p) => toDayNumber(p.date));
  const ys = window.map((p) => p.trend);
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] ?? 0) - mx;
    num += dx * ((ys[i] ?? 0) - my);
    den += dx * dx;
  }
  return den === 0 ? 0 : (num / den) * 7;
}

export type RateStatus = 'too-fast' | 'on-pace' | 'too-slow' | 'insufficient-data';

export interface RateThresholds {
  /** Allowed excess over the required weekly rate before it counts as too fast. */
  fastMarginKg: number;
  /** Shortfall under the required rate before it counts as too slow. */
  slowMarginKg: number;
  /** Absolute ceiling as a percentage of bodyweight per week. */
  maxWeeklyGainPct: number;
}

export const DEFAULT_RATE_THRESHOLDS: RateThresholds = {
  fastMarginKg: 0.15,
  slowMarginKg: 0.1,
  maxWeeklyGainPct: 0.5,
};

export interface RateVerdict {
  status: RateStatus;
  message: string;
  /** The band considered on pace, kg per week. */
  band: { low: number; high: number } | null;
}

/**
 * Compares the observed weekly rate with what the plan requires. A lean gain is slow
 * by nature: gaining much faster than the plan mostly adds fat, gaining slower than
 * the plan means the surplus is too small.
 */
export function rateVerdict(
  rate: number | null,
  required: number,
  bodyweightKg: number,
  t: RateThresholds = DEFAULT_RATE_THRESHOLDS,
): RateVerdict {
  if (rate === null) {
    return {
      status: 'insufficient-data',
      message: 'Weigh in on at least five mornings over ten days to see your rate.',
      band: null,
    };
  }
  const ceiling = (bodyweightKg * t.maxWeeklyGainPct) / 100;
  const high = Math.min(required + t.fastMarginKg, ceiling);
  const low = Math.max(0, required - t.slowMarginKg);
  const fmt = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)} kg/week`;
  if (rate > high) {
    return {
      status: 'too-fast',
      message: `Gaining ${fmt(rate)}, above the ${fmt(high)} ceiling — much of the excess is likely fat. Trim the surplus by 100–200 kcal.`,
      band: { low, high },
    };
  }
  if (rate < low) {
    return {
      status: 'too-slow',
      message: `Trend is ${fmt(rate)}, below the ${fmt(low)} the plan needs. Add 100–200 kcal a day, mostly from carbohydrate.`,
      band: { low, high },
    };
  }
  return {
    status: 'on-pace',
    message: `Trend is ${fmt(rate)} — within the planned band of ${fmt(low)} to ${fmt(high)}.`,
    band: { low, high },
  };
}
