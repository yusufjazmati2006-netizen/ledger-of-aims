import { z } from 'zod';
import { goalIdSchema, idSchema, localDateSchema, textSchema, type GoalId } from './common';

/** Figures for one week, computed from the data rather than typed in. */
export interface WeekMetrics {
  weekStart: string;
  quranPagesLearned: number;
  quranPagesRevised: number;
  quranDaysRevised: number;
  weighIns: number;
  /** Change between the first and last weigh-in of the week, if there were two. */
  weightChangeKg: number | null;
  workouts: number;
  studyMinutes: number;
  gameMinutes: number;
  focusSessions: number;
  tasksFinished: number;
  devlogEntries: number;
  milestonesCompleted: string[];
  planBlocksDone: number;
  planBlocksPlanned: number;
}

export interface WeeklyReview {
  weekStart: string;
  priorities: string[];
  wentWell: string;
  wentBadly: string;
  adjust: string;
  metrics: WeekMetrics | null;
  completedAt: string | null;
}

export const reviewInputSchema = z.object({
  weekStart: localDateSchema,
  priorities: z.array(textSchema(200)).max(3).default([]),
  wentWell: textSchema(4000).default(''),
  wentBadly: textSchema(4000).default(''),
  adjust: textSchema(4000).default(''),
  /** Saving as complete snapshots the week's metrics. */
  complete: z.boolean().default(true),
});

export interface Habit {
  id: string;
  name: string;
  goalId: GoalId | null;
  graceDays: number;
  archived: boolean;
  sortOrder: number;
}

export interface HabitsData {
  habits: Habit[];
  /** Dates each habit was done within the requested range. */
  checks: Record<string, string[]>;
}

export const habitInputSchema = z.object({
  id: idSchema.optional(),
  name: textSchema(80).min(1),
  goalId: goalIdSchema.nullable().default(null),
  graceDays: z.number().int().min(0).max(6).default(1),
  archived: z.boolean().default(false),
});
