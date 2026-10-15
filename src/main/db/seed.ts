import { SEED_GOALS, SEED_MILESTONES, SEED_SHIFT_TYPES } from '@shared/seed/defaults';
import { newId, type RepoContext } from './repositories/context';

/**
 * Populates a brand-new database with the brief's goals, milestones and shift
 * definitions. Each block only runs when its table is empty, so seeding is safe to
 * call on every launch and never overwrites the user's edits.
 */
export function seedDatabase(ctx: RepoContext): { seeded: string[] } {
  const { db } = ctx;
  const now = ctx.clock.nowIso();
  const seeded: string[] = [];
  const isEmpty = (table: string) =>
    (db.prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n ?? 0) === 0;

  db.transaction(() => {
    if (isEmpty('goals')) {
      const insert = db.prepare(
        `INSERT INTO goals (id, title, subtitle, next_action, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const g of SEED_GOALS) {
        insert.run(g.id, g.title, g.subtitle, g.nextAction, g.sortOrder, now, now);
      }
      seeded.push('goals');
    }

    if (isEmpty('milestones')) {
      const insert = db.prepare(
        `INSERT INTO milestones (id, goal_id, title, target_date, target_value, unit, kind, sort_order, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const orderByGoal = new Map<string, number>();
      for (const m of SEED_MILESTONES) {
        const order = orderByGoal.get(m.goalId) ?? 0;
        orderByGoal.set(m.goalId, order + 1);
        insert.run(
          newId(),
          m.goalId,
          m.title,
          m.targetDate,
          m.targetValue,
          m.unit,
          m.kind,
          order,
          m.notes,
          now,
          now,
        );
      }
      seeded.push('milestones');
    }

    if (isEmpty('shift_types')) {
      const insert = db.prepare(
        'INSERT INTO shift_types (id, label, start_time, end_time, sort_order) VALUES (?, ?, ?, ?, ?)',
      );
      for (const s of SEED_SHIFT_TYPES) insert.run(s.id, s.label, s.start, s.end, s.sortOrder);
      seeded.push('shift_types');
    }
  })();

  return { seeded };
}
