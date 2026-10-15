import { z } from 'zod';
import { idSchema, localDateSchema, textSchema } from './common';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  repMin: number;
  repMax: number;
  setsTarget: number;
  incrementKg: number;
  bodyweight: boolean;
  inProgram: boolean;
  sortOrder: number;
  archived: boolean;
  notes: string;
}

export const exerciseInputSchema = z.object({
  name: textSchema(80).min(1),
  muscleGroup: textSchema(40).default(''),
  repMin: z.number().int().min(1).max(50),
  repMax: z.number().int().min(1).max(100),
  setsTarget: z.number().int().min(1).max(10),
  incrementKg: z.number().min(0).max(50),
  bodyweight: z.boolean().default(false),
  inProgram: z.boolean().default(false),
  notes: textSchema(1000).default(''),
});

export interface WorkoutSet {
  id: string;
  workoutId: string;
  exerciseId: string;
  setIndex: number;
  reps: number;
  loadKg: number;
}

export interface Workout {
  id: string;
  date: string;
  notes: string;
  sets: WorkoutSet[];
}

export const logSetSchema = z.object({
  date: localDateSchema,
  exerciseId: idSchema,
  reps: z.number().int().min(0).max(100),
  loadKg: z.number().min(0).max(1000),
});

export interface LoggedSetResult {
  set: WorkoutSet;
  isPersonalRecord: boolean;
}

export interface Food {
  id: string;
  name: string;
  calories: number;
  protein: number;
  serving: string;
  ingredients: string;
  favourite: boolean;
  sortOrder: number;
  archived: boolean;
}

export const foodInputSchema = z.object({
  name: textSchema(80).min(1),
  calories: z.number().min(0).max(5000),
  protein: z.number().min(0).max(400),
  serving: textSchema(40).default(''),
  ingredients: textSchema(2000).default(''),
  favourite: z.boolean().default(true),
});

export interface FoodEntry {
  id: string;
  date: string;
  foodId: string | null;
  name: string;
  calories: number;
  protein: number;
  servings: number;
}

export const logFoodSchema = z.union([
  z.object({ date: localDateSchema, foodId: idSchema, servings: z.number().min(0.25).max(20) }),
  z.object({
    date: localDateSchema,
    name: textSchema(80).min(1),
    calories: z.number().min(0).max(5000),
    protein: z.number().min(0).max(400),
    servings: z.number().min(0.25).max(20),
  }),
]);

export const mealSlotSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type MealSlot = z.infer<typeof mealSlotSchema>;

export interface MealPlanEntry {
  id: string;
  date: string;
  slot: MealSlot;
  foodId: string;
  servings: number;
}

export interface PrepSession {
  id: string;
  date: string;
  notes: string;
  done: boolean;
}

export interface Photo {
  id: string;
  date: string;
  pose: string;
  note: string;
  url: string;
  thumbUrl: string;
}

export const photoMetaSchema = z.object({
  date: localDateSchema,
  pose: textSchema(30).min(1),
  note: textSchema(500).default(''),
});
