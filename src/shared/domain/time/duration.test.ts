import { describe, expect, it } from 'vitest';
import { parseDuration } from './duration';

describe('parseDuration', () => {
  it.each([
    ['45', 45],
    ['45m', 45],
    ['45 min', 45],
    ['90 minutes', 90],
    ['1.5h', 90],
    ['1,5h', 90],
    ['2 hours', 120],
    ['1h30', 90],
    ['1h 30m', 90],
    ['1 h 30 min', 90],
    ['1:30', 90],
    ['0:45', 45],
    [' 2H ', 120],
  ])('reads %s as %i minutes', (text, minutes) => {
    expect(parseDuration(text)).toBe(minutes);
  });

  it.each(['', 'abc', '0', '0.2', '25h', '1:75', '-5', 'h', '1h90m x'])('rejects %j', (text) => {
    expect(parseDuration(text)).toBeNull();
  });
});
