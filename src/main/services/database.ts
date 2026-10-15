import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { RecoveryInfo } from '@shared/ipc/contract';
import { checkIntegrity, isCorruptionError, openDatabase, type Db } from '../db/connection';
import { migrate, SchemaNewerError, type Migration } from '../db/migrate';
import { migrations as allMigrations } from '../db/migrations';
import { seedDatabase } from '../db/seed';
import type { Clock } from '../clock';
import { listBackupFiles } from './backupFiles';

export type OpenOutcome =
  { ok: true; db: Db; applied: string[] } | { ok: false; recovery: Omit<RecoveryInfo, 'backups'> };

/**
 * Opens the ledger database, verifies it, migrates it and seeds it.
 *
 * Any sign of corruption (an unreadable header, a failed quick_check, or a migration
 * that hits a damaged page) produces a recovery outcome instead of an exception, so
 * the app can offer to restore a backup rather than crash.
 */
export function openLedgerDatabase(options: {
  dbPath: string;
  clock: Clock;
  backupDir: string;
  migrations?: readonly Migration[];
}): OpenOutcome {
  const { dbPath, clock } = options;
  mkdirSync(dirname(dbPath), { recursive: true });
  let db: Db | undefined;
  try {
    const existed = existsSync(dbPath);
    db = openDatabase(dbPath);
    if (existed) {
      const integrity = checkIntegrity(db);
      if (!integrity.ok) {
        db.close();
        return { ok: false, recovery: { reason: 'corrupt', detail: integrity.detail, dbPath } };
      }
    }
    const opened = db;
    const applied = migrate(opened, options.migrations ?? allMigrations, {
      now: () => clock.nowIso(),
      beforeApply: () => {
        if (existed) snapshotDatabase(opened, options.backupDir, 'pre-migration', clock);
      },
    });
    seedDatabase({ db: opened, clock });
    return { ok: true, db: opened, applied };
  } catch (error) {
    db?.close();
    if (error instanceof SchemaNewerError) {
      return { ok: false, recovery: { reason: 'schema-newer', detail: error.message, dbPath } };
    }
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      recovery: { reason: isCorruptionError(error) ? 'corrupt' : 'open-failed', detail, dbPath },
    };
  }
}

export function recoveryInfo(base: Omit<RecoveryInfo, 'backups'>, backupDir: string): RecoveryInfo {
  return { ...base, backups: listBackupFiles(backupDir) };
}

/** A consistent online copy of the live database using SQLite's backup API. */
export function snapshotDatabase(db: Db, dir: string, label: string, clock: Clock): string {
  mkdirSync(dir, { recursive: true });
  const stamp = clock.nowIso().replace(/[:.]/g, '-');
  const target = join(dir, `ledger-${label}-${stamp}.sqlite`);
  // better-sqlite3's backup() is async; for snapshots taken during boot we want a
  // synchronous, consistent copy, which VACUUM INTO provides.
  db.prepare('VACUUM INTO ?').run(target);
  return target;
}

/** Moves a damaged database (and its WAL/SHM side files) aside. Nothing is deleted. */
export function quarantineDatabase(dbPath: string, quarantineDir: string, clock: Clock): string {
  mkdirSync(quarantineDir, { recursive: true });
  const stamp = clock.nowIso().replace(/[:.]/g, '-');
  const target = join(quarantineDir, `${basename(dbPath, '.sqlite')}-${stamp}.sqlite`);
  if (existsSync(dbPath)) renameSync(dbPath, target);
  for (const suffix of ['-wal', '-shm']) {
    if (existsSync(dbPath + suffix)) renameSync(dbPath + suffix, target + suffix);
  }
  return target;
}

/** Replaces the (closed) live database with a backup copy. */
export function restoreDatabaseFile(backupPath: string, dbPath: string): void {
  for (const suffix of ['-wal', '-shm']) rmSync(dbPath + suffix, { force: true });
  copyFileSync(backupPath, dbPath);
}
