import type Database from 'better-sqlite3';

export interface Migration {
  id: string;
  sql: string;
}

export class SchemaNewerError extends Error {
  constructor(readonly unknownIds: string[]) {
    super(
      `This database was written by a newer version of Ledger of Aims (unknown migrations: ${unknownIds.join(', ')}).`,
    );
    this.name = 'SchemaNewerError';
  }
}

function ensureTable(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id         TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
}

export function appliedMigrationIds(db: Database.Database): string[] {
  ensureTable(db);
  return db
    .prepare<[], { id: string }>('SELECT id FROM schema_migrations ORDER BY id')
    .all()
    .map((r) => r.id);
}

export function pendingMigrations(
  db: Database.Database,
  migrations: readonly Migration[],
): Migration[] {
  const applied = new Set(appliedMigrationIds(db));
  const known = new Set(migrations.map((m) => m.id));
  const unknown = [...applied].filter((id) => !known.has(id));
  if (unknown.length > 0) throw new SchemaNewerError(unknown);
  return migrations.filter((m) => !applied.has(m.id));
}

/**
 * Applies pending migrations in order, each inside its own transaction so a failing
 * migration leaves the database exactly as it was before that migration began.
 * `beforeApply` runs once (only when something is pending) — used to snapshot the
 * database before its schema changes.
 */
export function migrate(
  db: Database.Database,
  migrations: readonly Migration[],
  options: { beforeApply?: (pending: Migration[]) => void; now?: () => string } = {},
): string[] {
  const sorted = [...migrations].sort((a, b) => a.id.localeCompare(b.id));
  if (sorted.some((m, i) => m.id !== migrations[i]?.id)) {
    throw new Error('Migrations must be declared in lexical order of their IDs.');
  }
  const pending = pendingMigrations(db, migrations);
  if (pending.length === 0) return [];
  options.beforeApply?.(pending);
  const now = options.now ?? (() => new Date().toISOString());
  const record = db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)');
  for (const migration of pending) {
    db.transaction(() => {
      db.exec(migration.sql);
      record.run(migration.id, now());
    })();
  }
  return pending.map((m) => m.id);
}
