import type { GoalId } from '@shared/schemas/common';
import type { Milestone, MilestoneKind } from '@shared/schemas/core';
import { DomainError, notFound } from '../../errors';
import { newId, type RepoContext } from './context';

interface MilestoneRow {
  id: string;
  goal_id: GoalId;
  title: string;
  target_date: string;
  target_value: number | null;
  unit: string | null;
  kind: MilestoneKind;
  sort_order: number;
  completed_at: string | null;
  notes: string;
}

const toMilestone = (r: MilestoneRow): Milestone => ({
  id: r.id,
  goalId: r.goal_id,
  title: r.title,
  targetDate: r.target_date,
  targetValue: r.target_value,
  unit: r.unit,
  kind: r.kind,
  sortOrder: r.sort_order,
  completedAt: r.completed_at,
  notes: r.notes,
});

export interface NewMilestone {
  goalId: GoalId;
  title: string;
  targetDate: string;
  targetValue: number | null;
  unit: string | null;
  kind: MilestoneKind;
  notes: string;
}

export function listMilestones(ctx: RepoContext, goalId?: GoalId): Milestone[] {
  const rows = goalId
    ? ctx.db
        .prepare<[string], MilestoneRow>(
          'SELECT * FROM milestones WHERE goal_id = ? ORDER BY sort_order, target_date',
        )
        .all(goalId)
    : ctx.db
        .prepare<[], MilestoneRow>(
          'SELECT * FROM milestones ORDER BY goal_id, sort_order, target_date',
        )
        .all();
  return rows.map(toMilestone);
}

export function getMilestone(ctx: RepoContext, id: string): Milestone {
  const row = ctx.db
    .prepare<[string], MilestoneRow>('SELECT * FROM milestones WHERE id = ?')
    .get(id);
  if (!row) throw notFound('Milestone', id);
  return toMilestone(row);
}

export function createMilestone(ctx: RepoContext, input: NewMilestone): Milestone {
  const id = newId();
  const now = ctx.clock.nowIso();
  const nextOrder =
    ctx.db
      .prepare<[string], { next: number | null }>(
        'SELECT MAX(sort_order) + 1 AS next FROM milestones WHERE goal_id = ?',
      )
      .get(input.goalId)?.next ?? 0;
  ctx.db
    .prepare(
      `INSERT INTO milestones (id, goal_id, title, target_date, target_value, unit, kind, sort_order, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.goalId,
      input.title,
      input.targetDate,
      input.targetValue,
      input.unit,
      input.kind,
      nextOrder,
      input.notes,
      now,
      now,
    );
  return getMilestone(ctx, id);
}

export function updateMilestone(
  ctx: RepoContext,
  id: string,
  patch: Partial<Omit<NewMilestone, 'goalId'>>,
): Milestone {
  const current = getMilestone(ctx, id);
  const next = { ...current, ...patch };
  ctx.db
    .prepare(
      `UPDATE milestones SET title = ?, target_date = ?, target_value = ?, unit = ?, kind = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      next.title,
      next.targetDate,
      next.targetValue,
      next.unit,
      next.kind,
      next.notes,
      ctx.clock.nowIso(),
      id,
    );
  return getMilestone(ctx, id);
}

export function deleteMilestone(ctx: RepoContext, id: string): void {
  const result = ctx.db.prepare('DELETE FROM milestones WHERE id = ?').run(id);
  if (result.changes === 0) throw notFound('Milestone', id);
}

export function reorderMilestones(
  ctx: RepoContext,
  goalId: GoalId,
  orderedIds: string[],
): Milestone[] {
  const existing = listMilestones(ctx, goalId).map((m) => m.id);
  const same =
    existing.length === orderedIds.length &&
    new Set(orderedIds).size === orderedIds.length &&
    orderedIds.every((id) => existing.includes(id));
  if (!same) {
    throw new DomainError('CONFLICT', 'The milestone order does not match the stored milestones.');
  }
  const update = ctx.db.prepare(
    'UPDATE milestones SET sort_order = ?, updated_at = ? WHERE id = ?',
  );
  const now = ctx.clock.nowIso();
  ctx.db.transaction(() => {
    orderedIds.forEach((id, index) => update.run(index, now, id));
  })();
  return listMilestones(ctx, goalId);
}

export function setMilestoneCompleted(ctx: RepoContext, id: string, completed: boolean): Milestone {
  getMilestone(ctx, id);
  const now = ctx.clock.nowIso();
  ctx.db
    .prepare('UPDATE milestones SET completed_at = ?, updated_at = ? WHERE id = ?')
    .run(completed ? now : null, now, id);
  return getMilestone(ctx, id);
}
