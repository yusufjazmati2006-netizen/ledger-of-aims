import { computeStreak, type StreakResult } from '@shared/domain/streaks/streaks';
import { addDays } from '@shared/domain/time/localDate';
import type { Habit } from '@shared/schemas/review';
import { useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';

export interface HabitView extends Habit {
  checks: Set<string>;
  streak: StreakResult;
}

/** Active habits with their checks over the last year and a forgiving streak each. */
export function useHabits(): { ready: boolean; active: HabitView[]; archived: HabitView[] } {
  const today = useToday();
  const data = useLedger(
    'habits.data',
    { from: addDays(today, -365), to: today },
    { domains: ['habits'] },
  );
  const views = (data.data?.habits ?? []).map((h) => {
    const dates = data.data?.checks[h.id] ?? [];
    return {
      ...h,
      checks: new Set(dates),
      streak: computeStreak(dates, today, { graceDays: h.graceDays, windowDays: 7 }),
    };
  });
  return {
    ready: data.data !== undefined,
    active: views.filter((h) => !h.archived),
    archived: views.filter((h) => h.archived),
  };
}
