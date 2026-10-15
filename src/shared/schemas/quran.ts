import { z } from 'zod';
import type { Milestone } from './core';
import type { PageRecord, Rating } from '../domain/quran/scheduler';
import { localDateSchema } from './common';

export const pageNumberSchema = z.number().int().min(1).max(604);
export const pageListSchema = z.array(pageNumberSchema).min(1).max(604);
export const ratingSchema = z.enum(['solid', 'shaky', 'forgotten']);
export const pageStateSchema = z.enum(['not_started', 'new', 'memorized', 'revision']);

export const pageRecordSchema = z.object({
  page: pageNumberSchema,
  state: pageStateSchema,
  learnedOn: localDateSchema.nullable(),
  ease: z.number().min(1).max(5),
  intervalDays: z.number().int().min(0).max(400),
  step: z.number().int().min(0).max(20),
  dueOn: localDateSchema.nullable(),
  lastReviewedOn: localDateSchema.nullable(),
  lapses: z.number().int().min(0),
  reviews: z.number().int().min(0),
  relearnInterval: z.number().int().min(0).max(400),
});

export const quranSetupSchema = z.object({
  juz: z.array(z.number().int().min(1).max(30)).max(30),
  direction: z.enum(['forward', 'backward']),
});

export interface QuranPagesPayload {
  records: PageRecord[];
  notes: Record<number, string>;
}

export interface QuranMutation {
  batchId: string;
  before: PageRecord[];
  after: PageRecord[];
  completedMilestones: Milestone[];
}

export interface ReviewEntry {
  page: number;
  reviewedOn: string;
  rating: Rating;
}
