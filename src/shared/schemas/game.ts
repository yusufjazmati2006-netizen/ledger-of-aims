import { z } from 'zod';
import { idSchema, localDateSchema, textSchema } from './common';
import type { Dependency, RoadmapPhase, RoadmapTask } from '../domain/game/roadmap';

export interface Phase extends RoadmapPhase {
  description: string;
  milestoneId: string | null;
}

export interface Task extends RoadmapTask {
  notes: string;
  doneAt: string | null;
}

export interface RoadmapData {
  phases: Phase[];
  tasks: Task[];
  dependencies: Dependency[];
}

export const phaseInputSchema = z.object({
  id: idSchema.optional(),
  title: textSchema(80).min(1),
  description: textSchema(500).default(''),
  milestoneId: idSchema.nullable().default(null),
});

export const taskInputSchema = z.object({
  id: idSchema.optional(),
  phaseId: idSchema,
  title: textSchema(160).min(1),
  notes: textSchema(4000).default(''),
  estimateHours: z.number().positive().max(2000).nullable().default(null),
});

export interface ResourceLink {
  label: string;
  url: string;
}

export const linkSchema = z.object({
  label: textSchema(80),
  url: z
    .string()
    .trim()
    .max(500)
    .refine((u) => /^https?:\/\/\S+$/i.test(u), {
      message: 'Links must start with http:// or https://',
    }),
});

export interface LearningItem {
  id: string;
  category: string;
  title: string;
  notes: string;
  links: ResourceLink[];
  done: boolean;
  sortOrder: number;
}

export const learningInputSchema = z.object({
  id: idSchema.optional(),
  category: textSchema(60).min(1),
  title: textSchema(120).min(1),
  notes: textSchema(4000).default(''),
  links: z.array(linkSchema).max(30).default([]),
  done: z.boolean().default(false),
});

export interface EngineDecision {
  id: string;
  date: string;
  engine: string;
  decision: string;
  rationale: string;
}

export const decisionInputSchema = z.object({
  date: localDateSchema,
  engine: textSchema(60).min(1),
  decision: textSchema(200).min(1),
  rationale: textSchema(4000).default(''),
});

export const PROJECT_STATUSES = ['idea', 'active', 'done', 'shelved'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface PracticeProject {
  id: string;
  title: string;
  status: ProjectStatus;
  startedOn: string | null;
  finishedOn: string | null;
  lessons: string;
  notes: string;
  sortOrder: number;
}

export const projectInputSchema = z.object({
  id: idSchema.optional(),
  title: textSchema(120).min(1),
  status: z.enum(PROJECT_STATUSES).default('idea'),
  startedOn: localDateSchema.nullable().default(null),
  finishedOn: localDateSchema.nullable().default(null),
  lessons: textSchema(8000).default(''),
  notes: textSchema(4000).default(''),
});

export interface TimeEntryRecord {
  id: string;
  startedAt: string;
  endedAt: string | null;
  kind: 'timer' | 'manual';
  focus: boolean;
  note: string;
}

export const manualTimeSchema = z.object({
  date: localDateSchema,
  /** Optional start time HH:MM. Without one, today's entry ends now; other days' sit at midday. */
  start: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .default(null),
  minutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60),
  focus: z.boolean().default(false),
  note: textSchema(500).default(''),
});

export interface DevlogEntry {
  id: string;
  date: string;
  title: string;
  body: string;
  tags: string[];
}

export const devlogInputSchema = z.object({
  id: idSchema.optional(),
  date: localDateSchema,
  title: textSchema(160).min(1),
  body: z.string().max(100_000).default(''),
  tags: z.array(textSchema(30).min(1)).max(20).default([]),
});

export interface SteamItem {
  id: string;
  section: string;
  title: string;
  detail: string;
  done: boolean;
  sortOrder: number;
}

export const steamInputSchema = z.object({
  id: idSchema.optional(),
  section: textSchema(60).min(1),
  title: textSchema(160).min(1),
  detail: textSchema(1000).default(''),
});
