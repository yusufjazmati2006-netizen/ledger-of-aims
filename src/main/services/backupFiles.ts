import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { BackupFile } from '@shared/ipc/contract';
import { checkIntegrity, openDatabase } from '../db/connection';

/** True when the file opens as a SQLite database, passes quick_check and has our schema. */
export function isValidLedgerDatabase(path: string): boolean {
  try {
    const db = openDatabase(path, { readonly: true });
    try {
      if (!checkIntegrity(db).ok) return false;
      const table = db
        .prepare<[], { name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
        )
        .get();
      return table !== undefined;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

/** Lists `.sqlite` backups in a folder, newest first, each checked for validity. */
export function listBackupFiles(dir: string): BackupFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sqlite'))
    .map((name) => {
      const path = join(dir, name);
      const stat = statSync(path);
      const parsed = parseBackupName(name);
      return {
        path,
        name,
        label: parsed?.label ?? 'other',
        // The time in the name (by the app's clock) wins over the file's mtime, which
        // copying can change.
        createdAt: parsed?.createdAt ?? stat.mtime.toISOString(),
        sizeBytes: stat.size,
        valid: isValidLedgerDatabase(path),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** "ledger-daily-2026-10-15T09-00-00-000Z.sqlite" → its label and time. */
export function parseBackupName(name: string): { label: string; createdAt: string } | null {
  const m = /^ledger-([a-z-]+?)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.sqlite$/.exec(name);
  if (!m?.[1] || !m[2]) return null;
  const [date, time] = m[2].split('T') as [string, string];
  const [hh, mm, ss, ms] = time.replace('Z', '').split('-');
  return { label: m[1], createdAt: `${date}T${hh}:${mm}:${ss}.${ms}Z` };
}
