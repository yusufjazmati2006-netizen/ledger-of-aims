import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { localDateOf } from '@shared/domain/time/localDate';
import type { BackupFile } from '@shared/ipc/contract';
import type { Clock } from '../clock';
import type { Db } from '../db/connection';
import { snapshotDatabase } from './database';
import { listBackupFiles } from './backupFiles';

export type BackupLabel = 'daily' | 'manual' | 'pre-restore' | 'pre-import' | 'pre-migration';

/** How many of each kind to keep. Daily backups roll over after 30. */
export const RETENTION: Record<string, number> = {
  daily: 30,
  manual: 20,
  'pre-restore': 10,
  'pre-import': 10,
  'pre-migration': 10,
};

/** Backups beyond their kind's limit, oldest first. Unrecognised files are never touched. */
export function backupsToPrune(files: readonly Pick<BackupFile, 'path' | 'label' | 'createdAt'>[]) {
  const out: string[] = [];
  for (const [label, keep] of Object.entries(RETENTION)) {
    const ofKind = files
      .filter((f) => f.label === label)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    out.push(...ofKind.slice(keep).map((f) => f.path));
  }
  return out;
}

/** True when no daily backup was made on today's local date. */
export function needsDailyBackup(
  files: readonly Pick<BackupFile, 'label' | 'createdAt'>[],
  now: Date,
) {
  const today = localDateOf(now);
  return !files.some((f) => f.label === 'daily' && localDateOf(new Date(f.createdAt)) === today);
}

/**
 * Photo files never change once written (each is named by its id), so they are
 * mirrored into `<backups>/photos/`: new files are copied and nothing is removed, which
 * keeps every photo any backup could refer to.
 */
export function mirrorPhotos(photosDir: string, backupDir: string): number {
  if (!existsSync(photosDir)) return 0;
  const target = join(backupDir, 'photos');
  mkdirSync(target, { recursive: true });
  let copied = 0;
  for (const name of readdirSync(photosDir)) {
    const from = join(photosDir, name);
    const to = join(target, name);
    if (!statSync(from).isFile()) continue;
    if (existsSync(to) && statSync(to).size === statSync(from).size) continue;
    copyFileSync(from, to);
    copied++;
  }
  return copied;
}

/** Copies back any photo the restored data may need that is missing from the data folder. */
export function restorePhotos(backupDir: string, photosDir: string): number {
  const source = join(backupDir, 'photos');
  if (!existsSync(source)) return 0;
  mkdirSync(photosDir, { recursive: true });
  let copied = 0;
  for (const name of readdirSync(source)) {
    const to = join(photosDir, name);
    if (existsSync(to)) continue;
    copyFileSync(join(source, name), to);
    copied++;
  }
  return copied;
}

export function createBackup(options: {
  db: Db;
  dir: string;
  photosDir: string;
  label: BackupLabel;
  clock: Clock;
}): string {
  const path = snapshotDatabase(options.db, options.dir, options.label, options.clock);
  mirrorPhotos(options.photosDir, options.dir);
  for (const old of backupsToPrune(listBackupFiles(options.dir))) rmSync(old, { force: true });
  return path;
}
