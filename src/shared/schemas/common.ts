import { z } from 'zod';
import { isLocalDate } from '../domain/time/localDate';
import { isClockTime } from '../domain/time/clockTime';

export const localDateSchema = z
  .string()
  .refine(isLocalDate, { message: 'Expected a date in YYYY-MM-DD format' });

export const clockTimeSchema = z
  .string()
  .refine(isClockTime, { message: 'Expected a time in HH:MM format' });

export const idSchema = z.string().min(1).max(64);

export const goalIdSchema = z.enum(['quran', 'game', 'degree', 'physique']);
export type GoalId = z.infer<typeof goalIdSchema>;

export const GOAL_IDS: readonly GoalId[] = ['quran', 'game', 'degree', 'physique'];

/** Trimmed, bounded free text. */
export const textSchema = (max = 2000) => z.string().trim().max(max);

type StripDefault<T> = T extends z.ZodDefault<infer Inner> ? Inner : T;
export type PatchShape<S extends z.ZodRawShape> = {
  [K in keyof S]: z.ZodOptional<StripDefault<S[K]>>;
};

/**
 * A schema for partial updates of `schema`: every field optional and — crucially —
 * no defaults. In Zod 4, `.partial()` still applies field defaults, so a one-field
 * patch would silently reset every defaulted field. Patches must only carry the
 * fields the caller actually sent.
 */
export function patchSchema<S extends z.ZodRawShape>(
  schema: z.ZodObject<S>,
): z.ZodObject<PatchShape<S>> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    const inner =
      field instanceof z.ZodDefault ? (field.unwrap() as z.ZodType) : (field as z.ZodType);
    shape[key] = inner.optional();
  }
  return z.object(shape) as unknown as z.ZodObject<PatchShape<S>>;
}
