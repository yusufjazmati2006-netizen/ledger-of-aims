import { describe, expect, it } from 'vitest';
import { adherenceScore, nutritionTargets, sumIntake } from './nutrition';

describe('nutrition targets', () => {
  it('uses Mifflin–St Jeor when height, age and sex are known', () => {
    const t = nutritionTargets({
      weightKg: 66,
      heightCm: 178,
      age: 25,
      sex: 'male',
      activityFactor: 1.55,
      surplusKcal: 250,
      proteinPerKg: 2,
    });
    // BMR = 660 + 1112.5 − 125 + 5 = 1652.5; × 1.55 = 2561.4 → 2560; + 250 = 2810
    expect(t.method).toBe('mifflin-st-jeor');
    expect(t.maintenance).toBe(2560);
    expect(t.calories).toBe(2810);
    expect(t.protein).toBe(132);
    expect(t.formula[0]).toContain('= 1653 kcal');
  });

  it('falls back to 33 kcal per kg', () => {
    const t = nutritionTargets({
      weightKg: 66,
      heightCm: null,
      age: null,
      sex: null,
      activityFactor: 1.55,
      surplusKcal: 250,
      proteinPerKg: 1.8,
    });
    expect(t.method).toBe('bodyweight');
    expect(t.calories).toBe(Math.round((66 * 33 + 250) / 10) * 10);
    expect(t.protein).toBe(119);
  });

  it('honours manual overrides and says so', () => {
    const t = nutritionTargets({
      weightKg: 66,
      heightCm: null,
      age: null,
      sex: null,
      activityFactor: 1.55,
      surplusKcal: 250,
      proteinPerKg: 2,
      calorieOverride: 3000,
      proteinOverride: 150,
    });
    expect(t).toMatchObject({ calories: 3000, protein: 150, method: 'override' });
    expect(t.formula.at(-1)).toContain('manually');
  });
});

describe('adherence', () => {
  const targets = { calories: 2800, protein: 130 };
  it('gives full marks within 10% and enough protein', () => {
    expect(adherenceScore({ calories: 2600, protein: 120 }, targets)).toBe(100);
  });
  it('tapers calories between 10% and 30% off', () => {
    expect(adherenceScore({ calories: 2800 * 0.8, protein: 130 }, targets)).toBe(75);
    expect(adherenceScore({ calories: 2800 * 1.4, protein: 130 }, targets)).toBe(50);
  });
  it('scales protein below 90% of target', () => {
    expect(adherenceScore({ calories: 2800, protein: 130 * 0.45 }, targets)).toBe(75);
    expect(adherenceScore({ calories: 0, protein: 0 }, targets)).toBe(0);
  });
  it('sums servings', () => {
    expect(
      sumIntake([
        { calories: 100, protein: 10, servings: 2 },
        { calories: 50, protein: 1, servings: 0.5 },
      ]),
    ).toEqual({
      calories: 225,
      protein: 20.5,
    });
  });
});
