import { z } from 'zod';
import { goalIdSchema, idSchema, localDateSchema, textSchema } from './common';
import type { GoalId } from './common';

export interface DegreeYear {
  id: string;
  level: 4 | 5 | 6;
  label: string;
  startDate: string | null;
  endDate: string | null;
}

export interface DegreeModule {
  id: string;
  yearId: string;
  code: string;
  title: string;
  credits: number;
  notes: string;
  sortOrder: number;
}

export const ASSESSMENT_KINDS = [
  'coursework',
  'essay',
  'report',
  'exam',
  'presentation',
  'portfolio',
  'quiz',
  'other',
] as const;
export const ASSESSMENT_STATUSES = ['not-started', 'in-progress', 'submitted', 'graded'] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export interface Assessment {
  id: string;
  moduleId: string;
  title: string;
  kind: (typeof ASSESSMENT_KINDS)[number];
  weight: number;
  dueDate: string | null;
  status: AssessmentStatus;
  grade: number | null;
  notes: string;
}

export interface DegreeData {
  years: DegreeYear[];
  modules: DegreeModule[];
  assessments: Assessment[];
}

export const yearPatchSchema = z.object({
  id: idSchema,
  patch: z
    .object({
      label: textSchema(60).min(1),
      startDate: localDateSchema.nullable(),
      endDate: localDateSchema.nullable(),
    })
    .partial(),
});

export const moduleInputSchema = z.object({
  yearId: idSchema,
  code: textSchema(20).default(''),
  title: textSchema(120).min(1),
  credits: z.number().int().min(1).max(120),
  notes: textSchema(2000).default(''),
});

export const assessmentInputSchema = z.object({
  moduleId: idSchema,
  title: textSchema(120).min(1),
  kind: z.enum(ASSESSMENT_KINDS).default('coursework'),
  weight: z.number().min(0).max(100),
  dueDate: localDateSchema.nullable().default(null),
  status: z.enum(ASSESSMENT_STATUSES).default('not-started'),
  grade: z.number().min(0).max(100).nullable().default(null),
  notes: textSchema(2000).default(''),
});

export interface StudySession {
  id: string;
  date: string;
  minutes: number;
  moduleId: string | null;
  note: string;
}

export const studyLogSchema = z.object({
  date: localDateSchema,
  minutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60),
  moduleId: idSchema.nullable().default(null),
  note: textSchema(500).default(''),
});

export interface PlanBlock {
  id: string;
  date: string;
  start: number;
  end: number;
  goalId: GoalId;
  kind: string;
  title: string;
  pinned: boolean;
  done: boolean;
}

export const planBlockInputSchema = z
  .object({
    date: localDateSchema,
    start: z.number().int().min(0).max(1439),
    end: z.number().int().min(1).max(1440),
    goalId: goalIdSchema,
    kind: textSchema(30).default('session'),
    title: textSchema(120).default(''),
    pinned: z.boolean().default(true),
  })
  .refine((b) => b.end > b.start, { message: 'A block must end after it starts.' });

export const planBlockPatchSchema = z.object({
  id: idSchema,
  patch: z
    .object({
      date: localDateSchema,
      start: z.number().int().min(0).max(1439),
      end: z.number().int().min(1).max(1440),
      title: textSchema(120),
      pinned: z.boolean(),
      done: z.boolean(),
    })
    .partial(),
});
