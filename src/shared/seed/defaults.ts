import type { GoalId } from '../schemas/common';
import type { MilestoneKind } from '../schemas/core';

/**
 * Seed data for a fresh database, taken from the project brief. Everything here is
 * an editable default; nothing is treated as fixed by the application.
 *
 * Date conventions (see DECISIONS.md):
 * - Brief dates given to the day are used verbatim.
 * - Month-only "by" deadlines (game, degree) use the last day of that month.
 * - Physique checkpoints are annual points on a trajectory starting 15 Oct 2026, so
 *   they are dated on the anniversary (15 Oct).
 */
export const PLAN_START_DATE = '2026-10-15';

export interface SeedGoal {
  id: GoalId;
  title: string;
  subtitle: string;
  nextAction: string;
  sortOrder: number;
}

export const SEED_GOALS: readonly SeedGoal[] = [
  {
    id: 'quran',
    title: 'Quran memorisation',
    subtitle: 'Hifz with steady murajaʿah',
    nextAction: '',
    sortOrder: 0,
  },
  {
    id: 'game',
    title: 'First game on Steam',
    subtitle: 'From zero to a released game',
    nextAction: 'Write down the three engines you are considering and one reason for each.',
    sortOrder: 1,
  },
  {
    id: 'degree',
    title: 'Business management degree',
    subtitle: 'Arden University · three-year honours',
    nextAction: '',
    sortOrder: 2,
  },
  {
    id: 'physique',
    title: 'Physique',
    subtitle: 'A lean, athletic 86 kg',
    nextAction: '',
    sortOrder: 3,
  },
];

export interface SeedMilestone {
  goalId: GoalId;
  title: string;
  targetDate: string;
  targetValue: number | null;
  unit: string | null;
  kind: MilestoneKind;
  notes: string;
}

export const SEED_MILESTONES: readonly SeedMilestone[] = [
  // Goal A — Quran
  m('quran', '20 juz memorised', '2027-03-04', 20, 'juz'),
  m('quran', '25 juz memorised', '2027-07-22', 25, 'juz'),
  m('quran', '30 juz memorised', '2027-12-09', 30, 'juz'),
  // Goal B — Game
  m(
    'game',
    'Engine fundamentals and small practice projects',
    '2027-04-30',
    null,
    null,
    'milestone',
    'Learning path complete and a handful of small clones finished.',
  ),
  m('game', 'First complete playable version', '2028-04-30', null, null),
  m('game', 'Steam store page public', '2028-07-31', null, null),
  m('game', 'Polish and playtesting finished', '2028-10-31', null, null),
  m('game', 'Release', '2028-11-30', null, null),
  m(
    'game',
    'Hard stop',
    '2029-10-31',
    null,
    null,
    'hard-stop',
    'The latest acceptable release date.',
  ),
  // Goal C — Degree
  m(
    'degree',
    'Degree complete (expected)',
    '2029-10-31',
    null,
    null,
    'milestone',
    'Approximate: term dates are unconfirmed. Adjust once Arden publishes them.',
  ),
  // Goal D — Physique
  m('physique', 'Checkpoint: 71.3 kg', '2027-10-15', 71.3, 'kg'),
  m('physique', 'Checkpoint: 76.2 kg', '2028-10-15', 76.2, 'kg'),
  m('physique', 'Checkpoint: 81.1 kg', '2029-10-15', 81.1, 'kg'),
  m('physique', 'Target: 86 kg', '2030-10-15', 86, 'kg'),
];

export interface SeedShiftType {
  id: string;
  label: string;
  start: string | null;
  end: string | null;
  sortOrder: number;
}

export const SEED_SHIFT_TYPES: readonly SeedShiftType[] = [
  { id: 'morning', label: 'Morning', start: '07:30', end: '16:30', sortOrder: 0 },
  { id: 'night', label: 'Night', start: '16:00', end: '01:00', sortOrder: 1 },
  { id: 'off', label: 'Off', start: null, end: null, sortOrder: 2 },
];

function m(
  goalId: GoalId,
  title: string,
  targetDate: string,
  targetValue: number | null,
  unit: string | null,
  kind: MilestoneKind = 'milestone',
  notes = '',
): SeedMilestone {
  return { goalId, title, targetDate, targetValue, unit, kind, notes };
}

export interface SeedExercise {
  name: string;
  muscleGroup: string;
  repMin: number;
  repMax: number;
  setsTarget: number;
  incrementKg: number;
  bodyweight: boolean;
  inProgram: boolean;
}

/**
 * A starter full-body library. The default programme (in_program) is a balanced
 * every-other-day session: squat, press, row, hinge, vertical pull and push, plus two
 * accessories. Edit freely; nothing here is prescriptive.
 */
export const SEED_EXERCISES: readonly SeedExercise[] = [
  ex('Back squat', 'Legs', 6, 10, 3, 2.5, false, true),
  ex('Bench press', 'Chest', 6, 10, 3, 2.5, false, true),
  ex('Barbell row', 'Back', 8, 12, 3, 2.5, false, true),
  ex('Romanian deadlift', 'Hamstrings', 8, 12, 3, 2.5, false, true),
  ex('Overhead press', 'Shoulders', 6, 10, 3, 1.25, false, true),
  ex('Pull-up', 'Back', 6, 12, 3, 1.25, true, true),
  ex('Lateral raise', 'Shoulders', 12, 20, 3, 1, false, true),
  ex('Dumbbell curl', 'Arms', 10, 15, 2, 1, false, true),
  ex('Deadlift', 'Posterior chain', 3, 6, 3, 2.5, false, false),
  ex('Front squat', 'Legs', 6, 10, 3, 2.5, false, false),
  ex('Incline dumbbell press', 'Chest', 8, 12, 3, 2, false, false),
  ex('Dips', 'Chest', 6, 12, 3, 1.25, true, false),
  ex('Chin-up', 'Back', 6, 12, 3, 1.25, true, false),
  ex('Lat pulldown', 'Back', 8, 12, 3, 2.5, false, false),
  ex('Hip thrust', 'Glutes', 8, 12, 3, 5, false, false),
  ex('Leg press', 'Legs', 10, 15, 3, 5, false, false),
  ex('Triceps pushdown', 'Arms', 10, 15, 2, 2.5, false, false),
  ex('Face pull', 'Shoulders', 12, 20, 2, 2.5, false, false),
  ex('Calf raise', 'Calves', 10, 20, 3, 5, false, false),
  ex('Hanging leg raise', 'Core', 8, 15, 3, 0, true, false),
];

function ex(
  name: string,
  muscleGroup: string,
  repMin: number,
  repMax: number,
  setsTarget: number,
  incrementKg: number,
  bodyweight: boolean,
  inProgram: boolean,
): SeedExercise {
  return { name, muscleGroup, repMin, repMax, setsTarget, incrementKg, bodyweight, inProgram };
}

export interface SeedFood {
  name: string;
  calories: number;
  protein: number;
  serving: string;
  ingredients: string;
}

/**
 * Starter favourites so quick-add works on day one. Values are typical approximations
 * — replace them with the figures on your own labels.
 */
export const SEED_FOODS: readonly SeedFood[] = [
  {
    name: 'Chicken, rice & veg',
    calories: 650,
    protein: 55,
    serving: '1 box',
    ingredients: '200 g chicken breast\n125 g rice\n150 g frozen vegetables\n1 tbsp olive oil',
  },
  {
    name: 'Oats with milk',
    calories: 380,
    protein: 21,
    serving: '1 bowl',
    ingredients: '60 g oats\n300 ml semi-skimmed milk',
  },
  {
    name: 'Whey shake',
    calories: 120,
    protein: 24,
    serving: '1 scoop',
    ingredients: '1 scoop whey protein',
  },
  {
    name: 'Greek yoghurt 0%',
    calories: 120,
    protein: 20,
    serving: '200 g',
    ingredients: '200 g greek yoghurt',
  },
  {
    name: 'Three eggs on toast',
    calories: 420,
    protein: 26,
    serving: '1 plate',
    ingredients: '3 eggs\n2 slices wholemeal bread',
  },
  {
    name: 'Beef mince & pasta',
    calories: 720,
    protein: 52,
    serving: '1 box',
    ingredients: '200 g beef mince 5%\n100 g pasta\n150 g tomato passata',
  },
  {
    name: 'Tuna wrap',
    calories: 430,
    protein: 35,
    serving: '1 wrap',
    ingredients: '1 can tuna\n1 tortilla wrap\n1 tbsp light mayonnaise',
  },
  { name: 'Banana', calories: 105, protein: 1, serving: '1 medium', ingredients: '1 banana' },
  {
    name: 'Peanut butter toast',
    calories: 400,
    protein: 15,
    serving: '2 slices',
    ingredients: '2 slices wholemeal bread\n30 g peanut butter',
  },
  {
    name: 'Milk (glass)',
    calories: 125,
    protein: 9,
    serving: '250 ml',
    ingredients: '250 ml semi-skimmed milk',
  },
];
