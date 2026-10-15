import { diffDays, type LocalDate } from '../time/localDate';

export interface TrajectoryPoint {
  date: LocalDate;
  kg: number;
}

/**
 * The target weight on a given date, interpolated linearly between the starting
 * point and the dated checkpoints (which must be sorted by date). Before the first
 * point the start weight applies; after the last checkpoint its weight holds.
 */
export function targetWeightAt(points: readonly TrajectoryPoint[], date: LocalDate): number | null {
  if (points.length === 0) return null;
  const first = points[0];
  if (!first) return null;
  if (date <= first.date) return first.kg;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    if (date <= b.date) {
      const span = diffDays(a.date, b.date);
      if (span <= 0) return b.kg;
      const t = diffDays(a.date, date) / span;
      return a.kg + (b.kg - a.kg) * t;
    }
  }
  return points[points.length - 1]?.kg ?? null;
}

/** Required rate (kg per week) on the trajectory segment containing `date`. */
export function requiredWeeklyRate(points: readonly TrajectoryPoint[], date: LocalDate): number {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    if (date < b.date) {
      const span = diffDays(a.date, b.date);
      return span > 0 ? ((b.kg - a.kg) / span) * 7 : 0;
    }
  }
  return 0;
}
