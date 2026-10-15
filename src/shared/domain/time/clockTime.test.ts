import { describe, expect, it } from 'vitest';
import { durationLabel, fromMinutes, isClockTime, spanOf, toMinutes } from './clockTime';

describe('clock time', () => {
  it('parses and formats', () => {
    expect(toMinutes('07:30')).toBe(450);
    expect(toMinutes('00:00')).toBe(0);
    expect(fromMinutes(450)).toBe('07:30');
    expect(fromMinutes(1500)).toBe('01:00');
    expect(fromMinutes(-30)).toBe('23:30');
    expect(isClockTime('24:00')).toBe(false);
    expect(isClockTime('7:30')).toBe(false);
  });

  it('rolls spans past midnight', () => {
    expect(spanOf('07:30', '16:30')).toEqual({ start: 450, end: 990 });
    // The night shift ends at 01:00 the following day.
    expect(spanOf('16:00', '01:00')).toEqual({ start: 960, end: 1500 });
  });

  it('labels durations', () => {
    expect(durationLabel(25)).toBe('25 min');
    expect(durationLabel(60)).toBe('1 h');
    expect(durationLabel(95)).toBe('1 h 35 min');
  });
});
