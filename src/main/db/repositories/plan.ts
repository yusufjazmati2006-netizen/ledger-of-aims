import type { GoalId } from '@shared/schemas/common';
import type { PlanBlock } from '@shared/schemas/degree';
import { DomainError, notFound } from '../../errors';
import { newId, type RepoContext } from './context';

interface BlockRow {
  id: string;
  date: string;
  start_min: number;
  end_min: number;
  goal_id: GoalId;
  kind: string;
  title: string;
  pinned: number;
  done: number;
}

const toBlock = (r: BlockRow): PlanBlock => ({
  id: r.id,
  date: r.date,
  start: r.start_min,
  end: r.end_min,
  goalId: r.goal_id,
  kind: r.kind,
  title: r.title,
  pinned: r.pinned === 1,
  done: r.done === 1,
});

export function listPlanBlocks(ctx: RepoContext, from: string, to: string): PlanBlock[] {
  return ctx.db
    .prepare<[string, string], BlockRow>(
      'SELECT * FROM plan_blocks WHERE date BETWEEN ? AND ? ORDER BY date, start_min',
    )
    .all(from, to)
    .map(toBlock);
}

export function getPlanBlock(ctx: RepoContext, id: string): PlanBlock {
  const row = ctx.db.prepare<[string], BlockRow>('SELECT * FROM plan_blocks WHERE id = ?').get(id);
  if (!row) throw notFound('Plan block', id);
  return toBlock(row);
}

export function createPlanBlock(
  ctx: RepoContext,
  input: {
    date: string;
    start: number;
    end: number;
    goalId: GoalId;
    kind: string;
    title: string;
    pinned: boolean;
  },
): PlanBlock {
  if (input.end <= input.start)
    throw new DomainError('CONFLICT', 'A block must end after it starts.');
  const id = newId();
  const now = ctx.clock.nowIso();
  ctx.db
    .prepare(
      `INSERT INTO plan_blocks (id, date, start_min, end_min, goal_id, kind, title, pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.date,
      input.start,
      input.end,
      input.goalId,
      input.kind,
      input.title,
      input.pinned ? 1 : 0,
      now,
      now,
    );
  return getPlanBlock(ctx, id);
}

export function updatePlanBlock(
  ctx: RepoContext,
  id: string,
  patch: Partial<Pick<PlanBlock, 'date' | 'start' | 'end' | 'title' | 'pinned' | 'done'>>,
): PlanBlock {
  const next = { ...getPlanBlock(ctx, id), ...patch };
  if (next.end <= next.start)
    throw new DomainError('CONFLICT', 'A block must end after it starts.');
  ctx.db
    .prepare(
      'UPDATE plan_blocks SET date = ?, start_min = ?, end_min = ?, title = ?, pinned = ?, done = ?, updated_at = ? WHERE id = ?',
    )
    .run(
      next.date,
      next.start,
      next.end,
      next.title,
      next.pinned ? 1 : 0,
      next.done ? 1 : 0,
      ctx.clock.nowIso(),
      id,
    );
  return getPlanBlock(ctx, id);
}

export function deletePlanBlock(ctx: RepoContext, id: string): void {
  if (ctx.db.prepare('DELETE FROM plan_blocks WHERE id = ?').run(id).changes === 0)
    throw notFound('Plan block', id);
}
