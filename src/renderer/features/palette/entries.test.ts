import { describe, expect, it } from 'vitest';
import { searchEntries } from './entries';

describe('searchEntries', () => {
  it('matches word starts in labels first, then keywords', () => {
    expect(searchEntries('plan')[0]?.path).toBe('/planner');
    expect(
      searchEntries('rev')
        .slice(0, 3)
        .map((e) => e.label),
    ).toContain('Weekly review');
    expect(searchEntries('quran rev')[0]?.path).toBe('/quran/revision');
    expect(searchEntries('calories')[0]?.path).toBe('/physique/nutrition');
    expect(searchEntries('timer').map((e) => e.label)).toContain('Start the game timer');
    expect(searchEntries('zzz')).toEqual([]);
    expect(searchEntries('')).toEqual([]);
  });
});
