import { z } from 'zod';

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
