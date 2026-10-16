import { describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestContext } from '../db/testing';
import {
  backupsToPrune,
  createBackup,
  mirrorPhotos,
  needsDailyBackup,
  restorePhotos,
} from './backup';
import { listBackupFiles, parseBackupName } from './backupFiles';
import { readBackupDirectory, writeBackupDirectory } from './backupConfig';

const temp = () => mkdtempSync(join(tmpdir(), 'ledger-backup-'));

describe('backups', () => {
  it('reads label and time from the file name', () => {
    expect(parseBackupName('ledger-pre-restore-2026-10-15T09-00-00-000Z.sqlite')).toEqual({
      label: 'pre-restore',
      createdAt: '2026-10-15T09:00:00.000Z',
    });
    expect(parseBackupName('my copy.sqlite')).toBeNull();
  });

  it('keeps the newest 30 daily backups and never touches other files', () => {
    const files = Array.from({ length: 33 }, (_, i) => ({
      path: `d${i}`,
      label: 'daily',
      createdAt: new Date(Date.UTC(2026, 8, 1 + i)).toISOString(),
    }));
    files.push({ path: 'mine', label: 'other', createdAt: '2020-01-01T00:00:00.000Z' });
    expect(backupsToPrune(files)).toEqual(['d2', 'd1', 'd0']);
  });

  it('knows when today’s daily backup is missing', () => {
    const now = new Date('2026-10-15T12:00:00');
    expect(needsDailyBackup([], now)).toBe(true);
    expect(
      needsDailyBackup(
        [{ label: 'daily', createdAt: new Date('2026-10-15T08:00:00').toISOString() }],
        now,
      ),
    ).toBe(false);
    expect(needsDailyBackup([{ label: 'manual', createdAt: now.toISOString() }], now)).toBe(true);
  });

  it('writes valid, labelled snapshots and mirrors photos without deleting', () => {
    const ctx = createTestContext();
    const dir = temp();
    const photos = temp();
    writeFileSync(join(photos, 'a.jpg'), 'A');
    const path = createBackup({
      db: ctx.db,
      dir,
      photosDir: photos,
      label: 'manual',
      clock: ctx.clock,
    });
    const listed = listBackupFiles(dir);
    expect(listed).toEqual([expect.objectContaining({ path, label: 'manual', valid: true })]);
    expect(readdirSync(join(dir, 'photos'))).toEqual(['a.jpg']);
    // A later backup made after a photo was deleted still keeps the old file.
    writeFileSync(join(photos, 'b.jpg'), 'B');
    mirrorPhotos(photos, dir);
    expect(readdirSync(join(dir, 'photos')).sort()).toEqual(['a.jpg', 'b.jpg']);
    const restored = temp();
    expect(restorePhotos(dir, restored)).toBe(2);
    expect(restorePhotos(dir, restored)).toBe(0);
  });

  it('keeps the backup location outside the database', () => {
    const userData = temp();
    expect(readBackupDirectory(userData, '/default')).toBe('/default');
    writeBackupDirectory(userData, '/Volumes/Backup/Ledger');
    expect(readBackupDirectory(userData, '/default')).toBe('/Volumes/Backup/Ledger');
    writeBackupDirectory(userData, null);
    expect(readBackupDirectory(userData, '/default')).toBe('/default');
    writeFileSync(join(userData, 'backup-location.json'), '{nonsense');
    expect(readBackupDirectory(userData, '/default')).toBe('/default');
  });
});
