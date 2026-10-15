/**
 * UK honours classification from module marks.
 *
 *   module mark    = Σ(weight × grade) ÷ Σ weight            over its assessments
 *   level average  = Σ(credits × module mark) ÷ Σ credits     over a level's modules
 *   final average  = Σ(level weight × level average) ÷ Σ level weights
 *
 * Level weights and boundaries are editable defaults (L5 : L6 = 1 : 2, L4 not counted;
 * First ≥ 70, 2:1 ≥ 60, 2:2 ≥ 50, Third ≥ 40). Universities differ — Arden's rules
 * should be checked and entered in Settings.
 *
 * Because the final average is linear in every grade, the mark needed on everything
 * still ungraded to reach a boundary has an exact closed form (see `requiredMark`).
 * Credits not yet entered for a level (expected 120) count as ungraded work so the
 * answer is honest early in the degree.
 */
export type Level = 4 | 5 | 6;

export interface ClassificationModule {
  id: string;
  level: Level;
  credits: number;
  assessments: { id: string; weight: number; grade: number | null }[];
}

export interface ClassificationRules {
  levelWeights: Record<Level, number>;
  boundaries: { first: number; upperSecond: number; lowerSecond: number; third: number };
  creditsPerLevel: number;
}

export const DEFAULT_RULES: ClassificationRules = {
  levelWeights: { 4: 0, 5: 1, 6: 2 },
  boundaries: { first: 70, upperSecond: 60, lowerSecond: 50, third: 40 },
  creditsPerLevel: 120,
};

export type ClassBand = 'First' | '2:1' | '2:2' | 'Third' | 'Below third';

/**
 * The class for an average. A tiny tolerance absorbs floating-point error (an exact
 * 70 computed as 69.99999999 is a First); no other rounding is applied — whether
 * 69.5 rounds up is a university rule, not ours.
 */
export function bandOf(mark: number, b: ClassificationRules['boundaries']): ClassBand {
  const m = mark + 1e-9;
  if (m >= b.first) return 'First';
  if (m >= b.upperSecond) return '2:1';
  if (m >= b.lowerSecond) return '2:2';
  if (m >= b.third) return 'Third';
  return 'Below third';
}

/** Mark of a module from its graded assessments (null if none are graded). */
export function moduleMark(module: Pick<ClassificationModule, 'assessments'>): {
  mark: number | null;
  gradedWeight: number;
  totalWeight: number;
} {
  let num = 0;
  let graded = 0;
  let total = 0;
  for (const a of module.assessments) {
    total += a.weight;
    if (a.grade !== null) {
      num += a.weight * a.grade;
      graded += a.weight;
    }
  }
  return { mark: graded > 0 ? num / graded : null, gradedWeight: graded, totalWeight: total };
}

interface Term {
  /** Contribution of this item to the final average per mark point. */
  coefficient: number;
  grade: number | null;
  assessmentId: string | null;
}

/**
 * Decomposes the final average into one linear term per assessment (plus placeholders
 * for modules without assessments and for credits not yet entered).
 */
export function linearTerms(
  modules: readonly ClassificationModule[],
  rules: ClassificationRules,
): Term[] {
  const counted = ([4, 5, 6] as Level[]).filter((l) => rules.levelWeights[l] > 0);
  const weightSum = counted.reduce((s, l) => s + rules.levelWeights[l], 0);
  if (weightSum === 0) return [];
  const terms: Term[] = [];
  for (const level of counted) {
    const levelShare = rules.levelWeights[level] / weightSum;
    const mods = modules.filter((m) => m.level === level);
    const entered = mods.reduce((s, m) => s + m.credits, 0);
    const levelCredits = Math.max(entered, rules.creditsPerLevel);
    for (const m of mods) {
      const moduleShare = levelShare * (m.credits / levelCredits);
      const totalWeight = m.assessments.reduce((s, a) => s + a.weight, 0);
      if (m.assessments.length === 0 || totalWeight <= 0) {
        terms.push({ coefficient: moduleShare, grade: null, assessmentId: null });
        continue;
      }
      for (const a of m.assessments) {
        terms.push({
          coefficient: moduleShare * (a.weight / totalWeight),
          grade: a.grade,
          assessmentId: a.id,
        });
      }
    }
    if (entered < levelCredits) {
      terms.push({
        coefficient: levelShare * ((levelCredits - entered) / levelCredits),
        grade: null,
        assessmentId: null,
      });
    }
  }
  return terms;
}

export interface Projection {
  /** Average of graded work only, weighted as it would count (null if nothing graded). */
  projected: number | null;
  band: ClassBand | null;
  /** Share of the final average already determined by graded work (0–1). */
  coverage: number;
  /** Points of the final average already banked. */
  banked: number;
}

export function project(
  modules: readonly ClassificationModule[],
  rules: ClassificationRules,
): Projection {
  const terms = linearTerms(modules, rules);
  const graded = terms.filter((t) => t.grade !== null);
  const coverage = graded.reduce((s, t) => s + t.coefficient, 0);
  const banked = graded.reduce((s, t) => s + t.coefficient * (t.grade ?? 0), 0);
  const projected = coverage > 0 ? banked / coverage : null;
  return {
    projected,
    band: projected === null ? null : bandOf(projected, rules.boundaries),
    coverage,
    banked,
  };
}

export type Requirement =
  | { status: 'secured' }
  | { status: 'achievable'; mark: number }
  | { status: 'out-of-reach'; mark: number }
  | { status: 'not-counting' };

/**
 * The uniform mark needed on all remaining (ungraded) counted work to finish on or
 * above `target`:  x = (target − banked) ÷ remaining coefficient.
 */
export function requiredMark(
  modules: readonly ClassificationModule[],
  rules: ClassificationRules,
  target: number,
): Requirement {
  const terms = linearTerms(modules, rules);
  if (terms.length === 0) return { status: 'not-counting' };
  const banked = terms
    .filter((t) => t.grade !== null)
    .reduce((s, t) => s + t.coefficient * (t.grade ?? 0), 0);
  const remaining = terms.filter((t) => t.grade === null).reduce((s, t) => s + t.coefficient, 0);
  if (remaining <= 1e-12)
    return banked >= target - 1e-9
      ? { status: 'secured' }
      : { status: 'out-of-reach', mark: Number.POSITIVE_INFINITY };
  const x = (target - banked) / remaining;
  if (x <= 0) return { status: 'secured' };
  if (x > 100) return { status: 'out-of-reach', mark: x };
  return { status: 'achievable', mark: x };
}

/** Applies hypothetical grades (assessment id → grade) for "what if" exploration. */
export function withWhatIf(
  modules: readonly ClassificationModule[],
  hypothetical: ReadonlyMap<string, number>,
): ClassificationModule[] {
  return modules.map((m) => ({
    ...m,
    assessments: m.assessments.map((a) =>
      a.grade === null && hypothetical.has(a.id)
        ? { ...a, grade: hypothetical.get(a.id) ?? null }
        : a,
    ),
  }));
}
