import {
  SEED_EXERCISES,
  SEED_FOODS,
  SEED_GOALS,
  SEED_MILESTONES,
  SEED_SHIFT_TYPES,
} from '@shared/seed/defaults';
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

    if (isEmpty('exercises')) {
      const insert = db.prepare(
        `INSERT INTO exercises (id, name, muscle_group, rep_min, rep_max, sets_target, increment_kg, bodyweight, in_program, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      SEED_EXERCISES.forEach((e, i) => {
        insert.run(
          newId(),
          e.name,
          e.muscleGroup,
          e.repMin,
          e.repMax,
          e.setsTarget,
          e.incrementKg,
          e.bodyweight ? 1 : 0,
          e.inProgram ? 1 : 0,
          i,
          now,
          now,
        );
      });
      seeded.push('exercises');
    }

    if (isEmpty('degree_years')) {
      const insert = db.prepare(
        'INSERT INTO degree_years (id, level, label, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      );
      [4, 5, 6].forEach((level, i) => {
        insert.run(newId(), level, `Year ${i + 1} (Level ${level})`, i, now, now);
      });
      seeded.push('degree_years');
    }

    if (isEmpty('foods')) {
      const insert = db.prepare(
        `INSERT INTO foods (id, name, calories, protein_g, serving, ingredients, favourite, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      );
      SEED_FOODS.forEach((f, i) => {
        insert.run(newId(), f.name, f.calories, f.protein, f.serving, f.ingredients, i, now, now);
      });
      seeded.push('foods');
    }
  })();

  return { seeded };
}
