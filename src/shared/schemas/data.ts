import { z } from 'zod';

export const SEARCH_KINDS = {
  milestone: 'Milestone',
  phase: 'Roadmap phase',
  task: 'Roadmap task',
  learning: 'Learning path',
  decision: 'Engine decision',
  project: 'Practice project',
  devlog: 'Devlog',
  steam: 'Steam checklist',
  module: 'Module',
  assessment: 'Assessment',
  'quran-note': 'Page note',
  review: 'Weekly review',
  habit: 'Habit',
  time: 'Game time',
  study: 'Study session',
  workout: 'Workout',
  'weigh-in': 'Weigh-in',
  exercise: 'Exercise',
  food: 'Food',
  photo: 'Photo',
} as const;
export type SearchKind = keyof typeof SEARCH_KINDS;

export interface SearchHit {
  kind: SearchKind;
  ref: string;
  path: string;
  date: string | null;
  title: string;
  /** The title with matches marked like the snippet. */
  titleMarked: string;
  /** The matching passage, with matches wrapped in \u0001 … \u0002. */
  snippet: string;
}

// ── JSON export / import ────────────────────────────────────────────────────────

export const EXPORT_FORMAT = 'ledger-of-aims-export';

const identifier = z.string().regex(/^[a-z_][a-z0-9_]*$/);
const cell = z.union([z.string(), z.number(), z.null()]);

export const exportFileSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(1),
  appVersion: z.string(),
  /** The last schema migration of the app that wrote it. */
  schema: z.string(),
  exportedAt: z.string(),
  tables: z.record(identifier, z.array(z.record(identifier, cell))),
  /** Progress photos, base64-encoded, keyed by file name; present only if chosen. */
  photos: z.record(z.string().regex(/^[0-9a-f-]{36}(\.thumb)?\.jpg$/), z.string()).optional(),
});
export type ExportFile = z.infer<typeof exportFileSchema>;

export interface ImportPreview {
  /** A token naming the parsed file held in the main process, for `data.importApply`. */
  token: string;
  fileName: string;
  exportedAt: string;
  appVersion: string;
  olderSchema: boolean;
  photos: number;
  tables: { table: string; incoming: number; current: number }[];
}

export interface BackupStatus {
  directory: string;
  isDefault: boolean;
  lastBackupAt: string | null;
  lastError: string | null;
}

export const calendarExportSchema = z.object({
  milestones: z.boolean().default(true),
  deadlines: z.boolean().default(true),
  plan: z.boolean().default(true),
  shifts: z.boolean().default(true),
});
