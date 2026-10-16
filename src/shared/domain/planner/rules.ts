import { toMinutes } from '../time/clockTime';
import type { PlannerSettings } from '../../schemas/settings';
import type { PlannerRules } from './freeTime';

/** The free-time rules from the user's planner settings. */
export function plannerRules(p: PlannerSettings): PlannerRules {
  return {
    commuteMinutes: p.commuteMinutes,
    sleepMinutes: Math.round(p.sleepHours * 60),
    windDownMinutes: p.windDownMinutes,
    morningRoutineMinutes: p.morningRoutineMinutes,
    postShiftRecoveryMinutes: p.postShiftRecoveryMinutes,
    dayStart: toMinutes(p.dayStart),
    dayEnd: toMinutes(p.dayEnd),
    minWindowMinutes: p.minWindowMinutes,
    minSleepBetweenShifts: Math.round(p.minSleepBetweenShiftsHours * 60),
  };
}
