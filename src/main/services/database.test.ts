import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClock } from '../clock';
import { openDatabase } from '../db/connection';
import { migrations } from '../db/migrations';
import { listGoals } from '../db/repositories/goals';
import { upsertWeighIn, listWeighIns } from '../db/repositories/weighIns';
import { listBackupFiles } from './backupFiles';
import {
  openLedgerDatabase,
  quarantineDatabase,
  restoreDatabaseFile,
  snapshotDatabase,
} from './database';

describe('opening the ledger database', () => {
  let dir: string;
  const clock = createClock('2026-10-15T09:00:00');
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ledger-db-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const open = () =>
    openLedgerDatabase({
      dbPath: join(dir, 'ledger.sqlite'),
      clock,
      backupDir: join(dir, 'backups'),
    });

  it('creates, migrates and seeds a new database', () => {
    const outcome = open();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.applied).toEqual(migrations.map((m) => m.id));
    expect(listGoals({ db: outcome.db, clock })).toHaveLength(4);
    outcome.db.close();
  });

  it('persists data across close and reopen', () => {
    const first = open();
    if (!first.ok) throw new Error('open failed');
    upsertWeighIn({ db: first.db, clock }, { date: '2026-10-15', weightKg: 66.4, note: '' });
    first.db.close();
    const second = open();
    if (!second.ok) throw new Error('reopen failed');
    expect(listWeighIns({ db: second.db, clock })).toHaveLength(1);
    expect(second.applied).toEqual([]);
    second.db.close();
  });

  it('returns a recovery outcome for a file that is not a database', () => {
    writeFileSync(join(dir, 'ledger.sqlite'), 'this is definitely not sqlite '.repeat(200));
    const outcome = open();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.recovery.reason).toBe('corrupt');
  });

  it('returns a recovery outcome for a database from a newer version', () => {
    const db = openDatabase(join(dir, 'ledger.sqlite'));
    db.exec(
      "CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL); INSERT INTO schema_migrations VALUES ('999_future', 'x');",
    );
    db.close();
    const outcome = open();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.recovery.reason).toBe('schema-newer');
  });

  it('snapshots, quarantines and restores without losing anything', () => {
    const first = open();
    if (!first.ok) throw new Error('open failed');
    upsertWeighIn({ db: first.db, clock }, { date: '2026-10-15', weightKg: 66.4, note: '' });
    const backupDir = join(dir, 'backups');
    const snapshot = snapshotDatabase(first.db, backupDir, 'manual', clock);
    first.db.close();
    expect(listBackupFiles(backupDir)).toMatchObject([{ path: snapshot, valid: true }]);

    // Damage the live file, then recover.
    writeFileSync(join(dir, 'ledger.sqlite'), 'garbage');
    expect(open().ok).toBe(false);
    const quarantined = quarantineDatabase(
      join(dir, 'ledger.sqlite'),
      join(dir, 'quarantine'),
      clock,
    );
    expect(existsSync(quarantined)).toBe(true);
    restoreDatabaseFile(snapshot, join(dir, 'ledger.sqlite'));

    const restored = open();
    if (!restored.ok) throw new Error('restore failed');
    expect(listWeighIns({ db: restored.db, clock })).toHaveLength(1);
    restored.db.close();
    expect(readdirSync(join(dir, 'quarantine'))).toHaveLength(1);
  });

  it('marks invalid files in the backup folder', () => {
    const backupDir = join(dir, 'backups');
    const ok = open();
    if (!ok.ok) throw new Error('open failed');
    snapshotDatabase(ok.db, backupDir, 'manual', clock);
    ok.db.close();
    writeFileSync(join(backupDir, 'ledger-broken.sqlite'), 'nope');
    const files = listBackupFiles(backupDir);
    expect(files.map((f) => f.valid).sort()).toEqual([false, true]);
  });
});
