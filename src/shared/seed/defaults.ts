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
    id: 'physique',
    title: 'Physique',
    subtitle: 'A lean, athletic 86 kg',
    nextAction: '',
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
    id: 'game',
    title: 'First game on Steam',
    subtitle: 'From zero to a released game',
    nextAction: 'Write down the three engines you are considering and one reason for each.',
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
