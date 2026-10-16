import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EXPORT_FORMAT,
  exportFileSchema,
  type ExportFile,
  type ImportPreview,
} from '@shared/schemas/data';
import { DomainError } from '../errors';
import type { RepoContext } from '../db/repositories/context';
import { migrations } from '../db/migrations';

/** Bookkeeping and derived tables are not part of your data. */
const EXCLUDED = new Set(['schema_migrations', 'notification_log', 'sqlite_sequence']);

/** The user tables of the current schema, with their columns. */
export function dataTables(ctx: RepoContext): Map<string, Set<string>> {
  const tables = ctx.db
    .prepare<[], { name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'search_index%'
         AND sql NOT LIKE 'CREATE VIRTUAL TABLE%'
       ORDER BY name`,
    )
    .all()
    .map((r) => r.name)
    .filter((name) => !EXCLUDED.has(name));
  return new Map(
    tables.map((t) => [
      t,
      new Set(
        ctx.db
          .prepare<[], { name: string }>(`SELECT name FROM pragma_table_info('${t}')`)
          .all()
          .map((c) => c.name),
      ),
    ]),
  );
}

const currentSchema = () => migrations[migrations.length - 1]?.id ?? '000';

export function exportData(
  ctx: RepoContext,
  options: { appVersion: string; photosDir: string; includePhotos: boolean },
): ExportFile {
  const tables: ExportFile['tables'] = {};
  for (const table of dataTables(ctx).keys()) {
    tables[table] = ctx.db
      .prepare<[], Record<string, string | number | null>>(`SELECT * FROM "${table}"`)
      .all();
  }
  const file: ExportFile = {
    format: EXPORT_FORMAT,
    version: 1,
    appVersion: options.appVersion,
    schema: currentSchema(),
    exportedAt: ctx.clock.nowIso(),
    tables,
  };
  if (options.includePhotos && existsSync(options.photosDir)) {
    const photos: Record<string, string> = {};
    for (const name of readdirSync(options.photosDir)) {
      if (/^[0-9a-f-]{36}(\.thumb)?\.jpg$/.test(name))
        photos[name] = readFileSync(join(options.photosDir, name)).toString('base64');
    }
    file.photos = photos;
  }
  return file;
}

/**
 * Parses and checks an export without changing anything: the envelope is validated
 * with Zod, the schema must not be newer than this app's, and every table and column
 * must exist here.
 */
export function readExport(ctx: RepoContext, text: string): ExportFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DomainError('CONFLICT', 'That file is not valid JSON.');
  }
  const parsed = exportFileSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new DomainError(
      'CONFLICT',
      `That file is not a Ledger of Aims export, or it is damaged${first ? ` (${first.path.join('.') || 'file'}: ${first.message})` : ''}.`,
    );
  }
  const file = parsed.data;
  const known = migrations.map((m) => m.id);
  if (!known.includes(file.schema)) {
    throw new DomainError(
      'CONFLICT',
      'This export was made by a newer version of Ledger of Aims. Update the app first.',
    );
  }
  const tables = dataTables(ctx);
  for (const [table, rows] of Object.entries(file.tables)) {
    const columns = tables.get(table);
    if (!columns) throw new DomainError('CONFLICT', `Unknown table in export: ${table}`);
    for (const row of rows) {
      for (const column of Object.keys(row)) {
        if (!columns.has(column))
          throw new DomainError('CONFLICT', `Unknown column in export: ${table}.${column}`);
      }
    }
  }
  return file;
}

export function previewImport(
  ctx: RepoContext,
  file: ExportFile,
  meta: { token: string; fileName: string },
): ImportPreview {
  const tables = [...dataTables(ctx).keys()].map((table) => ({
    table,
    incoming: file.tables[table]?.length ?? 0,
    current:
      ctx.db.prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM "${table}"`).get()?.n ?? 0,
  }));
  return {
    token: meta.token,
    fileName: meta.fileName,
    exportedAt: file.exportedAt,
    appVersion: file.appVersion,
    olderSchema: file.schema !== currentSchema(),
    photos: Object.keys(file.photos ?? {}).filter((n) => !n.includes('.thumb')).length,
    tables: tables.filter((t) => t.incoming > 0 || t.current > 0),
  };
}

/**
 * Replaces all data with the export's, in one transaction. Foreign keys are checked
 * before committing; any problem rolls everything back. Tables the export does not
 * contain (it came from an older version) are emptied, then the caller re-seeds.
 */
export function applyImport(ctx: RepoContext, file: ExportFile, photosDir: string): void {
  const tables = dataTables(ctx);
  const db = ctx.db;
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      for (const table of tables.keys()) db.prepare(`DELETE FROM "${table}"`).run();
      for (const [table, rows] of Object.entries(file.tables)) {
        for (const row of rows) {
          const columns = Object.keys(row);
          if (columns.length === 0) continue;
          db.prepare(
            `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
          ).run(...columns.map((c) => row[c] ?? null));
        }
      }
      const violations = db.pragma('foreign_key_check') as unknown[];
      if (violations.length > 0) {
        throw new DomainError(
          'CONFLICT',
          `The export refers to records that are missing (${violations.length} broken links). Nothing was changed.`,
        );
      }
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
  if (file.photos) {
    mkdirSync(photosDir, { recursive: true });
    for (const [name, data] of Object.entries(file.photos))
      writeFileSync(join(photosDir, name), Buffer.from(data, 'base64'));
  }
}
