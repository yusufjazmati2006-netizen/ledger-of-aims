import { z } from 'zod';
import {
  goalPatchSchema,
  milestoneCompleteSchema,
  milestoneInputSchema,
  milestonePatchSchema,
  milestoneReorderSchema,
  onboardingInputSchema,
  shiftRangeSchema,
  shiftSetSchema,
  shiftTypePatchSchema,
  weighInInputSchema,
  dateRangeSchema,
  type Goal,
  type Milestone,
  type ShiftDay,
  type ShiftType,
  type WeighIn,
} from '../schemas/core';
import { idSchema, localDateSchema, patchSchema } from '../schemas/common';
import {
  pageListSchema,
  pageNumberSchema,
  pageRecordSchema,
  pageStateSchema,
  quranSetupSchema,
  ratingSchema,
  type QuranMutation,
  type QuranPagesPayload,
  type ReviewEntry,
} from '../schemas/quran';
import {
  exerciseInputSchema,
  foodInputSchema,
  logFoodSchema,
  logSetSchema,
  mealSlotSchema,
  photoMetaSchema,
  type Exercise,
  type Food,
  type FoodEntry,
  type LoggedSetResult,
  type MealPlanEntry,
  type Photo,
  type PrepSession,
  type Workout,
  type WorkoutSet,
} from '../schemas/physique';
import { settingsSchemas, type SettingsMap } from '../schemas/settings';

/**
 * The single source of truth for main ⇄ renderer communication.
 *
 * Each channel declares a Zod schema for its input (validated in the main process
 * before any handler runs), a phantom output type, and the data domains it mutates.
 * After a successful mutation the main process broadcasts `data:changed` with those
 * domains so every open window can refresh.
 */

/** Phantom marker carrying an output type without any runtime value. */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the type parameter is the point
const out = <T>() => undefined as unknown as T;

export type DataDomain =
  | 'settings'
  | 'goals'
  | 'milestones'
  | 'shifts'
  | 'weighIns'
  | 'onboarding'
  | 'quran'
  | 'training'
  | 'nutrition'
  | 'photos';

interface ChannelSpec {
  input: z.ZodType;
  output: unknown;
  mutates?: readonly DataDomain[];
}

export interface RecoveryInfo {
  reason: 'corrupt' | 'schema-newer' | 'open-failed';
  detail: string;
  dbPath: string;
  backups: BackupFile[];
}

export interface BackupFile {
  path: string;
  name: string;
  createdAt: string;
  sizeBytes: number;
  valid: boolean;
}

export interface AppInfo {
  version: string;
  platform: string;
  dataPath: string;
  dbPath: string;
  isPackaged: boolean;
}

export type Bootstrap =
  | {
      mode: 'normal';
      today: string;
      nowIso: string;
      info: AppInfo;
      settings: SettingsMap;
    }
  | { mode: 'recovery'; info: AppInfo; recovery: RecoveryInfo };

const settingsUpdateSchema = z.discriminatedUnion('namespace', [
  z.object({ namespace: z.literal('general'), patch: patchSchema(settingsSchemas.general) }),
  z.object({ namespace: z.literal('onboarding'), patch: patchSchema(settingsSchemas.onboarding) }),
  z.object({ namespace: z.literal('profile'), patch: patchSchema(settingsSchemas.profile) }),
  z.object({ namespace: z.literal('quran'), patch: patchSchema(settingsSchemas.quran) }),
  z.object({ namespace: z.literal('physique'), patch: patchSchema(settingsSchemas.physique) }),
  z.object({ namespace: z.literal('window'), patch: patchSchema(settingsSchemas.window) }),
]);

export const contract = {
  // App & diagnostics
  'app.bootstrap': { input: z.void(), output: out<Bootstrap>() },
  'app.today': { input: z.void(), output: out<{ today: string; nowIso: string }>() },
  'app.revealDataFolder': { input: z.void(), output: out<null>() },
  'diagnostics.networkLog': {
    input: z.void(),
    output: out<{ blocked: { url: string; at: string }[] }>(),
  },

  // Settings
  'settings.get': { input: z.void(), output: out<SettingsMap>() },
  'settings.update': {
    input: settingsUpdateSchema,
    output: out<SettingsMap>(),
    mutates: ['settings'],
  },

  // Goals & milestones
  'goals.list': { input: z.void(), output: out<Goal[]>() },
  'goals.update': { input: goalPatchSchema, output: out<Goal>(), mutates: ['goals'] },
  'milestones.list': { input: z.void(), output: out<Milestone[]>() },
  'milestones.create': {
    input: milestoneInputSchema,
    output: out<Milestone>(),
    mutates: ['milestones'],
  },
  'milestones.update': {
    input: milestonePatchSchema,
    output: out<Milestone>(),
    mutates: ['milestones'],
  },
  'milestones.delete': {
    input: z.object({ id: idSchema }),
    output: out<null>(),
    mutates: ['milestones'],
  },
  'milestones.reorder': {
    input: milestoneReorderSchema,
    output: out<Milestone[]>(),
    mutates: ['milestones'],
  },
  'milestones.setCompleted': {
    input: milestoneCompleteSchema,
    output: out<Milestone>(),
    mutates: ['milestones'],
  },

  // Shifts
  'shifts.types': { input: z.void(), output: out<ShiftType[]>() },
  'shifts.updateType': {
    input: shiftTypePatchSchema,
    output: out<ShiftType>(),
    mutates: ['shifts'],
  },
  'shifts.range': { input: shiftRangeSchema, output: out<ShiftDay[]>() },
  'shifts.set': { input: shiftSetSchema, output: out<ShiftDay[]>(), mutates: ['shifts'] },

  // Weigh-ins (the core of onboarding; the full physique module builds on these)
  'weighIns.list': { input: dateRangeSchema, output: out<WeighIn[]>() },
  'weighIns.upsert': {
    input: weighInInputSchema,
    output: out<WeighIn>(),
    mutates: ['weighIns', 'milestones'],
  },
  'weighIns.delete': {
    input: z.object({ id: idSchema }),
    output: out<null>(),
    mutates: ['weighIns'],
  },

  // Onboarding
  'onboarding.complete': {
    input: onboardingInputSchema,
    output: out<SettingsMap>(),
    mutates: ['onboarding', 'settings', 'weighIns', 'shifts'],
  },

  // Quran
  'quran.pages': { input: z.void(), output: out<QuranPagesPayload>() },
  'quran.reviews': {
    input: z.object({ from: localDateSchema, to: localDateSchema }),
    output: out<ReviewEntry[]>(),
  },
  'quran.setup': {
    input: quranSetupSchema,
    output: out<QuranMutation>(),
    mutates: ['quran', 'settings', 'milestones'],
  },
  'quran.learnNext': {
    input: z.object({ count: z.number().int().min(1).max(40) }),
    output: out<QuranMutation>(),
    mutates: ['quran', 'milestones'],
  },
  'quran.setState': {
    input: z.object({ pages: pageListSchema, state: pageStateSchema }),
    output: out<QuranMutation>(),
    mutates: ['quran', 'milestones'],
  },
  'quran.review': {
    input: z.object({ pages: pageListSchema, rating: ratingSchema }),
    output: out<QuranMutation>(),
    mutates: ['quran', 'milestones'],
  },
  'quran.undo': {
    input: z.object({ batchId: idSchema, before: z.array(pageRecordSchema).max(604) }),
    output: out<null>(),
    mutates: ['quran'],
  },
  'quran.setNote': {
    input: z.object({ page: pageNumberSchema, note: z.string().max(2000) }),
    output: out<null>(),
    mutates: ['quran'],
  },

  // Physique — training
  'exercises.list': { input: z.void(), output: out<Exercise[]>() },
  'exercises.create': {
    input: exerciseInputSchema,
    output: out<Exercise>(),
    mutates: ['training'],
  },
  'exercises.update': {
    input: z.object({
      id: idSchema,
      patch: patchSchema(exerciseInputSchema).extend({ archived: z.boolean().optional() }),
    }),
    output: out<Exercise>(),
    mutates: ['training'],
  },
  'exercises.reorder': {
    input: z.object({ orderedIds: z.array(idSchema).min(1) }),
    output: out<Exercise[]>(),
    mutates: ['training'],
  },
  'workouts.list': { input: dateRangeSchema, output: out<Workout[]>() },
  'workouts.logSet': { input: logSetSchema, output: out<LoggedSetResult>(), mutates: ['training'] },
  'workouts.updateSet': {
    input: z.object({
      id: idSchema,
      reps: z.number().int().min(0).max(100).optional(),
      loadKg: z.number().min(0).max(1000).optional(),
    }),
    output: out<WorkoutSet>(),
    mutates: ['training'],
  },
  'workouts.deleteSet': {
    input: z.object({ id: idSchema }),
    output: out<null>(),
    mutates: ['training'],
  },
  'workouts.setNotes': {
    input: z.object({ id: idSchema, notes: z.string().max(2000) }),
    output: out<null>(),
    mutates: ['training'],
  },

  // Physique — nutrition
  'foods.list': { input: z.void(), output: out<Food[]>() },
  'foods.create': { input: foodInputSchema, output: out<Food>(), mutates: ['nutrition'] },
  'foods.update': {
    input: z.object({
      id: idSchema,
      patch: patchSchema(foodInputSchema).extend({ archived: z.boolean().optional() }),
    }),
    output: out<Food>(),
    mutates: ['nutrition'],
  },
  'foodEntries.list': {
    input: z.object({ from: localDateSchema, to: localDateSchema }),
    output: out<FoodEntry[]>(),
  },
  'foodEntries.log': { input: logFoodSchema, output: out<FoodEntry>(), mutates: ['nutrition'] },
  'foodEntries.delete': {
    input: z.object({ id: idSchema }),
    output: out<null>(),
    mutates: ['nutrition'],
  },
  'mealPlan.list': {
    input: z.object({ from: localDateSchema, to: localDateSchema }),
    output: out<MealPlanEntry[]>(),
  },
  'mealPlan.add': {
    input: z.object({
      date: localDateSchema,
      slot: mealSlotSchema,
      foodId: idSchema,
      servings: z.number().min(0.25).max(20),
    }),
    output: out<MealPlanEntry>(),
    mutates: ['nutrition'],
  },
  'mealPlan.remove': {
    input: z.object({ id: idSchema }),
    output: out<null>(),
    mutates: ['nutrition'],
  },
  'mealPlan.copyDay': {
    input: z.object({ from: localDateSchema, to: z.array(localDateSchema).min(1).max(31) }),
    output: out<MealPlanEntry[]>(),
    mutates: ['nutrition'],
  },
  'mealPlan.logDay': {
    input: z.object({ date: localDateSchema }),
    output: out<FoodEntry[]>(),
    mutates: ['nutrition'],
  },
  'prep.list': {
    input: z.object({ from: localDateSchema, to: localDateSchema }),
    output: out<PrepSession[]>(),
  },
  'prep.save': {
    input: z.object({
      id: idSchema.optional(),
      date: localDateSchema,
      notes: z.string().max(2000),
      done: z.boolean(),
    }),
    output: out<PrepSession>(),
    mutates: ['nutrition'],
  },
  'prep.delete': { input: z.object({ id: idSchema }), output: out<null>(), mutates: ['nutrition'] },

  // Physique — photos (files stay in the private data folder)
  'photos.list': { input: z.void(), output: out<Photo[]>() },
  'photos.import': { input: photoMetaSchema, output: out<Photo[]>(), mutates: ['photos'] },
  'photos.update': {
    input: z.object({ id: idSchema, patch: patchSchema(photoMetaSchema) }),
    output: out<Photo>(),
    mutates: ['photos'],
  },
  'photos.delete': { input: z.object({ id: idSchema }), output: out<null>(), mutates: ['photos'] },

  // Recovery (available when the database could not be opened)
  'recovery.restore': { input: z.object({ path: z.string().min(1) }), output: out<null>() },
  'recovery.startFresh': { input: z.void(), output: out<null>() },
  'recovery.quit': { input: z.void(), output: out<null>() },
} as const satisfies Record<string, ChannelSpec>;

export type Contract = typeof contract;
export type Channel = keyof Contract;
/** What the caller passes (before Zod defaults are applied). */
export type InputOf<C extends Channel> = z.input<Contract[C]['input']>;
/** What the handler receives (after Zod parsing). */
export type ParsedInputOf<C extends Channel> = z.output<Contract[C]['input']>;
export type OutputOf<C extends Channel> = Contract[C]['output'];

export function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(contract, value);
}

export function mutatedDomains(channel: Channel): readonly DataDomain[] {
  const spec: ChannelSpec = contract[channel];
  return spec.mutates ?? [];
}

export type ErrorCode =
  'VALIDATION' | 'NOT_FOUND' | 'CONFLICT' | 'UNKNOWN_CHANNEL' | 'UNAVAILABLE' | 'INTERNAL';

export interface IpcError {
  code: ErrorCode;
  message: string;
  issues?: { path: string; message: string }[];
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError };

/** Events pushed from main to renderer windows. */
export interface EventPayloads {
  'data:changed': { domains: DataDomain[] };
  navigate: { path: string };
  command: { id: 'quick-log' | 'palette' | 'export' | 'import' | 'backup-now' };
  'milestone:completed': { milestone: Milestone };
}
export type EventName = keyof EventPayloads;
