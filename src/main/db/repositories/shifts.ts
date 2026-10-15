import type { ShiftDay, ShiftType } from '@shared/schemas/core';
import { DomainError, notFound } from '../../errors';
import type { RepoContext } from './context';

interface ShiftTypeRow {
  id: string;
  label: string;
  start_time: string | null;
  end_time: string | null;
  sort_order: number;
}

const toShiftType = (r: ShiftTypeRow): ShiftType => ({
  id: r.id,
  label: r.label,
  start: r.start_time,
  end: r.end_time,
  sortOrder: r.sort_order,
});

export function listShiftTypes(ctx: RepoContext): ShiftType[] {
  return ctx.db
    .prepare<[], ShiftTypeRow>('SELECT * FROM shift_types ORDER BY sort_order, id')
    .all()
    .map(toShiftType);
}

export function updateShiftType(
  ctx: RepoContext,
  id: string,
  patch: Partial<Pick<ShiftType, 'label' | 'start' | 'end'>>,
): ShiftType {
  const row = ctx.db
    .prepare<[string], ShiftTypeRow>('SELECT * FROM shift_types WHERE id = ?')
    .get(id);
  if (!row) throw notFound('Shift type', id);
  const current = toShiftType(row);
  if (current.start === null && (patch.start !== undefined || patch.end !== undefined)) {
    throw new DomainError('CONFLICT', 'The "off" type has no working hours.');
  }
  const next = { ...current, ...patch };
  if (next.start !== null && next.start === next.end) {
    throw new DomainError('CONFLICT', 'A shift must have a non-zero length.');
  }
  ctx.db
    .prepare('UPDATE shift_types SET label = ?, start_time = ?, end_time = ? WHERE id = ?')
    .run(next.label, next.start, next.end, id);
  return next;
}

export function listShiftDays(ctx: RepoContext, from: string, to: string): ShiftDay[] {
  return ctx.db
    .prepare<[string, string], { date: string; shift_type_id: string }>(
      'SELECT date, shift_type_id FROM shift_days WHERE date BETWEEN ? AND ? ORDER BY date',
    )
    .all(from, to)
    .map((r) => ({ date: r.date, shiftTypeId: r.shift_type_id }));
}

/** Sets (or, with `null`, clears) the shift for each given date. */
export function setShiftDays(
  ctx: RepoContext,
  days: { date: string; shiftTypeId: string | null }[],
): ShiftDay[] {
  const known = new Set(listShiftTypes(ctx).map((t) => t.id));
  for (const d of days) {
    if (d.shiftTypeId !== null && !known.has(d.shiftTypeId))
      throw notFound('Shift type', d.shiftTypeId);
  }
  const upsert = ctx.db.prepare(
    `INSERT INTO shift_days (date, shift_type_id) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET shift_type_id = excluded.shift_type_id`,
  );
  const remove = ctx.db.prepare('DELETE FROM shift_days WHERE date = ?');
  ctx.db.transaction(() => {
    for (const d of days) {
      if (d.shiftTypeId === null) remove.run(d.date);
      else upsert.run(d.date, d.shiftTypeId);
    }
  })();
  const dates = days.map((d) => d.date).sort();
  return listShiftDays(ctx, dates[0] ?? '', dates[dates.length - 1] ?? '');
}
