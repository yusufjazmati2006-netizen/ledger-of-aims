import { z } from 'zod';
import {
  clockTimeSchema,
  goalIdSchema,
  idSchema,
  localDateSchema,
  patchSchema,
  textSchema,
} from './common';
import type { GoalId } from './common';

export interface Goal {
  id: GoalId;
  title: string;
  subtitle: string;
  nextAction: string;
  sortOrder: number;
}

export const goalPatchSchema = z.object({
  id: goalIdSchema,
  patch: z
    .object({
      title: textSchema(80).min(1),
      subtitle: textSchema(200),
      nextAction: textSchema(280),
    })
    .partial(),
});

export type MilestoneKind = 'milestone' | 'hard-stop';

export interface Milestone {
  id: string;
  goalId: GoalId;
  title: string;
  targetDate: string;
  targetValue: number | null;
  unit: string | null;
  kind: MilestoneKind;
  sortOrder: number;
  completedAt: string | null;
  notes: string;
}

export const milestoneInputSchema = z.object({
  goalId: goalIdSchema,
  title: textSchema(160).min(1),
  targetDate: localDateSchema,
  targetValue: z.number().nullable().default(null),
  unit: textSchema(24).nullable().default(null),
  kind: z.enum(['milestone', 'hard-stop']).default('milestone'),
  notes: textSchema(2000).default(''),
});
export type MilestoneInput = z.input<typeof milestoneInputSchema>;

export const milestonePatchSchema = z.object({
  id: idSchema,
  patch: patchSchema(milestoneInputSchema.omit({ goalId: true })),
});

export const milestoneReorderSchema = z.object({
  goalId: goalIdSchema,
  orderedIds: z.array(idSchema).min(1),
});

export const milestoneCompleteSchema = z.object({
  id: idSchema,
  completed: z.boolean(),
});

export interface ShiftType {
  id: string;
  label: string;
  /** null for the "off" type */
  start: string | null;
  end: string | null;
  sortOrder: number;
}

export const shiftTypePatchSchema = z.object({
  id: idSchema,
  patch: z
    .object({
      label: textSchema(40).min(1),
      start: clockTimeSchema,
      end: clockTimeSchema,
    })
    .partial(),
});

export interface ShiftDay {
  date: string;
  shiftTypeId: string;
}

export const shiftRangeSchema = z.object({ from: localDateSchema, to: localDateSchema });

export const shiftSetSchema = z.object({
  days: z
    .array(z.object({ date: localDateSchema, shiftTypeId: idSchema.nullable() }))
    .min(1)
    .max(366),
});

export interface WeighIn {
  id: string;
  date: string;
  weightKg: number;
  note: string;
}

export const weighInInputSchema = z.object({
  date: localDateSchema,
  weightKg: z.number().min(25).max(350),
  note: textSchema(500).default(''),
});

export const dateRangeSchema = z
  .object({ from: localDateSchema.optional(), to: localDateSchema.optional() })
  .default({});

export const onboardingInputSchema = z.object({
  startWeightKg: z.number().min(25).max(350),
  units: z.enum(['kg', 'lb']),
  weekShifts: z.array(z.object({ date: localDateSchema, shiftTypeId: idSchema })).max(14),
});
export type OnboardingInput = z.infer<typeof onboardingInputSchema>;
