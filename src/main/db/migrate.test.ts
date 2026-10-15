import { describe, expect, it } from 'vitest';
import { openDatabase } from './connection';
import { appliedMigrationIds, migrate, pendingMigrations, SchemaNewerError } from './migrate';
import { migrations } from './migrations';

describe('migration runner', () => {
  it('applies every migration once, in order', () => {
    const db = openDatabase(':memory:');
    const applied = migrate(db, migrations);
    expect(applied).toEqual(migrations.map((m) => m.id));
    expect(appliedMigrationIds(db)).toEqual(migrations.map((m) => m.id));
    expect(migrate(db, migrations)).toEqual([]);
  });

  it('runs the snapshot hook only when something is pending', () => {
    const db = openDatabase(':memory:');
    let calls = 0;
    migrate(db, migrations, { beforeApply: () => calls++ });
    migrate(db, migrations, { beforeApply: () => calls++ });
    expect(calls).toBe(1);
  });

  it('rolls back a failing migration completely', () => {
    const db = openDatabase(':memory:');
    const broken = [
      { id: '001_ok', sql: 'CREATE TABLE a (x INTEGER);' },
      { id: '002_bad', sql: 'CREATE TABLE b (y INTEGER); INSERT INTO nowhere VALUES (1);' },
    ];
    expect(() => migrate(db, broken)).toThrow();
    expect(appliedMigrationIds(db)).toEqual(['001_ok']);
    const tables = db
      .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((r) => r.name);
    expect(tables).toContain('a');
    expect(tables).not.toContain('b');
  });

  it('refuses a database written by a newer app version', () => {
    const db = openDatabase(':memory:');
    migrate(db, [...migrations, { id: '999_future', sql: 'SELECT 1;' }]);
    expect(() => pendingMigrations(db, migrations)).toThrow(SchemaNewerError);
  });

  it('requires migrations to be declared in lexical order', () => {
    const db = openDatabase(':memory:');
    expect(() =>
      migrate(db, [
        { id: '002_b', sql: 'SELECT 1;' },
        { id: '001_a', sql: 'SELECT 1;' },
      ]),
    ).toThrow(/lexical order/);
  });

  it('enforces foreign keys', () => {
    const db = openDatabase(':memory:');
    migrate(db, migrations);
    expect(() =>
      db
        .prepare(
          `INSERT INTO milestones (id, goal_id, title, target_date, created_at, updated_at)
           VALUES ('x', 'quran', 't', '2027-01-01', 'n', 'n')`,
        )
        .run(),
    ).toThrow(/FOREIGN KEY/);
  });
});
