/**
 * What the week asks of each goal, in priority order, for `planWeek`:
 *
 *   1. Quran revision, every day (fragile memory comes first);
 *   2. training on its every-other-day rhythm, from the next session due;
 *   3. new Quran pages, every day;
 *   4. study — the weekly target less what is already studied or planned;
 *   5. game — likewise;
 *   6. meal prep on days off.
 */
import { addDays, type LocalDate } from '../time/localDate';
import { trainingStatus } from '../physique/schedule';
import type { Demand } from './weekPlan';

export interface DemandInputs {
  /** Every date in the planning window, in order. */
  dates: readonly LocalDate[];
  today: LocalDate;
  quran: { setUp: boolean; revisionMinutes: number; newMinutes: number };
  training: { lastWorkout: LocalDate | null; restDays: number; minutes: number };
  study: { weeklyMinutes: number; coveredMinutes: number; sessionMinutes: number };
  game: { weeklyMinutes: number; coveredMinutes: number; sessionMinutes: number };
  mealPrep: { perWeek: number; minutes: number; coveredSessions: number };
}

export function trainingDates(
  lastWorkout: LocalDate | null,
  today: LocalDate,
  restDays: number,
  until: LocalDate,
): LocalDate[] {
  const status = trainingStatus(lastWorkout, today, restDays);
  let next = status.kind === 'due' || status.kind === 'overdue' ? today : status.next;
  const out: LocalDate[] = [];
  while (next <= until) {
    out.push(next);
    next = addDays(next, restDays + 1);
  }
  return out;
}

export function buildDemands(i: DemandInputs): Demand[] {
  const upcoming = i.dates.filter((d) => d >= i.today);
  const last = i.dates[i.dates.length - 1] ?? i.today;
  const demands: Demand[] = [];

  if (i.quran.setUp && i.quran.revisionMinutes > 0) {
    demands.push({
      key: 'quran-revision',
      goalId: 'quran',
      kind: 'revision',
      title: 'Quran revision',
      daily: {
        dates: upcoming,
        minutes: i.quran.revisionMinutes,
        minMinutes: Math.min(15, i.quran.revisionMinutes),
      },
      prefer: 'early',
    });
  }

  if (i.training.minutes > 0) {
    const dates = trainingDates(i.training.lastWorkout, i.today, i.training.restDays, last).filter(
      (d) => i.dates.includes(d),
    );
    if (dates.length > 0) {
      demands.push({
        key: 'training',
        goalId: 'physique',
        kind: 'training',
        title: 'Training',
        daily: { dates, minutes: i.training.minutes, minMinutes: Math.min(45, i.training.minutes) },
        prefer: 'late',
      });
    }
  }

  if (i.quran.setUp && i.quran.newMinutes > 0) {
    demands.push({
      key: 'quran-new',
      goalId: 'quran',
      kind: 'learning',
      title: 'New Quran pages',
      daily: {
        dates: upcoming,
        minutes: i.quran.newMinutes,
        minMinutes: Math.min(10, i.quran.newMinutes),
      },
      prefer: 'early',
    });
  }

  const study = Math.max(0, i.study.weeklyMinutes - i.study.coveredMinutes);
  if (study >= 20) {
    demands.push({
      key: 'study',
      goalId: 'degree',
      kind: 'study',
      title: 'Study',
      weekly: {
        minutes: study,
        session: i.study.sessionMinutes,
        minSession: Math.min(30, i.study.sessionMinutes),
        maxPerDay: 2,
      },
      prefer: 'early',
    });
  }

  const game = Math.max(0, i.game.weeklyMinutes - i.game.coveredMinutes);
  if (game >= 20) {
    demands.push({
      key: 'game',
      goalId: 'game',
      kind: 'game',
      title: 'Game development',
      weekly: {
        minutes: game,
        session: i.game.sessionMinutes,
        minSession: Math.min(30, i.game.sessionMinutes),
        maxPerDay: 2,
      },
      prefer: 'late',
    });
  }

  const prepSessions = Math.max(0, i.mealPrep.perWeek - i.mealPrep.coveredSessions);
  if (prepSessions > 0 && i.mealPrep.minutes > 0) {
    demands.push({
      key: 'meal-prep',
      goalId: 'physique',
      kind: 'meal-prep',
      title: 'Meal prep',
      weekly: {
        minutes: prepSessions * i.mealPrep.minutes,
        session: i.mealPrep.minutes,
        minSession: i.mealPrep.minutes,
        maxPerDay: 1,
      },
      offDaysOnly: true,
      prefer: 'early',
    });
  }

  return demands;
}
