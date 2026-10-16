import type { SearchHit, SearchKind } from '@shared/schemas/data';
import type { RepoContext } from '../db/repositories/context';

/**
 * Every searchable source, as one SELECT producing (kind, ref, path, date, title, body).
 * Rebuilding the whole index takes milliseconds at this app's scale, which is simpler
 * and safer than a trigger per table.
 */
const SOURCES: readonly string[] = [
  `SELECT 'milestone', id, '/milestones', target_date, title, notes FROM milestones`,
  `SELECT 'phase', id, '/game', NULL, title, description FROM roadmap_phases`,
  `SELECT 'task', id, '/game', NULL, title, notes FROM roadmap_tasks`,
  `SELECT 'learning', id, '/game/learning', NULL, title, category || ' ' || notes FROM learning_items`,
  `SELECT 'decision', id, '/game/learning', date, engine || ': ' || decision, rationale FROM engine_decisions`,
  `SELECT 'project', id, '/game/practice', started_on, title, lessons || ' ' || notes FROM practice_projects`,
  `SELECT 'devlog', id, '/game/devlog', date, title, body || ' ' || replace(tags, ',', ' ') FROM devlog_entries`,
  `SELECT 'steam', id, '/game/steam', NULL, title, detail FROM steam_checklist`,
  `SELECT 'module', id, '/degree/modules', NULL, trim(code || ' ' || title), notes FROM modules`,
  `SELECT 'assessment', id, '/degree/modules', due_date, title, notes FROM assessments`,
  `SELECT 'quran-note', page, '/quran/mushaf', NULL, 'Page ' || page, note FROM quran_pages WHERE note <> ''`,
  `SELECT 'review', week_start, '/review/history', week_start, 'Week of ' || week_start,
     went_well || ' ' || went_badly || ' ' || adjust || ' ' || priorities FROM weekly_reviews`,
  `SELECT 'habit', id, '/review/habits', NULL, name, '' FROM habits`,
  `SELECT 'time', id, '/game/time', substr(started_at, 1, 10), 'Game time', note FROM time_entries WHERE note <> ''`,
  `SELECT 'study', id, '/degree/study', date, 'Study session', note FROM study_sessions WHERE note <> ''`,
  `SELECT 'workout', id, '/physique/training', date, 'Workout', notes FROM workouts WHERE notes <> ''`,
  `SELECT 'weigh-in', id, '/physique', date, 'Weigh-in', note FROM weigh_ins WHERE note <> ''`,
  `SELECT 'exercise', id, '/physique/training', NULL, name, notes FROM exercises`,
  `SELECT 'food', id, '/physique/nutrition', NULL, name, '' FROM foods`,
  `SELECT 'photo', id, '/physique/photos', date, 'Photo · ' || pose, note FROM photos WHERE note <> ''`,
];

/**
 * Transliteration marks (ʿ ʾ) and apostrophes are dropped from indexed text and from
 * queries, so "murajaah" finds "murajaʿah" and "juz" finds "juzʾ".
 */
const MARKS = ['ʿ', 'ʾ', '’', "''"];
const strip = (column: string) =>
  MARKS.reduce((expr, mark) => `replace(${expr}, '${mark}', '')`, `coalesce(${column}, '')`);
const stripText = (text: string) => text.replace(/[ʿʾ’']/g, '');

let dirty = true;

/** Marks the index stale; the next search rebuilds it. */
export function invalidateSearch(): void {
  dirty = true;
}

export function rebuildSearch(ctx: RepoContext): void {
  ctx.db.transaction(() => {
    ctx.db.prepare('DELETE FROM search_index').run();
    for (const source of SOURCES) {
      ctx.db
        .prepare(
          `WITH s(kind, ref, path, date, title, body) AS (${source})
           INSERT INTO search_index (kind, ref, path, date, title, body)
           SELECT kind, ref, path, date, ${strip('title')}, ${strip('body')} FROM s`,
        )
        .run();
    }
  })();
  dirty = false;
}

/**
 * Words become prefix terms ("paddl" finds "paddles"); all must match. Quotes and
 * FTS operators typed by the user are neutralised rather than interpreted.
 */
export function ftsQuery(text: string): string | null {
  const words =
    stripText(text)
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length === 0) return null;
  return words
    .slice(0, 8)
    .map((w) => `"${w}"*`)
    .join(' ');
}

export function search(ctx: RepoContext, text: string, limit = 30): SearchHit[] {
  const query = ftsQuery(text);
  if (!query) return [];
  if (dirty) rebuildSearch(ctx);
  return ctx.db
    .prepare<
      [string, number],
      {
        kind: SearchKind;
        // Page notes are keyed by page number.
        ref: string | number;
        path: string;
        date: string | null;
        title: string;
        titleMarked: string;
        snippet: string;
      }
    >(
      `SELECT kind, ref, path, date, title,
              highlight(search_index, 4, char(1), char(2)) AS titleMarked,
              snippet(search_index, 5, char(1), char(2), '…', 14) AS snippet
       FROM search_index WHERE search_index MATCH ?
       ORDER BY bm25(search_index, 0, 0, 0, 0, 6.0, 1.0) LIMIT ?`,
    )
    .all(query, limit)
    .map((r) => ({ ...r, ref: String(r.ref) }));
}
