/**
 * Calendar dates are stored and manipulated as `YYYY-MM-DD` strings (a "LocalDate").
 *
 * All arithmetic is done on an integer day number computed in UTC, which makes it
 * immune to daylight-saving transitions: a LocalDate is a label on the wall calendar,
 * not an instant in time.
 */
export type LocalDate = string & { readonly __brand?: 'LocalDate' };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function isLocalDate(value: string): value is LocalDate {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return (
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(mo) - 1 &&
    date.getUTCDate() === Number(d)
  );
}

export function assertLocalDate(value: string): LocalDate {
  if (!isLocalDate(value)) throw new RangeError(`Invalid LocalDate: ${value}`);
  return value;
}

/** Days since 1970-01-01 for the given LocalDate. */
export function toDayNumber(date: LocalDate): number {
  const m = DATE_RE.exec(date);
  if (!m) throw new RangeError(`Invalid LocalDate: ${date}`);
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_PER_DAY);
}

export function fromDayNumber(day: number): LocalDate {
  const d = new Date(day * MS_PER_DAY);
  return `${d.getUTCFullYear().toString().padStart(4, '0')}-${(d.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}-${d.getUTCDate().toString().padStart(2, '0')}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return toDayNumber(b) - toDayNumber(a);
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return a <= b ? a : b;
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a >= b ? a : b;
}

/** 0 = Sunday … 6 = Saturday (matches Date#getDay). */
export function dayOfWeek(date: LocalDate): number {
  // 1970-01-01 was a Thursday (4).
  return (((toDayNumber(date) + 4) % 7) + 7) % 7;
}

/** The first day of the week containing `date`, where `weekStartsOn` is 0 (Sun) – 6 (Sat). */
export function startOfWeek(date: LocalDate, weekStartsOn: number): LocalDate {
  const offset = (dayOfWeek(date) - weekStartsOn + 7) % 7;
  return addDays(date, -offset);
}

export function eachDay(start: LocalDate, endInclusive: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = toDayNumber(start), end = toDayNumber(endInclusive); d <= end; d++) {
    out.push(fromDayNumber(d));
  }
  return out;
}

/** The LocalDate on the wall calendar of the machine for the given instant. */
export function localDateOf(instant: Date): LocalDate {
  return `${instant.getFullYear().toString().padStart(4, '0')}-${(instant.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${instant.getDate().toString().padStart(2, '0')}`;
}

export function parts(date: LocalDate): { year: number; month: number; day: number } {
  const m = DATE_RE.exec(date);
  if (!m) throw new RangeError(`Invalid LocalDate: ${date}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function addMonths(date: LocalDate, months: number): LocalDate {
  const { year, month, day } = parts(date);
  const total = year * 12 + (month - 1) + months;
  const y = Math.floor(total / 12);
  const m = total - y * 12;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return `${y.toString().padStart(4, '0')}-${(m + 1).toString().padStart(2, '0')}-${Math.min(
    day,
    lastDay,
  )
    .toString()
    .padStart(2, '0')}`;
}

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function weekdayShort(date: LocalDate): string {
  return WEEKDAYS_SHORT[dayOfWeek(date)] ?? '';
}

export function weekdayLong(date: LocalDate): string {
  return WEEKDAYS_LONG[dayOfWeek(date)] ?? '';
}

export function weekdayNameShort(index: number): string {
  return WEEKDAYS_SHORT[((index % 7) + 7) % 7] ?? '';
}

export function weekdayNameLong(index: number): string {
  return WEEKDAYS_LONG[((index % 7) + 7) % 7] ?? '';
}

/** "15 Oct 2026" */
export function formatDate(date: LocalDate, opts: { year?: boolean } = {}): string {
  const { year, month, day } = parts(date);
  const base = `${day} ${MONTHS_SHORT[month - 1] ?? ''}`;
  return opts.year === false ? base : `${base} ${year}`;
}

/** "Thursday 15 October 2026" */
export function formatDateLong(date: LocalDate): string {
  const { year, month, day } = parts(date);
  return `${weekdayLong(date)} ${day} ${MONTHS_LONG[month - 1] ?? ''} ${year}`;
}

/** "Oct 2026" */
export function formatMonthYear(date: LocalDate): string {
  const { year, month } = parts(date);
  return `${MONTHS_SHORT[month - 1] ?? ''} ${year}`;
}

export function monthLong(month: number): string {
  return MONTHS_LONG[month - 1] ?? '';
}

/** Human description of a distance in days, e.g. "in 3 days", "today", "2 days ago". */
export function relativeDays(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 0) return `in ${days} days`;
  return `${-days} days ago`;
}

/** The instant of local midnight at the start of `date`. */
export function localMidnight(date: LocalDate): Date {
  const { year, month, day } = parts(date);
  return new Date(year, month - 1, day);
}
