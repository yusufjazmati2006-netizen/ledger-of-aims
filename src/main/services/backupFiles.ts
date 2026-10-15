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
      return {
        path,
        name,
        createdAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
        valid: isValidLedgerDatabase(path),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
