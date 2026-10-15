import { describe, expect, it } from 'vitest';
import { dayTotals, formatQuantity, shoppingList, type PlanFood } from './mealPlan';

const foods = new Map<string, PlanFood>([
  [
    'chicken',
    {
      id: 'chicken',
      name: 'Chicken & rice',
      calories: 650,
      protein: 55,
      ingredients: '200 g chicken breast\n0.125 kg rice\n1 tbsp olive oil\nsalt',
    },
  ],
  [
    'oats',
    {
      id: 'oats',
      name: 'Oats',
      calories: 380,
      protein: 21,
      ingredients: '60 g oats\n300 ml milk\n0.2 l milk',
    },
  ],
]);

describe('meal plan', () => {
  it('totals each day', () => {
    const totals = dayTotals(
      [
        { date: '2026-10-15', foodId: 'chicken', servings: 2 },
        { date: '2026-10-15', foodId: 'oats', servings: 1 },
        { date: '2026-10-16', foodId: 'ghost', servings: 1 },
      ],
      foods,
    );
    expect(totals.get('2026-10-15')).toEqual({ calories: 1680, protein: 131 });
    expect(totals.has('2026-10-16')).toBe(false);
  });

  it('aggregates a shopping list across servings and normalises units', () => {
    const list = shoppingList(
      [
        { date: '2026-10-15', foodId: 'chicken', servings: 2 },
        { date: '2026-10-16', foodId: 'chicken', servings: 3 },
        { date: '2026-10-16', foodId: 'oats', servings: 1 },
      ],
      foods,
    );
    const byName = Object.fromEntries(list.map((i) => [i.name, i]));
    expect(byName['chicken breast']).toMatchObject({ quantity: 1000, unit: 'g' });
    expect(formatQuantity(byName['chicken breast']!)).toBe('1 kg');
    expect(byName.rice).toMatchObject({ quantity: 625, unit: 'g' });
    expect(byName.milk).toMatchObject({ quantity: 500, unit: 'ml' });
    expect(byName['olive oil']).toMatchObject({ quantity: 5, unit: 'tbsp' });
    expect(byName.salt).toMatchObject({ quantity: null, count: 5 });
    expect(formatQuantity(byName.salt!)).toBe('×5');
  });
});
