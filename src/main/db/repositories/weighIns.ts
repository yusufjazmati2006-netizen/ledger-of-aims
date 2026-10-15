import type { WeighIn } from '@shared/schemas/core';
import { notFound } from '../../errors';
import { newId, type RepoContext } from './context';

interface WeighInRow {
  id: string;
  date: string;
  weight_kg: number;
  note: string;
}

const toWeighIn = (r: WeighInRow): WeighIn => ({
  id: r.id,
  date: r.date,
  weightKg: r.weight_kg,
  note: r.note,
});

export function listWeighIns(
  ctx: RepoContext,
  range: { from?: string; to?: string } = {},
): WeighIn[] {
  return ctx.db
    .prepare<[string, string], WeighInRow>(
      'SELECT id, date, weight_kg, note FROM weigh_ins WHERE date BETWEEN ? AND ? ORDER BY date',
    )
    .all(range.from ?? '0000-01-01', range.to ?? '9999-12-31')
    .map(toWeighIn);
}

/** One weigh-in per day: logging again on the same date replaces the earlier value. */
export function upsertWeighIn(
  ctx: RepoContext,
  input: { date: string; weightKg: number; note: string },
): WeighIn {
  const now = ctx.clock.nowIso();
  // Two decimal places is well beyond the precision of a bathroom scale.
  const kg = Math.round(input.weightKg * 100) / 100;
  ctx.db
    .prepare(
      `INSERT INTO weigh_ins (id, date, weight_kg, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET weight_kg = excluded.weight_kg, note = excluded.note, updated_at = excluded.updated_at`,
    )
    .run(newId(), input.date, kg, input.note, now, now);
  const row = ctx.db
    .prepare<[string], WeighInRow>('SELECT id, date, weight_kg, note FROM weigh_ins WHERE date = ?')
    .get(input.date);
  if (!row) throw notFound('Weigh-in', input.date);
  return toWeighIn(row);
}

export function deleteWeighIn(ctx: RepoContext, id: string): void {
  const result = ctx.db.prepare('DELETE FROM weigh_ins WHERE id = ?').run(id);
  if (result.changes === 0) throw notFound('Weigh-in', id);
}
