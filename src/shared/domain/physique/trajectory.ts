import { interpolateAt, slopeAt } from '../math/interpolate';
import type { LocalDate } from '../time/localDate';

export interface TrajectoryPoint {
  date: LocalDate;
  kg: number;
}

const asValues = (points: readonly TrajectoryPoint[]) =>
  points.map((p) => ({ date: p.date, value: p.kg }));

/**
 * The target weight on a given date, interpolated linearly between the starting
 * point and the dated checkpoints (which must be sorted by date). Before the first
 * point the start weight applies; after the last checkpoint its weight holds.
 */
export function targetWeightAt(points: readonly TrajectoryPoint[], date: LocalDate): number | null {
  return interpolateAt(asValues(points), date);
}

/** Required rate (kg per week) on the trajectory segment containing `date`. */
export function requiredWeeklyRate(points: readonly TrajectoryPoint[], date: LocalDate): number {
  return slopeAt(asValues(points), date) * 7;
}
