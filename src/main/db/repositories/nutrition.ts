import type {
  Food,
  FoodEntry,
  MealPlanEntry,
  MealSlot,
  PrepSession,
} from '@shared/schemas/physique';
import { notFound } from '../../errors';
import { newId, type RepoContext } from './context';

interface FoodRow {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  serving: string;
  ingredients: string;
  favourite: number;
  sort_order: number;
  archived: number;
}

const toFood = (r: FoodRow): Food => ({
  id: r.id,
  name: r.name,
  calories: r.calories,
  protein: r.protein_g,
  serving: r.serving,
  ingredients: r.ingredients,
  favourite: r.favourite === 1,
  sortOrder: r.sort_order,
  archived: r.archived === 1,
});

export type FoodInput = Pick<
  Food,
  'name' | 'calories' | 'protein' | 'serving' | 'ingredients' | 'favourite'
>;

export function listFoods(ctx: RepoContext): Food[] {
  return ctx.db
    .prepare<[], FoodRow>('SELECT * FROM foods ORDER BY archived, sort_order, name')
    .all()
    .map(toFood);
}

export function getFood(ctx: RepoContext, id: string): Food {
  const row = ctx.db.prepare<[string], FoodRow>('SELECT * FROM foods WHERE id = ?').get(id);
  if (!row) throw notFound('Food', id);
  return toFood(row);
}

export function createFood(ctx: RepoContext, input: FoodInput): Food {
  const id = newId();
  const now = ctx.clock.nowIso();
  const order =
    ctx.db.prepare<[], { n: number | null }>('SELECT MAX(sort_order) + 1 AS n FROM foods').get()
      ?.n ?? 0;
  ctx.db
    .prepare(
      `INSERT INTO foods (id, name, calories, protein_g, serving, ingredients, favourite, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.name,
      input.calories,
      input.protein,
      input.serving,
      input.ingredients,
      input.favourite ? 1 : 0,
      order,
      now,
      now,
    );
  return getFood(ctx, id);
}

export function updateFood(
  ctx: RepoContext,
  id: string,
  patch: Partial<FoodInput & { archived: boolean }>,
): Food {
  const next = { ...getFood(ctx, id), ...patch };
  ctx.db
    .prepare(
      `UPDATE foods SET name = ?, calories = ?, protein_g = ?, serving = ?, ingredients = ?, favourite = ?, archived = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      next.name,
      next.calories,
      next.protein,
      next.serving,
      next.ingredients,
      next.favourite ? 1 : 0,
      next.archived ? 1 : 0,
      ctx.clock.nowIso(),
      id,
    );
  return getFood(ctx, id);
}

interface EntryRow {
  id: string;
  date: string;
  food_id: string | null;
  name: string;
  calories: number;
  protein_g: number;
  servings: number;
}

const toEntry = (r: EntryRow): FoodEntry => ({
  id: r.id,
  date: r.date,
  foodId: r.food_id,
  name: r.name,
  calories: r.calories,
  protein: r.protein_g,
  servings: r.servings,
});

export function listFoodEntries(ctx: RepoContext, from: string, to: string): FoodEntry[] {
  return ctx.db
    .prepare<[string, string], EntryRow>(
      'SELECT id, date, food_id, name, calories, protein_g, servings FROM food_entries WHERE date BETWEEN ? AND ? ORDER BY date, created_at',
    )
    .all(from, to)
    .map(toEntry);
}

/**
 * Logs food. Entries copy the food's name and values at the time of logging, so
 * editing a favourite later never rewrites history.
 */
export function logFood(
  ctx: RepoContext,
  input: { date: string; servings: number } & (
    { foodId: string } | { name: string; calories: number; protein: number }
  ),
): FoodEntry {
  const source = 'foodId' in input ? getFood(ctx, input.foodId) : null;
  const id = newId();
  ctx.db
    .prepare(
      'INSERT INTO food_entries (id, date, food_id, name, calories, protein_g, servings, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      input.date,
      source?.id ?? null,
      source?.name ?? ('name' in input ? input.name : ''),
      source?.calories ?? ('calories' in input ? input.calories : 0),
      source?.protein ?? ('protein' in input ? input.protein : 0),
      input.servings,
      ctx.clock.nowIso(),
    );
  return toEntry(
    ctx.db
      .prepare<[string], EntryRow>('SELECT * FROM food_entries WHERE id = ?')
      .get(id) as EntryRow,
  );
}

export function deleteFoodEntry(ctx: RepoContext, id: string): void {
  if (ctx.db.prepare('DELETE FROM food_entries WHERE id = ?').run(id).changes === 0)
    throw notFound('Entry', id);
}

interface PlanRow {
  id: string;
  date: string;
  slot: MealSlot;
  food_id: string;
  servings: number;
}

const toPlan = (r: PlanRow): MealPlanEntry => ({
  id: r.id,
  date: r.date,
  slot: r.slot,
  foodId: r.food_id,
  servings: r.servings,
});

export function listMealPlan(ctx: RepoContext, from: string, to: string): MealPlanEntry[] {
  return ctx.db
    .prepare<[string, string], PlanRow>(
      "SELECT id, date, slot, food_id, servings FROM meal_plan_entries WHERE date BETWEEN ? AND ? ORDER BY date, CASE slot WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 1 WHEN 'dinner' THEN 2 ELSE 3 END, created_at",
    )
    .all(from, to)
    .map(toPlan);
}

export function addMealPlanEntry(
  ctx: RepoContext,
  input: { date: string; slot: MealSlot; foodId: string; servings: number },
): MealPlanEntry {
  getFood(ctx, input.foodId);
  const id = newId();
  ctx.db
    .prepare(
      'INSERT INTO meal_plan_entries (id, date, slot, food_id, servings, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(id, input.date, input.slot, input.foodId, input.servings, ctx.clock.nowIso());
  return toPlan(
    ctx.db
      .prepare<[string], PlanRow>('SELECT * FROM meal_plan_entries WHERE id = ?')
      .get(id) as PlanRow,
  );
}

export function removeMealPlanEntry(ctx: RepoContext, id: string): void {
  if (ctx.db.prepare('DELETE FROM meal_plan_entries WHERE id = ?').run(id).changes === 0)
    throw notFound('Plan entry', id);
}

/** Replaces each target day's plan with a copy of the source day's. */
export function copyMealPlanDay(ctx: RepoContext, from: string, to: string[]): MealPlanEntry[] {
  const source = listMealPlan(ctx, from, from);
  ctx.db.transaction(() => {
    for (const date of to) {
      ctx.db.prepare('DELETE FROM meal_plan_entries WHERE date = ?').run(date);
      for (const e of source)
        addMealPlanEntry(ctx, { date, slot: e.slot, foodId: e.foodId, servings: e.servings });
    }
  })();
  return listMealPlan(ctx, [from, ...to].sort()[0] ?? from, [from, ...to].sort().at(-1) ?? from);
}

export function logPlannedDay(ctx: RepoContext, date: string): FoodEntry[] {
  const plan = listMealPlan(ctx, date, date);
  return ctx.db.transaction(() =>
    plan.map((e) => logFood(ctx, { date, foodId: e.foodId, servings: e.servings })),
  )();
}

interface PrepRow {
  id: string;
  date: string;
  notes: string;
  done: number;
}

export function listPrepSessions(ctx: RepoContext, from: string, to: string): PrepSession[] {
  return ctx.db
    .prepare<[string, string], PrepRow>(
      'SELECT id, date, notes, done FROM prep_sessions WHERE date BETWEEN ? AND ? ORDER BY date',
    )
    .all(from, to)
    .map((r) => ({ id: r.id, date: r.date, notes: r.notes, done: r.done === 1 }));
}

export function savePrepSession(
  ctx: RepoContext,
  input: { id?: string; date: string; notes: string; done: boolean },
): PrepSession {
  const id = input.id ?? newId();
  ctx.db
    .prepare(
      `INSERT INTO prep_sessions (id, date, notes, done, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET date = excluded.date, notes = excluded.notes, done = excluded.done`,
    )
    .run(id, input.date, input.notes, input.done ? 1 : 0, ctx.clock.nowIso());
  return { id, date: input.date, notes: input.notes, done: input.done };
}

export function deletePrepSession(ctx: RepoContext, id: string): void {
  if (ctx.db.prepare('DELETE FROM prep_sessions WHERE id = ?').run(id).changes === 0)
    throw notFound('Prep session', id);
}
