import type { BrowserWindow } from 'electron';
import type { RepoContext } from '../../db/repositories/context';
import {
  createExercise,
  deleteSet,
  listExercises,
  listWorkouts,
  reorderExercises,
  setWorkoutNotes,
  updateExercise,
  updateSet,
} from '../../db/repositories/training';
import {
  addMealPlanEntry,
  copyMealPlanDay,
  createFood,
  deleteFoodEntry,
  deletePrepSession,
  listFoodEntries,
  listFoods,
  listMealPlan,
  listPrepSessions,
  logFood,
  logPlannedDay,
  removeMealPlanEntry,
  savePrepSession,
  updateFood,
} from '../../db/repositories/nutrition';
import { listPhotos, updatePhoto } from '../../db/repositories/photos';
import { logSet } from '../../services/training';
import { deletePhoto, importPhotos } from '../../services/photos';
import type { PartialHandlerTable } from '../types';

export function physiqueHandlers(
  ctx: RepoContext,
  options: { photosDir: string; window: () => BrowserWindow | null },
): PartialHandlerTable {
  return {
    'exercises.list': () => listExercises(ctx),
    'exercises.create': (input) => createExercise(ctx, input),
    'exercises.update': ({ id, patch }) => updateExercise(ctx, id, patch),
    'exercises.reorder': ({ orderedIds }) => reorderExercises(ctx, orderedIds),
    'workouts.list': ({ from, to }) => listWorkouts(ctx, from, to),
    'workouts.logSet': (input) => logSet(ctx, input),
    'workouts.updateSet': ({ id, ...patch }) => updateSet(ctx, id, patch),
    'workouts.deleteSet': ({ id }) => {
      deleteSet(ctx, id);
      return null;
    },
    'workouts.setNotes': ({ id, notes }) => {
      setWorkoutNotes(ctx, id, notes);
      return null;
    },

    'foods.list': () => listFoods(ctx),
    'foods.create': (input) => createFood(ctx, input),
    'foods.update': ({ id, patch }) => updateFood(ctx, id, patch),
    'foodEntries.list': ({ from, to }) => listFoodEntries(ctx, from, to),
    'foodEntries.log': (input) => logFood(ctx, input),
    'foodEntries.delete': ({ id }) => {
      deleteFoodEntry(ctx, id);
      return null;
    },
    'mealPlan.list': ({ from, to }) => listMealPlan(ctx, from, to),
    'mealPlan.add': (input) => addMealPlanEntry(ctx, input),
    'mealPlan.remove': ({ id }) => {
      removeMealPlanEntry(ctx, id);
      return null;
    },
    'mealPlan.copyDay': ({ from, to }) => copyMealPlanDay(ctx, from, to),
    'mealPlan.logDay': ({ date }) => logPlannedDay(ctx, date),
    'prep.list': ({ from, to }) => listPrepSessions(ctx, from, to),
    'prep.save': (input) => savePrepSession(ctx, input),
    'prep.delete': ({ id }) => {
      deletePrepSession(ctx, id);
      return null;
    },

    'photos.list': () => listPhotos(ctx),
    'photos.import': (meta) => importPhotos(ctx, options.photosDir, options.window(), meta),
    'photos.update': ({ id, patch }) => updatePhoto(ctx, id, patch),
    'photos.delete': ({ id }) => {
      deletePhoto(ctx, options.photosDir, id);
      return null;
    },
  };
}
