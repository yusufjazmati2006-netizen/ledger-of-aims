import type { Exercise, Workout, WorkoutSet } from '@shared/schemas/physique';
import { DomainError, notFound } from '../../errors';
import { newId, type RepoContext } from './context';

interface ExerciseRow {
  id: string;
  name: string;
  muscle_group: string;
  rep_min: number;
  rep_max: number;
  sets_target: number;
  increment_kg: number;
  bodyweight: number;
  in_program: number;
  sort_order: number;
  archived: number;
  notes: string;
}

const toExercise = (r: ExerciseRow): Exercise => ({
  id: r.id,
  name: r.name,
  muscleGroup: r.muscle_group,
  repMin: r.rep_min,
  repMax: r.rep_max,
  setsTarget: r.sets_target,
  incrementKg: r.increment_kg,
  bodyweight: r.bodyweight === 1,
  inProgram: r.in_program === 1,
  sortOrder: r.sort_order,
  archived: r.archived === 1,
  notes: r.notes,
});

export type ExerciseInput = Omit<Exercise, 'id' | 'sortOrder' | 'archived'>;

export function listExercises(ctx: RepoContext): Exercise[] {
  return ctx.db
    .prepare<[], ExerciseRow>('SELECT * FROM exercises ORDER BY archived, sort_order, name')
    .all()
    .map(toExercise);
}

export function getExercise(ctx: RepoContext, id: string): Exercise {
  const row = ctx.db.prepare<[string], ExerciseRow>('SELECT * FROM exercises WHERE id = ?').get(id);
  if (!row) throw notFound('Exercise', id);
  return toExercise(row);
}

function assertRange(e: { repMin: number; repMax: number }) {
  if (e.repMax < e.repMin)
    throw new DomainError('CONFLICT', 'The top of the rep range must be at least the bottom.');
}

export function createExercise(ctx: RepoContext, input: ExerciseInput): Exercise {
  assertRange(input);
  const id = newId();
  const now = ctx.clock.nowIso();
  const order =
    ctx.db.prepare<[], { n: number | null }>('SELECT MAX(sort_order) + 1 AS n FROM exercises').get()
      ?.n ?? 0;
  ctx.db
    .prepare(
      `INSERT INTO exercises (id, name, muscle_group, rep_min, rep_max, sets_target, increment_kg, bodyweight, in_program, sort_order, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.name,
      input.muscleGroup,
      input.repMin,
      input.repMax,
      input.setsTarget,
      input.incrementKg,
      input.bodyweight ? 1 : 0,
      input.inProgram ? 1 : 0,
      order,
      input.notes,
      now,
      now,
    );
  return getExercise(ctx, id);
}

export function updateExercise(
  ctx: RepoContext,
  id: string,
  patch: Partial<ExerciseInput & { archived: boolean }>,
): Exercise {
  const next = { ...getExercise(ctx, id), ...patch };
  assertRange(next);
  ctx.db
    .prepare(
      `UPDATE exercises SET name = ?, muscle_group = ?, rep_min = ?, rep_max = ?, sets_target = ?, increment_kg = ?,
         bodyweight = ?, in_program = ?, archived = ?, notes = ?, updated_at = ? WHERE id = ?`,
    )
    .run(
      next.name,
      next.muscleGroup,
      next.repMin,
      next.repMax,
      next.setsTarget,
      next.incrementKg,
      next.bodyweight ? 1 : 0,
      next.inProgram ? 1 : 0,
      next.archived ? 1 : 0,
      next.notes,
      ctx.clock.nowIso(),
      id,
    );
  return getExercise(ctx, id);
}

export function reorderExercises(ctx: RepoContext, orderedIds: string[]): Exercise[] {
  const update = ctx.db.prepare('UPDATE exercises SET sort_order = ? WHERE id = ?');
  ctx.db.transaction(() => {
    orderedIds.forEach((id, i) => update.run(i, id));
  })();
  return listExercises(ctx);
}

interface SetRow {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_index: number;
  reps: number;
  load_kg: number;
}

const toSet = (r: SetRow): WorkoutSet => ({
  id: r.id,
  workoutId: r.workout_id,
  exerciseId: r.exercise_id,
  setIndex: r.set_index,
  reps: r.reps,
  loadKg: r.load_kg,
});

export function listWorkouts(ctx: RepoContext, from = '0000-01-01', to = '9999-12-31'): Workout[] {
  const workouts = ctx.db
    .prepare<[string, string], { id: string; date: string; notes: string }>(
      'SELECT id, date, notes FROM workouts WHERE date BETWEEN ? AND ? ORDER BY date, created_at',
    )
    .all(from, to);
  if (workouts.length === 0) return [];
  const sets = ctx.db
    .prepare<[string, string], SetRow>(
      `SELECT s.* FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
       WHERE w.date BETWEEN ? AND ? ORDER BY s.set_index, s.created_at`,
    )
    .all(from, to);
  const byWorkout = new Map<string, WorkoutSet[]>();
  for (const s of sets)
    byWorkout.set(s.workout_id, [...(byWorkout.get(s.workout_id) ?? []), toSet(s)]);
  return workouts.map((w) => ({ ...w, sets: byWorkout.get(w.id) ?? [] }));
}

/** The workout for a date, created on first use (one session per day). */
export function workoutForDate(ctx: RepoContext, date: string): string {
  const existing = ctx.db
    .prepare<[string], { id: string }>(
      'SELECT id FROM workouts WHERE date = ? ORDER BY created_at LIMIT 1',
    )
    .get(date);
  if (existing) return existing.id;
  const id = newId();
  ctx.db
    .prepare('INSERT INTO workouts (id, date, created_at) VALUES (?, ?, ?)')
    .run(id, date, ctx.clock.nowIso());
  return id;
}

export function insertSet(
  ctx: RepoContext,
  input: { date: string; exerciseId: string; reps: number; loadKg: number },
): WorkoutSet {
  getExercise(ctx, input.exerciseId);
  const workoutId = workoutForDate(ctx, input.date);
  const index =
    ctx.db
      .prepare<[string, string], { n: number | null }>(
        'SELECT MAX(set_index) + 1 AS n FROM workout_sets WHERE workout_id = ? AND exercise_id = ?',
      )
      .get(workoutId, input.exerciseId)?.n ?? 0;
  const id = newId();
  ctx.db
    .prepare(
      'INSERT INTO workout_sets (id, workout_id, exercise_id, set_index, reps, load_kg, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(id, workoutId, input.exerciseId, index, input.reps, input.loadKg, ctx.clock.nowIso());
  return toSet(
    ctx.db.prepare<[string], SetRow>('SELECT * FROM workout_sets WHERE id = ?').get(id) as SetRow,
  );
}

export function updateSet(
  ctx: RepoContext,
  id: string,
  patch: { reps?: number; loadKg?: number },
): WorkoutSet {
  const row = ctx.db.prepare<[string], SetRow>('SELECT * FROM workout_sets WHERE id = ?').get(id);
  if (!row) throw notFound('Set', id);
  ctx.db
    .prepare('UPDATE workout_sets SET reps = ?, load_kg = ? WHERE id = ?')
    .run(patch.reps ?? row.reps, patch.loadKg ?? row.load_kg, id);
  return toSet(
    ctx.db.prepare<[string], SetRow>('SELECT * FROM workout_sets WHERE id = ?').get(id) as SetRow,
  );
}

/** Deletes a set; a workout left with no sets is removed too. */
export function deleteSet(ctx: RepoContext, id: string): void {
  const row = ctx.db.prepare<[string], SetRow>('SELECT * FROM workout_sets WHERE id = ?').get(id);
  if (!row) throw notFound('Set', id);
  ctx.db.transaction(() => {
    ctx.db.prepare('DELETE FROM workout_sets WHERE id = ?').run(id);
    ctx.db
      .prepare(
        'DELETE FROM workouts WHERE id = ? AND NOT EXISTS (SELECT 1 FROM workout_sets WHERE workout_id = ?)',
      )
      .run(row.workout_id, row.workout_id);
  })();
}

export function setWorkoutNotes(ctx: RepoContext, id: string, notes: string): void {
  const result = ctx.db.prepare('UPDATE workouts SET notes = ? WHERE id = ?').run(notes, id);
  if (result.changes === 0) throw notFound('Workout', id);
}
