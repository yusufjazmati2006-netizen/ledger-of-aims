import { useMemo } from 'react';
import { spanOf } from '@shared/domain/time/clockTime';
import { plannerRules } from '@shared/domain/planner/rules';
import { addDays, type LocalDate } from '@shared/domain/time/localDate';
import { weekFrames, type DayFrame, type ShiftSpan } from '@shared/domain/planner/freeTime';
import { useSettings } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';

/**
 * Shift-aware day frames (free windows, wake/bed times, clopen warnings) for `days`
 * days from `start`. Shifts the day before and after are loaded too, because they
 * shape the first and last day.
 */
export function usePlannerFrames(
  start: LocalDate,
  days: number,
): {
  frames: DayFrame[];
  shiftOn: (date: LocalDate) => ShiftSpan | null;
  shiftTypeOn: (date: LocalDate) => string | null;
  ready: boolean;
} {
  const settings = useSettings();
  const types = useLedger('shifts.types', undefined, { domains: ['shifts'] });
  const assigned = useLedger(
    'shifts.range',
    { from: addDays(start, -1), to: addDays(start, days) },
    { domains: ['shifts'] },
  );
  return useMemo(() => {
    const spans = new Map<string, ShiftSpan | null>();
    for (const t of types.data ?? [])
      spans.set(t.id, t.start && t.end ? spanOf(t.start, t.end) : null);
    const byDate = new Map((assigned.data ?? []).map((d) => [d.date, d.shiftTypeId]));
    const shiftTypeOn = (date: LocalDate) => byDate.get(date) ?? null;
    const shiftOn = (date: LocalDate) => {
      const id = byDate.get(date);
      return id ? (spans.get(id) ?? null) : null;
    };
    return {
      frames: weekFrames(start, days, shiftOn, plannerRules(settings.planner)),
      shiftOn,
      shiftTypeOn,
      ready: types.data !== undefined && assigned.data !== undefined,
    };
  }, [types.data, assigned.data, start, days, settings.planner]);
}
