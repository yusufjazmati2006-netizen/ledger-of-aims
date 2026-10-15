/**
 * Double progression for strength training, and personal records.
 *
 * Each exercise has a rep range (e.g. 6–10). Keep the same load and add reps until
 * every working set reaches the top of the range; then add the exercise's load
 * increment and start again at the bottom. Two sessions in a row below the range
 * suggest a 10% deload.
 */
export interface ExerciseRule {
  repMin: number;
  repMax: number;
  setsTarget: number;
  incrementKg: number;
}

export interface LoggedSet {
  reps: number;
  loadKg: number;
}

export interface Session {
  date: string;
  sets: LoggedSet[];
}

export type SuggestionKind = 'start' | 'add-reps' | 'add-load' | 'deload';

export interface Suggestion {
  kind: SuggestionKind;
  loadKg: number | null;
  targetReps: number[];
  reason: string;
}

const roundTo = (value: number, step: number) =>
  step > 0 ? Math.round(value / step) * step : value;

/** The working sets of a session: those at its heaviest load. */
export function workingSets(session: Session): LoggedSet[] {
  const top = Math.max(...session.sets.map((s) => s.loadKg));
  return session.sets.filter((s) => s.loadKg === top);
}

export function suggestNext(rule: ExerciseRule, history: readonly Session[]): Suggestion {
  const sessions = history.filter((s) => s.sets.length > 0);
  const last = sessions[sessions.length - 1];
  if (!last) {
    return {
      kind: 'start',
      loadKg: null,
      targetReps: Array.from({ length: rule.setsTarget }, () => rule.repMax - 2),
      reason: `First session: choose a load you could lift for about ${rule.repMax - 1} reps, and stop at ${rule.repMax - 2}.`,
    };
  }
  const work = workingSets(last);
  const load = work[0]?.loadKg ?? 0;
  const reps = work.map((s) => s.reps);
  while (reps.length < rule.setsTarget) reps.push(Math.min(...reps));

  // Two consecutive sessions at this load with a set under the range → deload.
  const prev = sessions[sessions.length - 2];
  const below = (s: Session) => workingSets(s).some((x) => x.reps < rule.repMin);
  if (prev && below(last) && below(prev) && (workingSets(prev)[0]?.loadKg ?? -1) === load) {
    const deloaded = roundTo(load * 0.9, rule.incrementKg || 0.5);
    return {
      kind: 'deload',
      loadKg: deloaded,
      targetReps: Array.from({ length: rule.setsTarget }, () => rule.repMax - 1),
      reason: `Two sessions below ${rule.repMin} reps at ${load} kg — drop 10% to ${deloaded} kg and rebuild.`,
    };
  }

  if (work.length >= rule.setsTarget && work.every((s) => s.reps >= rule.repMax)) {
    const next = load + rule.incrementKg;
    return {
      kind: 'add-load',
      loadKg: next,
      targetReps: Array.from({ length: rule.setsTarget }, () => rule.repMin),
      reason: `All sets reached ${rule.repMax} reps at ${load} kg — add ${rule.incrementKg} kg.`,
    };
  }

  // Add one rep to the weakest set (never beyond the top of the range).
  const target = reps.slice(0, rule.setsTarget).map((r) => Math.max(r, rule.repMin));
  const weakest = target.indexOf(Math.min(...target));
  target[weakest] = Math.min(rule.repMax, (target[weakest] ?? rule.repMin) + 1);
  return {
    kind: 'add-reps',
    loadKg: load,
    targetReps: target,
    reason: `Stay at ${load} kg and add a rep to your weakest set; increase the load once every set reaches ${rule.repMax}.`,
  };
}

/** Epley estimate of a one-rep maximum: load × (1 + reps / 30). */
export function estimatedOneRepMax(loadKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return loadKg;
  return loadKg * (1 + reps / 30);
}

export interface PersonalRecords {
  bestE1rm: { value: number; loadKg: number; reps: number; date: string } | null;
  heaviest: { loadKg: number; reps: number; date: string } | null;
  bestVolume: { value: number; date: string } | null;
}

export function personalRecords(history: readonly Session[]): PersonalRecords {
  let bestE1rm: PersonalRecords['bestE1rm'] = null;
  let heaviest: PersonalRecords['heaviest'] = null;
  let bestVolume: PersonalRecords['bestVolume'] = null;
  for (const session of history) {
    let volume = 0;
    for (const s of session.sets) {
      volume += s.loadKg * s.reps;
      const e = estimatedOneRepMax(s.loadKg, s.reps);
      if (!bestE1rm || e > bestE1rm.value)
        bestE1rm = { value: e, loadKg: s.loadKg, reps: s.reps, date: session.date };
      if (
        !heaviest ||
        s.loadKg > heaviest.loadKg ||
        (s.loadKg === heaviest.loadKg && s.reps > heaviest.reps)
      ) {
        heaviest = { loadKg: s.loadKg, reps: s.reps, date: session.date };
      }
    }
    if (!bestVolume || volume > bestVolume.value)
      bestVolume = { value: volume, date: session.date };
  }
  return { bestE1rm, heaviest, bestVolume };
}

/** True when this set beats every earlier set's estimated one-rep max. */
export function isPersonalRecord(set: LoggedSet, earlier: readonly Session[]): boolean {
  const best = personalRecords(earlier).bestE1rm?.value ?? 0;
  return set.reps > 0 && estimatedOneRepMax(set.loadKg, set.reps) > best + 1e-9;
}
