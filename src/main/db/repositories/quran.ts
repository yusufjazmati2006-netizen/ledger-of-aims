import type { PageRecord, PageState, Rating } from '@shared/domain/quran/scheduler';
import type { ReviewEntry } from '@shared/schemas/quran';
import { newId, type RepoContext } from './context';

interface PageRow {
  page: number;
  state: PageState;
  learned_on: string | null;
  ease: number;
  interval_days: number;
  step: number;
  due_on: string | null;
  last_reviewed_on: string | null;
  lapses: number;
  reviews: number;
  relearn_interval: number;
  note: string;
}

const toRecord = (r: PageRow): PageRecord => ({
  page: r.page,
  state: r.state,
  learnedOn: r.learned_on,
  ease: r.ease,
  intervalDays: r.interval_days,
  step: r.step,
  dueOn: r.due_on,
  lastReviewedOn: r.last_reviewed_on,
  lapses: r.lapses,
  reviews: r.reviews,
  relearnInterval: r.relearn_interval,
});

export function listPages(ctx: RepoContext): {
  records: PageRecord[];
  notes: Record<number, string>;
} {
  const rows = ctx.db.prepare<[], PageRow>('SELECT * FROM quran_pages ORDER BY page').all();
  const notes: Record<number, string> = {};
  for (const r of rows) if (r.note) notes[r.page] = r.note;
  return { records: rows.map(toRecord), notes };
}

export function getPageRecords(ctx: RepoContext, pages: readonly number[]): PageRecord[] {
  if (pages.length === 0) return [];
  const wanted = new Set(pages);
  return listPages(ctx).records.filter((r) => wanted.has(r.page));
}

export function savePages(ctx: RepoContext, records: readonly PageRecord[]): void {
  const update = ctx.db.prepare(
    `UPDATE quran_pages SET state = ?, learned_on = ?, ease = ?, interval_days = ?, step = ?, due_on = ?,
       last_reviewed_on = ?, lapses = ?, reviews = ?, relearn_interval = ?, updated_at = ? WHERE page = ?`,
  );
  const now = ctx.clock.nowIso();
  for (const r of records) {
    update.run(
      r.state,
      r.learnedOn,
      r.ease,
      r.intervalDays,
      r.step,
      r.dueOn,
      r.lastReviewedOn,
      r.lapses,
      r.reviews,
      r.relearnInterval,
      now,
      r.page,
    );
  }
}

export function insertReviews(
  ctx: RepoContext,
  batchId: string,
  rating: Rating,
  before: readonly PageRecord[],
  after: readonly PageRecord[],
): void {
  const insert = ctx.db.prepare(
    `INSERT INTO quran_reviews (id, batch_id, page, reviewed_on, rating, before_json, after_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const today = ctx.clock.today();
  const now = ctx.clock.nowIso();
  const afterByPage = new Map(after.map((r) => [r.page, r]));
  for (const b of before) {
    insert.run(
      newId(),
      batchId,
      b.page,
      today,
      rating,
      JSON.stringify(b),
      JSON.stringify(afterByPage.get(b.page)),
      now,
    );
  }
}

export function deleteReviewBatch(ctx: RepoContext, batchId: string): number {
  return ctx.db.prepare('DELETE FROM quran_reviews WHERE batch_id = ?').run(batchId).changes;
}

export function listReviews(ctx: RepoContext, from: string, to: string): ReviewEntry[] {
  return ctx.db
    .prepare<[string, string], { page: number; reviewed_on: string; rating: Rating }>(
      'SELECT page, reviewed_on, rating FROM quran_reviews WHERE reviewed_on BETWEEN ? AND ? ORDER BY created_at',
    )
    .all(from, to)
    .map((r) => ({ page: r.page, reviewedOn: r.reviewed_on, rating: r.rating }));
}

export function setPageNote(ctx: RepoContext, page: number, note: string): void {
  ctx.db
    .prepare('UPDATE quran_pages SET note = ?, updated_at = ? WHERE page = ?')
    .run(note.trim(), ctx.clock.nowIso(), page);
}
