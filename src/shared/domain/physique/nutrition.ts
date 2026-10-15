/**
 * Calorie and protein targets, and daily adherence.
 *
 * Maintenance uses the Mifflin–St Jeor equation when height, age and sex are known:
 *   BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age + (5 for men, −161 for women)
 *   maintenance = BMR × activity factor
 * otherwise a common bodyweight estimate for active people: 33 kcal per kg.
 * Target calories = maintenance + chosen surplus; protein = g/kg × bodyweight.
 */
export type Sex = 'male' | 'female';

export interface NutritionProfile {
  weightKg: number;
  heightCm: number | null;
  age: number | null;
  sex: Sex | null;
  activityFactor: number;
  surplusKcal: number;
  proteinPerKg: number;
  calorieOverride?: number | null;
  proteinOverride?: number | null;
}

export interface NutritionTargets {
  calories: number;
  protein: number;
  maintenance: number;
  method: 'mifflin-st-jeor' | 'bodyweight' | 'override';
  /** Human-readable working, with the person's numbers substituted. */
  formula: string[];
}

const round = (v: number, to = 1) => Math.round(v / to) * to;

export function nutritionTargets(p: NutritionProfile): NutritionTargets {
  const formula: string[] = [];
  let maintenance: number;
  let method: NutritionTargets['method'];
  if (p.heightCm !== null && p.age !== null && p.sex !== null) {
    const sexTerm = p.sex === 'male' ? 5 : -161;
    const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + sexTerm;
    maintenance = bmr * p.activityFactor;
    method = 'mifflin-st-jeor';
    formula.push(
      `BMR = 10 × ${p.weightKg.toFixed(1)} + 6.25 × ${p.heightCm} − 5 × ${p.age} ${sexTerm >= 0 ? '+' : '−'} ${Math.abs(sexTerm)} = ${round(bmr)} kcal`,
      `Maintenance = ${round(bmr)} × ${p.activityFactor} (activity) = ${round(maintenance, 10)} kcal`,
    );
  } else {
    maintenance = p.weightKg * 33;
    method = 'bodyweight';
    formula.push(
      `Maintenance ≈ ${p.weightKg.toFixed(1)} kg × 33 kcal = ${round(maintenance, 10)} kcal (add height, age and sex for Mifflin–St Jeor)`,
    );
  }
  let calories = round(maintenance + p.surplusKcal, 10);
  formula.push(`Target = ${round(maintenance, 10)} + ${p.surplusKcal} surplus = ${calories} kcal`);
  let protein = round(p.weightKg * p.proteinPerKg);
  formula.push(`Protein = ${p.weightKg.toFixed(1)} kg × ${p.proteinPerKg} g/kg = ${protein} g`);
  if (p.calorieOverride) {
    calories = p.calorieOverride;
    method = 'override';
    formula.push(`Calories set manually to ${calories} kcal`);
  }
  if (p.proteinOverride) {
    protein = p.proteinOverride;
    formula.push(`Protein set manually to ${protein} g`);
  }
  return { calories, protein, maintenance: round(maintenance, 10), method, formula };
}

export interface Intake {
  calories: number;
  protein: number;
}

/**
 * Daily adherence, 0–100: half for calories, half for protein.
 *   calories: full marks within ±10% of target, falling linearly to 0 at ±30%
 *   protein:  full marks at ≥ 90% of target, proportional below that
 */
export function adherenceScore(
  intake: Intake,
  targets: { calories: number; protein: number },
): number {
  if (targets.calories <= 0 || targets.protein <= 0) return 0;
  const deviation = Math.abs(intake.calories - targets.calories) / targets.calories;
  const calorieScore =
    deviation <= 0.1 ? 50 : deviation >= 0.3 ? 0 : 50 * (1 - (deviation - 0.1) / 0.2);
  const proteinRatio = intake.protein / (targets.protein * 0.9);
  const proteinScore = 50 * Math.min(1, Math.max(0, proteinRatio));
  return Math.round(calorieScore + proteinScore);
}

export function sumIntake(
  entries: readonly { calories: number; protein: number; servings: number }[],
): Intake {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories * e.servings,
      protein: acc.protein + e.protein * e.servings,
    }),
    { calories: 0, protein: 0 },
  );
}

export function ageOn(birthYear: number | null, year: number): number | null {
  return birthYear === null ? null : year - birthYear;
}
