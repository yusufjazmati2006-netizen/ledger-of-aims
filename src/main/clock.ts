import { localDateOf, type LocalDate } from '@shared/domain/time/localDate';

export interface Clock {
  now(): Date;
  nowIso(): string;
  today(): LocalDate;
}

/**
 * The system clock, optionally shifted so that "now" starts at a fixed instant and
 * then advances in real time. `LEDGER_NOW` is used by end-to-end tests to make the
 * app behave as though it were a particular day (e.g. 2026-10-15T09:00).
 */
export function createClock(override?: string): Clock {
  let offset = 0;
  if (override) {
    const fixed = new Date(override);
    if (Number.isNaN(fixed.getTime())) throw new RangeError(`Invalid LEDGER_NOW: ${override}`);
    offset = fixed.getTime() - Date.now();
  }
  const now = () => new Date(Date.now() + offset);
  return {
    now,
    nowIso: () => now().toISOString(),
    today: () => localDateOf(now()),
  };
}
