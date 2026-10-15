import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  addDays,
  addMonths,
  dayOfWeek,
  diffDays,
  eachDay,
  formatDate,
  formatDateLong,
  fromDayNumber,
  isLocalDate,
  localDateOf,
  relativeDays,
  startOfWeek,
  toDayNumber,
} from './localDate';

describe('LocalDate', () => {
  it('validates real calendar dates only', () => {
    expect(isLocalDate('2026-10-15')).toBe(true);
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isLocalDate('2027-02-29')).toBe(false);
    expect(isLocalDate('2026-13-01')).toBe(false);
    expect(isLocalDate('2026-1-01')).toBe(false);
    expect(isLocalDate('')).toBe(false);
  });

  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-10-15', 1)).toBe('2026-10-16');
    // UK clocks go back on 25 Oct 2026; wall-calendar arithmetic must not drift.
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('diffs whole days', () => {
    expect(diffDays('2026-10-15', '2027-03-04')).toBe(140);
    expect(diffDays('2027-03-04', '2027-07-22')).toBe(140);
    expect(diffDays('2027-07-22', '2027-12-09')).toBe(140);
    expect(diffDays('2027-12-09', '2026-10-15')).toBe(-420);
  });

  it('round-trips day numbers (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: -100_000, max: 100_000 }), (n) => {
        expect(toDayNumber(fromDayNumber(n))).toBe(n);
      }),
    );
  });

  it('addDays and diffDays are inverse (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: -5000, max: 5000 }), (n) => {
        expect(diffDays('2026-10-15', addDays('2026-10-15', n))).toBe(n);
      }),
    );
  });

  it('knows weekdays and week starts', () => {
    expect(dayOfWeek('2026-10-15')).toBe(4); // Thursday
    expect(startOfWeek('2026-10-15', 1)).toBe('2026-10-12');
    expect(startOfWeek('2026-10-15', 0)).toBe('2026-10-11');
    expect(startOfWeek('2026-10-12', 1)).toBe('2026-10-12');
    expect(startOfWeek('2026-10-18', 1)).toBe('2026-10-12');
  });

  it('adds months, clamping to the month end', () => {
    expect(addMonths('2026-10-31', 1)).toBe('2026-11-30');
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2026-10-15', 12)).toBe('2027-10-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('enumerates inclusive ranges', () => {
    expect(eachDay('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(eachDay('2026-10-02', '2026-10-01')).toEqual([]);
  });

  it('formats for people', () => {
    expect(formatDate('2027-03-04')).toBe('4 Mar 2027');
    expect(formatDate('2027-03-04', { year: false })).toBe('4 Mar');
    expect(formatDateLong('2026-10-15')).toBe('Thursday 15 October 2026');
    expect(relativeDays(0)).toBe('today');
    expect(relativeDays(3)).toBe('in 3 days');
    expect(relativeDays(-2)).toBe('2 days ago');
  });

  it('reads the local wall-calendar date of an instant', () => {
    expect(localDateOf(new Date(2026, 9, 15, 23, 59))).toBe('2026-10-15');
    expect(localDateOf(new Date(2026, 9, 16, 0, 30))).toBe('2026-10-16');
  });
});
