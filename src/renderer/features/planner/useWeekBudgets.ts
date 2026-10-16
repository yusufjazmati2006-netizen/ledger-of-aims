import { minutesByDay } from '@shared/domain/game/time';
import { buildDemands, type DemandInputs } from '@shared/domain/planner/demands';
import type { Demand } from '@shared/domain/planner/weekPlan';
import { addDays, eachDay, type LocalDate } from '@shared/domain/time/localDate';
import type { PlanBlock } from '@shared/schemas/degree';
import { useSettings, useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { useNow } from '../../lib/useNow';

export interface WeekBudgets {
  ready: boolean;
  blocks: PlanBlock[];
  /** Minutes already logged this week. */
  studyLogged: number;
  gameLogged: number;
  lastWorkout: LocalDate | null;
  /** Demands for a fresh proposal, counting only blocks that a re-plan keeps. */
  demands: (kept: readonly PlanBlock[]) => Demand[];
  targets: { study: number; game: number };
}

/** Kept blocks are those a re-plan never replaces: pinned or finished ones. */
export const isKept = (b: PlanBlock) => b.pinned || b.done;

/**
 * Everything the week planner and Today need to size the week: logged study and game
 * time, the last training session, existing blocks, and the demand builder.
 */
export function useWeekBudgets(weekStart: LocalDate): WeekBudgets {
  const settings = useSettings();
  const today = useToday();
  const now = useNow(60_000);
  const weekEnd = addDays(weekStart, 6);
  const plan = useLedger('plan.list', { from: weekStart, to: weekEnd }, { domains: ['plan'] });
  const study = useLedger('study.list', { from: weekStart, to: weekEnd }, { domains: ['degree'] });
  const time = useLedger('time.list', { from: weekStart, to: weekEnd }, { domains: ['game'] });
  const workouts = useLedger(
    'workouts.list',
    { from: addDays(today, -21), to: today },
    { domains: ['training'] },
  );

  const blocks = plan.data ?? [];
  const studyLogged = (study.data ?? []).reduce((n, s) => n + s.minutes, 0);
  let gameLogged = 0;
  for (const [day, minutes] of minutesByDay(time.data ?? [], now))
    if (day >= weekStart && day <= weekEnd) gameLogged += minutes;
  const lastWorkout =
    [...(workouts.data ?? [])].reverse().find((w) => w.sets.length > 0)?.date ?? null;
  const targets = {
    study: Math.round(settings.degree.studyHoursPerWeek * 60),
    game: Math.round(settings.game.weeklyHoursTarget * 60),
  };

  const demands = (kept: readonly PlanBlock[]) => {
    // Time still to come that is already set aside counts towards the week.
    const reserved = (goal: string, kind?: string) =>
      kept
        .filter(
          (b) => b.goalId === goal && (!kind || b.kind === kind) && !b.done && b.date >= today,
        )
        .reduce((n, b) => n + b.end - b.start, 0);
    const inputs: DemandInputs = {
      dates: eachDay(weekStart, weekEnd),
      today,
      quran: {
        setUp: settings.quran.setupOn !== null,
        revisionMinutes: settings.quran.revisionMinutesPerDay,
        newMinutes: settings.quran.newLearningMinutesPerDay,
      },
      training: {
        lastWorkout,
        restDays: settings.physique.restDays,
        minutes: settings.planner.trainingMinutes,
      },
      study: {
        weeklyMinutes: targets.study,
        coveredMinutes: studyLogged + reserved('degree'),
        sessionMinutes: settings.degree.sessionMinutes,
      },
      game: {
        weeklyMinutes: targets.game,
        coveredMinutes: gameLogged + reserved('game'),
        sessionMinutes: settings.planner.gameSessionMinutes,
      },
      mealPrep: {
        perWeek: settings.planner.mealPrepPerWeek,
        minutes: settings.planner.mealPrepMinutes,
        coveredSessions: kept.filter((b) => b.kind === 'meal-prep').length,
      },
    };
    // Kept blocks of a daily kind already cover that day.
    return buildDemands(inputs).map((d) =>
      d.daily
        ? {
            ...d,
            daily: {
              ...d.daily,
              dates: d.daily.dates.filter(
                (date) => !kept.some((b) => b.date === date && b.kind === d.kind),
              ),
            },
          }
        : d,
    );
  };

  return {
    ready:
      plan.data !== undefined &&
      study.data !== undefined &&
      time.data !== undefined &&
      workouts.data !== undefined,
    blocks,
    studyLogged,
    gameLogged,
    lastWorkout,
    demands,
    targets,
  };
}
