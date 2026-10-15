import type { GoalId } from '@shared/schemas/common';
import type { Goal } from '@shared/schemas/core';
import { notFound } from '../../errors';
import type { RepoContext } from './context';

interface GoalRow {
  id: GoalId;
  title: string;
  subtitle: string;
  next_action: string;
  sort_order: number;
}

const toGoal = (r: GoalRow): Goal => ({
  id: r.id,
  title: r.title,
  subtitle: r.subtitle,
  nextAction: r.next_action,
  sortOrder: r.sort_order,
});

export function listGoals(ctx: RepoContext): Goal[] {
  return ctx.db
    .prepare<[], GoalRow>('SELECT * FROM goals ORDER BY sort_order, id')
    .all()
    .map(toGoal);
}

export function getGoal(ctx: RepoContext, id: GoalId): Goal {
  const row = ctx.db.prepare<[string], GoalRow>('SELECT * FROM goals WHERE id = ?').get(id);
  if (!row) throw notFound('Goal', id);
  return toGoal(row);
}

export function updateGoal(
  ctx: RepoContext,
  id: GoalId,
  patch: Partial<Pick<Goal, 'title' | 'subtitle' | 'nextAction'>>,
): Goal {
  const current = getGoal(ctx, id);
  const next = { ...current, ...patch };
  ctx.db
    .prepare(
      'UPDATE goals SET title = ?, subtitle = ?, next_action = ?, updated_at = ? WHERE id = ?',
    )
    .run(next.title, next.subtitle, next.nextAction, ctx.clock.nowIso(), id);
  return getGoal(ctx, id);
}
