import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';

/**
 * Where backups go is kept in a small JSON file beside the database rather than in it,
 * so the recovery screen can still find your backups when the database is damaged.
 */
export function backupConfigPath(userData: string): string {
  return join(userData, 'backup-location.json');
}

export function readBackupDirectory(userData: string, fallback: string): string {
  try {
    const path = backupConfigPath(userData);
    if (!existsSync(path)) return fallback;
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { directory?: unknown };
    return typeof parsed.directory === 'string' && isAbsolute(parsed.directory)
      ? parsed.directory
      : fallback;
  } catch {
    return fallback;
  }
}

export function writeBackupDirectory(userData: string, directory: string | null): void {
  const path = backupConfigPath(userData);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ directory }, null, 2));
}
