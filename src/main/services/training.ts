import { isPersonalRecord, type Session } from '@shared/domain/physique/progression';
import type { LoggedSetResult, Workout } from '@shared/schemas/physique';
import type { RepoContext } from '../db/repositories/context';
import { insertSet, listWorkouts } from '../db/repositories/training';

/** Sessions of one exercise, oldest first, as the progression functions expect. */
export function exerciseHistory(workouts: readonly Workout[], exerciseId: string): Session[] {
  return workouts
    .map((w) => ({
      date: w.date,
      sets: w.sets
        .filter((s) => s.exerciseId === exerciseId)
        .map((s) => ({ reps: s.reps, loadKg: s.loadKg })),
    }))
    .filter((s) => s.sets.length > 0);
}

/** Logs one set and reports whether it is a new estimated one-rep-max record. */
export function logSet(
  ctx: RepoContext,
  input: { date: string; exerciseId: string; reps: number; loadKg: number },
): LoggedSetResult {
  return ctx.db.transaction(() => {
    const before = exerciseHistory(listWorkouts(ctx), input.exerciseId);
    const set = insertSet(ctx, input);
    return { set, isPersonalRecord: isPersonalRecord(input, before) };
  })();
}
