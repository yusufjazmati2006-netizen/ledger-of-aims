import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES, SEED_FOODS } from '@shared/seed/defaults';
import { createTestContext } from '../db/testing';
import {
  createExercise,
  deleteSet,
  listExercises,
  listWorkouts,
  updateExercise,
} from '../db/repositories/training';
import {
  addMealPlanEntry,
  copyMealPlanDay,
  listFoodEntries,
  listFoods,
  listMealPlan,
  logFood,
  logPlannedDay,
  updateFood,
} from '../db/repositories/nutrition';
import { upsertWeighIn } from '../db/repositories/weighIns';
import { listMilestones } from '../db/repositories/milestones';
import { logSet } from './training';
import { checkPhysiqueMilestones } from './milestoneEngine';
import { DomainError } from '../errors';
import { addDays } from '@shared/domain/time/localDate';

describe('training', () => {
  it('seeds the exercise library with a default programme', () => {
    const ctx = createTestContext();
    const all = listExercises(ctx);
    expect(all).toHaveLength(SEED_EXERCISES.length);
    expect(all.filter((e) => e.inProgram).map((e) => e.name)).toContain('Back squat');
  });

  it('logs sets into one workout per day and flags personal records', () => {
    const ctx = createTestContext();
    const squat = listExercises(ctx).find((e) => e.name === 'Back squat')!;
    const first = logSet(ctx, { date: '2026-10-15', exerciseId: squat.id, reps: 8, loadKg: 80 });
    expect(first.isPersonalRecord).toBe(true);
    const second = logSet(ctx, { date: '2026-10-15', exerciseId: squat.id, reps: 7, loadKg: 80 });
    expect(second.isPersonalRecord).toBe(false);
    expect(second.set.setIndex).toBe(1);
    const later = logSet(ctx, { date: '2026-10-17', exerciseId: squat.id, reps: 9, loadKg: 80 });
    expect(later.isPersonalRecord).toBe(true);
    const workouts = listWorkouts(ctx);
    expect(workouts.map((w) => [w.date, w.sets.length])).toEqual([
      ['2026-10-15', 2],
      ['2026-10-17', 1],
    ]);
    // Deleting the last set of a day removes the empty workout.
    deleteSet(ctx, later.set.id);
    expect(listWorkouts(ctx)).toHaveLength(1);
  });

  it('validates rep ranges on create and update', () => {
    const ctx = createTestContext();
    expect(() =>
      createExercise(ctx, {
        name: 'Odd',
        muscleGroup: '',
        repMin: 10,
        repMax: 6,
        setsTarget: 3,
        incrementKg: 2.5,
        bodyweight: false,
        inProgram: false,
        notes: '',
      }),
    ).toThrow(DomainError);
    const curl = listExercises(ctx).find((e) => e.name === 'Dumbbell curl')!;
    expect(() => updateExercise(ctx, curl.id, { repMin: 20 })).toThrow(DomainError);
    expect(updateExercise(ctx, curl.id, { archived: true }).archived).toBe(true);
  });
});

describe('nutrition', () => {
  it('seeds starter favourites', () => {
    expect(listFoods(createTestContext())).toHaveLength(SEED_FOODS.length);
  });

  it('logs favourites and custom foods, keeping history when a favourite changes', () => {
    const ctx = createTestContext();
    const shake = listFoods(ctx).find((f) => f.name === 'Whey shake')!;
    logFood(ctx, { date: '2026-10-15', foodId: shake.id, servings: 2 });
    logFood(ctx, {
      date: '2026-10-15',
      name: 'Cafe sandwich',
      calories: 450,
      protein: 22,
      servings: 1,
    });
    updateFood(ctx, shake.id, { calories: 999 });
    const entries = listFoodEntries(ctx, '2026-10-15', '2026-10-15');
    expect(entries.map((e) => [e.name, e.calories, e.servings])).toEqual([
      ['Whey shake', 120, 2],
      ['Cafe sandwich', 450, 1],
    ]);
  });

  it('plans meals, copies a day across the week, and logs a planned day', () => {
    const ctx = createTestContext();
    const [oats, box] = listFoods(ctx);
    addMealPlanEntry(ctx, { date: '2026-10-19', slot: 'breakfast', foodId: oats!.id, servings: 1 });
    addMealPlanEntry(ctx, { date: '2026-10-19', slot: 'lunch', foodId: box!.id, servings: 1 });
    copyMealPlanDay(ctx, '2026-10-19', ['2026-10-20', '2026-10-21']);
    expect(listMealPlan(ctx, '2026-10-19', '2026-10-21')).toHaveLength(6);
    const logged = logPlannedDay(ctx, '2026-10-20');
    expect(logged).toHaveLength(2);
    expect(listFoodEntries(ctx, '2026-10-20', '2026-10-20')).toHaveLength(2);
  });
});

describe('physique milestones', () => {
  it('complete when the smoothed trend reaches the checkpoint, not on a single spike', () => {
    const ctx = createTestContext();
    upsertWeighIn(ctx, { date: '2026-10-15', weightKg: 70.5, note: '' });
    upsertWeighIn(ctx, { date: '2026-10-16', weightKg: 72.0, note: '' }); // water spike
    expect(checkPhysiqueMilestones(ctx)).toEqual([]);
    for (let i = 2; i < 40; i++)
      upsertWeighIn(ctx, { date: addDays('2026-10-15', i), weightKg: 71.6, note: '' });
    const done = checkPhysiqueMilestones(ctx);
    expect(done.map((m) => m.title)).toEqual(['Checkpoint: 71.3 kg']);
    expect(listMilestones(ctx, 'physique').filter((m) => m.completedAt)).toHaveLength(1);
  });
});
