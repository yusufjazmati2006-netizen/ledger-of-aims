/**
 * Meal-prep helpers: daily totals of a plan and an aggregated shopping list.
 *
 * Ingredients are free text, one per line. Lines that start with a quantity and a
 * unit ("200 g chicken breast", "2 eggs", "1.5 kg rice") are summed by name and
 * unit; anything else is listed as written with a count.
 */
export interface PlanFood {
  id: string;
  name: string;
  calories: number;
  protein: number;
  ingredients: string;
}

export interface PlanEntry {
  date: string;
  foodId: string;
  servings: number;
}

export function dayTotals(entries: readonly PlanEntry[], foods: ReadonlyMap<string, PlanFood>) {
  const totals = new Map<string, { calories: number; protein: number }>();
  for (const e of entries) {
    const food = foods.get(e.foodId);
    if (!food) continue;
    const t = totals.get(e.date) ?? { calories: 0, protein: 0 };
    t.calories += food.calories * e.servings;
    t.protein += food.protein * e.servings;
    totals.set(e.date, t);
  }
  return totals;
}

export interface ShoppingItem {
  name: string;
  quantity: number | null;
  unit: string;
  /** How many planned servings call for this line (for unparsed lines). */
  count: number;
}

const UNITS = [
  'kg',
  'g',
  'ml',
  'l',
  'tbsp',
  'tsp',
  'cup',
  'cups',
  'tin',
  'tins',
  'can',
  'cans',
  'scoop',
  'scoops',
  'slice',
  'slices',
  'x',
];
const LINE_RE = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${UNITS.join('|')})?\\s+(.+)$`, 'i');

export function shoppingList(
  entries: readonly PlanEntry[],
  foods: ReadonlyMap<string, PlanFood>,
): ShoppingItem[] {
  const items = new Map<string, ShoppingItem>();
  for (const e of entries) {
    const food = foods.get(e.foodId);
    if (!food) continue;
    for (const raw of food.ingredients.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const m = LINE_RE.exec(line);
      if (m) {
        const qty = Number((m[1] ?? '0').replace(',', '.')) * e.servings;
        let unit = (m[2] ?? '').toLowerCase();
        let quantity = qty;
        // Normalise kg → g and l → ml so the same ingredient adds up.
        if (unit === 'kg') {
          unit = 'g';
          quantity = qty * 1000;
        } else if (unit === 'l') {
          unit = 'ml';
          quantity = qty * 1000;
        }
        const name = (m[3] ?? '').trim().toLowerCase();
        const key = `${name}|${unit}`;
        const item = items.get(key) ?? { name, quantity: 0, unit, count: 0 };
        item.quantity = (item.quantity ?? 0) + quantity;
        item.count += e.servings;
        items.set(key, item);
      } else {
        const key = `${line.toLowerCase()}|`;
        const item = items.get(key) ?? { name: line, quantity: null, unit: '', count: 0 };
        item.count += e.servings;
        items.set(key, item);
      }
    }
  }
  return [...items.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function formatQuantity(item: ShoppingItem): string {
  if (item.quantity === null) return item.count === 1 ? '' : `×${round(item.count)}`;
  if (item.unit === 'g' && item.quantity >= 1000) return `${round(item.quantity / 1000)} kg`;
  if (item.unit === 'ml' && item.quantity >= 1000) return `${round(item.quantity / 1000)} l`;
  return `${round(item.quantity)}${item.unit && item.unit !== 'x' ? ` ${item.unit}` : ''}`;
}

const round = (v: number) => Math.round(v * 10) / 10;
