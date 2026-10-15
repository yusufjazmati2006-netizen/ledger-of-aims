import { addDays, diffDays, type LocalDate } from '../time/localDate';

export type TrainingStatus =
  | { kind: 'due'; date: LocalDate }
  | { kind: 'overdue'; date: LocalDate; daysLate: number }
  | { kind: 'rest'; next: LocalDate }
  | { kind: 'trained-today'; next: LocalDate };

/**
 * Every-other-day full-body training (by default one rest day between sessions).
 * A missed session is simply due today — the cycle shifts rather than doubling up.
 */
export function trainingStatus(
  lastWorkout: LocalDate | null,
  today: LocalDate,
  restDays = 1,
): TrainingStatus {
  if (!lastWorkout) return { kind: 'due', date: today };
  const next = addDays(lastWorkout, restDays + 1);
  if (lastWorkout === today) return { kind: 'trained-today', next };
  if (next > today) return { kind: 'rest', next };
  const daysLate = diffDays(next, today);
  return daysLate === 0 ? { kind: 'due', date: today } : { kind: 'overdue', date: today, daysLate };
}

export type PlanDay = 'trained' | 'rest' | 'missed' | 'planned' | 'planned-rest';

/**
 * A day-by-day view from `from` to `to`: past days as trained / rest / missed,
 * today and future days as planned training or rest, every (restDays + 1) days from
 * the next due session.
 */
export function trainingCalendar(
  workoutDates: readonly LocalDate[],
  from: LocalDate,
  to: LocalDate,
  today: LocalDate,
  restDays = 1,
): { date: LocalDate; kind: PlanDay }[] {
  const trained = new Set(workoutDates);
  const sorted = [...trained].sort();
  const latestBefore = (d: LocalDate) => {
    let found: LocalDate | null = null;
    for (const x of sorted) if (x < d) found = x;
    return found;
  };
  const latestUpToToday = sorted.filter((x) => x <= today).pop() ?? null;
  const status = trainingStatus(latestUpToToday, today, restDays);
  const anchor = status.kind === 'rest' || status.kind === 'trained-today' ? status.next : today;

  const out: { date: LocalDate; kind: PlanDay }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (trained.has(d)) {
      out.push({ date: d, kind: 'trained' });
    } else if (d < today) {
      // A past day was a missed session if it falls on the rhythm after the last session.
      const prev = latestBefore(d);
      const offset = prev === null ? 0 : diffDays(prev, d);
      const missed = prev !== null && offset >= restDays + 1 && offset % (restDays + 1) === 0;
      out.push({ date: d, kind: missed ? 'missed' : 'rest' });
    } else {
      const offset = diffDays(anchor, d);
      out.push({
        date: d,
        kind: offset >= 0 && offset % (restDays + 1) === 0 ? 'planned' : 'planned-rest',
      });
    }
  }
  return out;
}
