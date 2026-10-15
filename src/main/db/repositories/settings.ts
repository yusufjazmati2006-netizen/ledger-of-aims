import {
  SETTINGS_NAMESPACES,
  parseSettings,
  settingsSchemas,
  type SettingsMap,
  type SettingsNamespace,
} from '@shared/schemas/settings';
import type { RepoContext } from './context';

export function getAllSettings(ctx: RepoContext): SettingsMap {
  const rows = ctx.db
    .prepare<[], { namespace: string; value: string }>('SELECT namespace, value FROM settings')
    .all();
  const stored = new Map(rows.map((r) => [r.namespace, safeJson(r.value)]));
  return Object.fromEntries(
    SETTINGS_NAMESPACES.map((ns) => [ns, parseSettings(ns, stored.get(ns))]),
  ) as SettingsMap;
}

export function getSettings<K extends SettingsNamespace>(
  ctx: RepoContext,
  namespace: K,
): SettingsMap[K] {
  const row = ctx.db
    .prepare<[string], { value: string }>('SELECT value FROM settings WHERE namespace = ?')
    .get(namespace);
  return parseSettings(namespace, row ? safeJson(row.value) : undefined);
}

export function updateSettings<K extends SettingsNamespace>(
  ctx: RepoContext,
  namespace: K,
  patch: Partial<SettingsMap[K]>,
): SettingsMap[K] {
  const current = getSettings(ctx, namespace);
  // Validate the merged value against the full schema so a patch can never store
  // an invalid combination.
  const merged = settingsSchemas[namespace].parse({ ...current, ...patch }) as SettingsMap[K];
  ctx.db
    .prepare(
      `INSERT INTO settings (namespace, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(namespace) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(namespace, JSON.stringify(merged), ctx.clock.nowIso());
  return merged;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
