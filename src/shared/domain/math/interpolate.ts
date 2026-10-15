import { diffDays, type LocalDate } from '../time/localDate';

export interface DatedValue {
  date: LocalDate;
  value: number;
}

/**
 * Piecewise-linear interpolation over dated points (sorted by date). Before the
 * first point its value applies; after the last, the last value holds.
 */
export function interpolateAt(points: readonly DatedValue[], date: LocalDate): number | null {
  const first = points[0];
  if (!first) return null;
  if (date <= first.date) return first.value;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    if (date <= b.date) {
      const span = diffDays(a.date, b.date);
      if (span <= 0) return b.value;
      return a.value + ((b.value - a.value) * diffDays(a.date, date)) / span;
    }
  }
  return points[points.length - 1]?.value ?? null;
}

/** Slope (units per day) of the segment containing `date`; 0 outside the points. */
export function slopeAt(points: readonly DatedValue[], date: LocalDate): number {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    if (date < b.date && date >= a.date) {
      const span = diffDays(a.date, b.date);
      return span > 0 ? (b.value - a.value) / span : 0;
    }
  }
  return 0;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
