import { z } from 'zod';
import { MADANI_JUZ_START_PAGES, validateJuzStarts } from '../domain/quran/mushaf';
import { DEFAULT_SCHEDULER as S } from '../domain/quran/scheduler';

/**
 * Settings are stored per namespace as JSON. Every field has a default so that
 * parsing `{}` yields a complete object; this keeps older databases forward-compatible
 * when new settings are introduced.
 */
export const generalSettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  units: z.enum(['kg', 'lb']).default('kg'),
  /** 0 = Sunday … 6 = Saturday. Monday by default, as is usual in the UK. */
  weekStartsOn: z.number().int().min(0).max(6).default(1),
  /** The date the plan (and all seeded trajectories) start from. */
  planStartDate: z.string().default('2026-10-15'),
  reduceMotion: z.boolean().default(false),
});
export type GeneralSettings = z.infer<typeof generalSettingsSchema>;

export const onboardingSettingsSchema = z.object({
  completedAt: z.string().nullable().default(null),
});
export type OnboardingSettings = z.infer<typeof onboardingSettingsSchema>;

export const profileSettingsSchema = z.object({
  /** Starting weight captured at onboarding; anchors the physique trajectory. */
  startWeightKg: z.number().nullable().default(null),
  startDate: z.string().nullable().default(null),
});
export type ProfileSettings = z.infer<typeof profileSettingsSchema>;

const steps = (fallback: number[]) =>
  z.array(z.number().int().min(1).max(60)).min(1).max(8).default(fallback);

/** Spaced-repetition parameters (see domain/quran/scheduler.ts for the formulas). */
export const schedulerSettingsSchema = z.object({
  learningSteps: steps(S.learningSteps),
  relearnSteps: steps(S.relearnSteps),
  graduatingInterval: z.number().int().min(1).max(120).default(S.graduatingInterval),
  initialEase: z.number().min(1.1).max(4).default(S.initialEase),
  easeMin: z.number().min(1.05).max(3).default(S.easeMin),
  easeMax: z.number().min(1.2).max(5).default(S.easeMax),
  easeBonus: z.number().min(0).max(0.5).default(S.easeBonus),
  shakyPenalty: z.number().min(0).max(1).default(S.shakyPenalty),
  forgottenPenalty: z.number().min(0).max(1.5).default(S.forgottenPenalty),
  shakyMultiplier: z.number().min(0.1).max(1).default(S.shakyMultiplier),
  lapseMultiplier: z.number().min(0.05).max(1).default(S.lapseMultiplier),
  lapseMinInterval: z.number().int().min(1).max(60).default(S.lapseMinInterval),
  maxInterval: z.number().int().min(3).max(180).default(S.maxInterval),
  loadBalanceFraction: z.number().min(0).max(0.3).default(S.loadBalanceFraction),
});

export const quranSettingsSchema = z.object({
  /** Date the mushaf was set up (which juz were already memorised). */
  setupOn: z.string().nullable().default(null),
  direction: z.enum(['forward', 'backward']).default('forward'),
  juzStartPages: z
    .array(z.number().int())
    .refine((v) => validateJuzStarts(v) === null, { message: 'Invalid juz boundaries' })
    .default([...MADANI_JUZ_START_PAGES]),
  baselinePagesPerWeek: z.number().min(0).max(60).default(5),
  revisionMinutesPerDay: z.number().int().min(0).max(600).default(30),
  minutesPerPage: z.number().min(0.5).max(30).default(3),
  newLearningMinutesPerDay: z.number().int().min(0).max(600).default(20),
  tolerancePages: z.number().int().min(0).max(60).default(2),
  /** A one-day override of revision time ("I have 15 minutes today"). */
  todayMinutes: z
    .object({ date: z.string(), minutes: z.number().int().min(0).max(600) })
    .nullable()
    .default(null),
  streakGraceDays: z.number().int().min(0).max(6).default(1),
  scheduler: schedulerSettingsSchema.default({ ...S }),
});
export type QuranSettings = z.infer<typeof quranSettingsSchema>;

export const physiqueSettingsSchema = z.object({
  heightCm: z.number().int().min(100).max(250).nullable().default(null),
  birthYear: z.number().int().min(1900).max(2020).nullable().default(null),
  sex: z.enum(['male', 'female']).nullable().default(null),
  /** Mifflin–St Jeor activity multiplier; 1.55 suits on-your-feet work plus training. */
  activityFactor: z.number().min(1.1).max(2.4).default(1.55),
  surplusKcal: z.number().int().min(-1000).max(1500).default(250),
  proteinPerKg: z.number().min(0.8).max(3.5).default(2),
  calorieOverride: z.number().int().min(800).max(8000).nullable().default(null),
  proteinOverride: z.number().int().min(20).max(500).nullable().default(null),
  trendAlpha: z.number().min(0.02).max(0.5).default(0.1),
  fastMarginKg: z.number().min(0).max(1).default(0.15),
  slowMarginKg: z.number().min(0).max(1).default(0.1),
  maxWeeklyGainPct: z.number().min(0.1).max(2).default(0.5),
  /** Rest days between full-body sessions (1 = every other day). */
  restDays: z.number().int().min(0).max(3).default(1),
  /** Daily adherence score (0–100) that counts towards the nutrition streak. */
  adherenceThreshold: z.number().int().min(40).max(100).default(70),
  streakGraceDays: z.number().int().min(0).max(6).default(1),
});
export type PhysiqueSettings = z.infer<typeof physiqueSettingsSchema>;

const boundary = (v: number) => z.number().min(0).max(100).default(v);

export const degreeSettingsSchema = z.object({
  /** Relative weight of each level in the final classification; 0 = not counted. */
  levelWeights: z
    .object({
      4: z.number().min(0).max(10),
      5: z.number().min(0).max(10),
      6: z.number().min(0).max(10),
    })
    .default({ 4: 0, 5: 1, 6: 2 }),
  boundaries: z
    .object({
      first: boundary(70),
      upperSecond: boundary(60),
      lowerSecond: boundary(50),
      third: boundary(40),
    })
    .default({ first: 70, upperSecond: 60, lowerSecond: 50, third: 40 }),
  creditsPerLevel: z.number().int().min(20).max(240).default(120),
  studyHoursPerWeek: z.number().min(0).max(60).default(6),
  sessionMinutes: z.number().int().min(15).max(240).default(60),
});
export type DegreeSettings = z.infer<typeof degreeSettingsSchema>;

export const gameSettingsSchema = z.object({
  /** Weekly hours of game work to aim for; shown as the reference line on the hours chart. */
  weeklyHoursTarget: z.number().min(0).max(80).default(6),
  /** A timer left running this long is probably forgotten; the Time tab says so. */
  longTimerHours: z.number().min(1).max(24).default(4),
});
export type GameSettings = z.infer<typeof gameSettingsSchema>;

export const plannerSettingsSchema = z.object({
  commuteMinutes: z.number().int().min(0).max(180).default(20),
  sleepHours: z.number().min(4).max(12).default(8),
  windDownMinutes: z.number().int().min(0).max(120).default(30),
  morningRoutineMinutes: z.number().int().min(0).max(120).default(30),
  postShiftRecoveryMinutes: z.number().int().min(0).max(180).default(30),
  dayStart: z.string().default('07:00'),
  dayEnd: z.string().default('23:00'),
  minWindowMinutes: z.number().int().min(5).max(120).default(20),
  minSleepBetweenShiftsHours: z.number().min(4).max(10).default(7),
  /** Budgets used when proposing a week (Quran and study times live in their own settings). */
  trainingMinutes: z.number().int().min(0).max(240).default(75),
  gameSessionMinutes: z.number().int().min(15).max(240).default(60),
  mealPrepMinutes: z.number().int().min(0).max(240).default(60),
  mealPrepPerWeek: z.number().int().min(0).max(7).default(1),
});
export type PlannerSettings = z.infer<typeof plannerSettingsSchema>;

export const windowSettingsSchema = z.object({
  bounds: z
    .object({
      x: z.number().int(),
      y: z.number().int(),
      width: z.number().int().min(400),
      height: z.number().int().min(300),
    })
    .nullable()
    .default(null),
  maximized: z.boolean().default(false),
});
export type WindowSettings = z.infer<typeof windowSettingsSchema>;

export const settingsSchemas = {
  general: generalSettingsSchema,
  onboarding: onboardingSettingsSchema,
  profile: profileSettingsSchema,
  quran: quranSettingsSchema,
  physique: physiqueSettingsSchema,
  degree: degreeSettingsSchema,
  game: gameSettingsSchema,
  planner: plannerSettingsSchema,
  window: windowSettingsSchema,
} as const;

export type SettingsNamespace = keyof typeof settingsSchemas;
export type SettingsMap = { [K in SettingsNamespace]: z.infer<(typeof settingsSchemas)[K]> };
export const SETTINGS_NAMESPACES = Object.keys(settingsSchemas) as SettingsNamespace[];

export function parseSettings<K extends SettingsNamespace>(ns: K, raw: unknown): SettingsMap[K] {
  const schema = settingsSchemas[ns];
  const result = schema.safeParse(raw ?? {});
  // Corrupt or outdated values fall back to defaults rather than breaking the app.
  return (result.success ? result.data : schema.parse({})) as SettingsMap[K];
}

export function defaultSettings(): SettingsMap {
  return Object.fromEntries(
    SETTINGS_NAMESPACES.map((ns) => [ns, settingsSchemas[ns].parse({})]),
  ) as SettingsMap;
}
