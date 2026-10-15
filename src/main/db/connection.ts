import Database from 'better-sqlite3';

export type Db = Database.Database;

/** Opens (creating if needed) a database with the pragmas the app relies on. */
export function openDatabase(file: string, options: { readonly?: boolean } = {}): Db {
  const db = new Database(file, {
    readonly: options.readonly ?? false,
    fileMustExist: options.readonly ?? false,
  });
  try {
    // The first statement is where SQLite actually reads the file header, so a
    // non-database or badly damaged file throws here.
    if (!options.readonly) {
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
    }
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 3000');
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export interface IntegrityResult {
  ok: boolean;
  detail: string;
}

/** `quick_check` verifies page structure without the cost of a full integrity_check. */
export function checkIntegrity(db: Db): IntegrityResult {
  const rows = db.pragma('quick_check') as { quick_check: string }[];
  const messages = rows.map((r) => r.quick_check);
  const ok = messages.length === 1 && messages[0] === 'ok';
  return { ok, detail: ok ? 'ok' : messages.slice(0, 5).join('; ') };
}

const CORRUPTION_CODES = new Set(['SQLITE_CORRUPT', 'SQLITE_NOTADB', 'SQLITE_CORRUPT_VTAB']);

export function isCorruptionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && CORRUPTION_CODES.has(code);
}
