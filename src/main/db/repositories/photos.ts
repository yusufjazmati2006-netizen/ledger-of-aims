import type { Photo } from '@shared/schemas/physique';
import { notFound } from '../../errors';
import type { RepoContext } from './context';

interface PhotoRow {
  id: string;
  date: string;
  pose: string;
  file_name: string;
  note: string;
}

const toPhoto = (r: PhotoRow): Photo => ({
  id: r.id,
  date: r.date,
  pose: r.pose,
  note: r.note,
  url: `ledger-photo://${r.id}/full`,
  thumbUrl: `ledger-photo://${r.id}/thumb`,
});

export function listPhotos(ctx: RepoContext): Photo[] {
  return ctx.db
    .prepare<[], PhotoRow>('SELECT * FROM photos ORDER BY date DESC, created_at DESC')
    .all()
    .map(toPhoto);
}

export function photoFileName(ctx: RepoContext, id: string): string | null {
  return (
    ctx.db
      .prepare<[string], { file_name: string }>('SELECT file_name FROM photos WHERE id = ?')
      .get(id)?.file_name ?? null
  );
}

export function insertPhoto(
  ctx: RepoContext,
  input: { id: string; date: string; pose: string; note: string; fileName: string },
): Photo {
  ctx.db
    .prepare(
      'INSERT INTO photos (id, date, pose, file_name, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(input.id, input.date, input.pose, input.fileName, input.note, ctx.clock.nowIso());
  return toPhoto(
    ctx.db
      .prepare<[string], PhotoRow>('SELECT * FROM photos WHERE id = ?')
      .get(input.id) as PhotoRow,
  );
}

export function updatePhoto(
  ctx: RepoContext,
  id: string,
  patch: { date?: string; pose?: string; note?: string },
): Photo {
  const row = ctx.db.prepare<[string], PhotoRow>('SELECT * FROM photos WHERE id = ?').get(id);
  if (!row) throw notFound('Photo', id);
  ctx.db
    .prepare('UPDATE photos SET date = ?, pose = ?, note = ? WHERE id = ?')
    .run(patch.date ?? row.date, patch.pose ?? row.pose, patch.note ?? row.note, id);
  return toPhoto(
    ctx.db.prepare<[string], PhotoRow>('SELECT * FROM photos WHERE id = ?').get(id) as PhotoRow,
  );
}

export function deletePhotoRow(ctx: RepoContext, id: string): string {
  const name = photoFileName(ctx, id);
  if (!name) throw notFound('Photo', id);
  ctx.db.prepare('DELETE FROM photos WHERE id = ?').run(id);
  return name;
}
