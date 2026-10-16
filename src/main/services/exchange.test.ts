import { describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestContext } from '../db/testing';
import { seedDatabase } from '../db/seed';
import { upsertWeighIn, listWeighIns } from '../db/repositories/weighIns';
import { saveHabit, checkHabit, habitsData } from '../db/repositories/review';
import { applyImport, exportData, previewImport, readExport } from './exchange';

const temp = () => mkdtempSync(join(tmpdir(), 'ledger-exchange-'));

describe('JSON export and import', () => {
  it('round-trips every table, and photos when asked', () => {
    const source = createTestContext();
    upsertWeighIn(source, { date: '2026-10-15', weightKg: 66.4, note: 'after shift' });
    const habit = saveHabit(source, {
      name: 'Phone outside',
      goalId: null,
      graceDays: 1,
      archived: false,
    });
    checkHabit(source, habit.id, '2026-10-15', true);
    const photos = temp();
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    writeFileSync(join(photos, `${id}.jpg`), 'JPEG');
    const file = exportData(source, {
      appVersion: '0.8.0',
      photosDir: photos,
      includePhotos: true,
    });
    expect(Object.keys(file.tables)).toContain('weigh_ins');
    expect(Object.keys(file.tables)).not.toContain('schema_migrations');
    expect(Object.keys(file.photos ?? {})).toEqual([`${id}.jpg`]);

    const target = createTestContext();
    upsertWeighIn(target, { date: '2026-10-01', weightKg: 80, note: '' });
    const parsed = readExport(target, JSON.stringify(file));
    const preview = previewImport(target, parsed, { token: 't', fileName: 'x.json' });
    expect(preview.tables.find((t) => t.table === 'weigh_ins')).toEqual({
      table: 'weigh_ins',
      incoming: 1,
      current: 1,
    });
    expect(preview.photos).toBe(1);
    const targetPhotos = temp();
    applyImport(target, parsed, targetPhotos);
    expect(listWeighIns(target).map((w) => w.weightKg)).toEqual([66.4]);
    expect(habitsData(target, '2026-10-01', '2026-10-31').checks[habit.id]).toEqual(['2026-10-15']);
    expect(readdirSync(targetPhotos)).toEqual([`${id}.jpg`]);
  });

  it('refuses files that are not exports, are from a newer version, or name unknown tables', () => {
    const ctx = createTestContext();
    const good = exportData(ctx, { appVersion: '0.8.0', photosDir: temp(), includePhotos: false });
    expect(() => readExport(ctx, 'not json')).toThrow('not valid JSON');
    expect(() => readExport(ctx, JSON.stringify({ hello: 1 }))).toThrow(
      'not a Ledger of Aims export',
    );
    expect(() => readExport(ctx, JSON.stringify({ ...good, schema: '999_future' }))).toThrow(
      'newer version',
    );
    expect(() =>
      readExport(ctx, JSON.stringify({ ...good, tables: { ...good.tables, nope: [] } })),
    ).toThrow('Unknown table');
    expect(() =>
      readExport(ctx, JSON.stringify({ ...good, tables: { weigh_ins: [{ id: 'x', hacked: 1 }] } })),
    ).toThrow('Unknown column');
  });

  it('rolls back completely when the export breaks a foreign key', () => {
    const ctx = createTestContext();
    upsertWeighIn(ctx, { date: '2026-10-15', weightKg: 66.4, note: '' });
    const file = exportData(ctx, { appVersion: '0.8.0', photosDir: temp(), includePhotos: false });
    const broken = {
      ...file,
      tables: {
        ...file.tables,
        habit_checks: [
          { habit_id: 'missing', date: '2026-10-15', created_at: '2026-10-15T00:00:00Z' },
        ],
      },
    };
    expect(() => applyImport(ctx, readExport(ctx, JSON.stringify(broken)), temp())).toThrow(
      'broken links',
    );
    expect(listWeighIns(ctx)).toHaveLength(1);
    // A table absent from an older export is emptied, then seeding fills defaults back in.
    const { steam_checklist: _steam, ...older } = file.tables;
    applyImport(ctx, readExport(ctx, JSON.stringify({ ...file, tables: older })), temp());
    expect(ctx.db.prepare('SELECT COUNT(*) AS n FROM steam_checklist').get()).toEqual({ n: 0 });
    seedDatabase(ctx);
    expect(ctx.db.prepare('SELECT COUNT(*) AS n FROM steam_checklist').get()).toEqual({
      n: file.tables.steam_checklist?.length,
    });
  });
});
