/**
 * Wall-clock times of day are stored as `HH:MM` strings and manipulated as minutes
 * after local midnight. Values ≥ 1440 represent times on the following day, which
 * is how a night shift ending at 01:00 is modelled (start 960, end 1500).
 */
export type ClockTime = string;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isClockTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function toMinutes(time: ClockTime): number {
  const m = TIME_RE.exec(time);
  if (!m) throw new RangeError(`Invalid time: ${time}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Formats minutes (possibly ≥ 1440 or negative) as a 24-hour `HH:MM` label. */
export function fromMinutes(minutes: number): ClockTime {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** A span within one day's frame; `end` may exceed 1440 for spans crossing midnight. */
export interface MinuteSpan {
  start: number;
  end: number;
}

/** Resolves an `HH:MM`–`HH:MM` pair into a span, rolling the end past midnight if needed. */
export function spanOf(start: ClockTime, end: ClockTime): MinuteSpan {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (e <= s) e += 1440;
  return { start: s, end: e };
}

export function durationLabel(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${r} min`;
}
