import { describe, expect, it } from 'vitest';
import {
  buildLayout,
  MADANI_JUZ_START_PAGES,
  pageRangeLabel,
  pagesOfJuz,
  TOTAL_PAGES,
  validateJuzStarts,
} from './mushaf';

describe('mushaf layout', () => {
  const layout = buildLayout();

  it('covers all 604 pages exactly once across 30 juz', () => {
    expect(layout.juz).toHaveLength(30);
    expect(layout.juz.reduce((n, j) => n + j.size, 0)).toBe(TOTAL_PAGES);
    for (let p = 1; p <= TOTAL_PAGES; p++) expect(layout.juzOfPage[p]).toBeGreaterThan(0);
  });

  it('has the expected Madani boundaries', () => {
    expect(layout.juz[0]).toEqual({ juz: 1, first: 1, last: 21, size: 21 });
    expect(layout.juz[14]).toEqual({ juz: 15, first: 282, last: 301, size: 20 });
    expect(layout.juz[29]).toEqual({ juz: 30, first: 582, last: 604, size: 23 });
    expect(layout.juzOfPage[302]).toBe(16);
    expect(pagesOfJuz(layout, 16)).toHaveLength(20);
  });

  it('validates custom boundaries and falls back when invalid', () => {
    expect(validateJuzStarts(MADANI_JUZ_START_PAGES)).toBeNull();
    expect(validateJuzStarts([2, ...MADANI_JUZ_START_PAGES.slice(1)])).toMatch(/page 1/);
    const bad = [...MADANI_JUZ_START_PAGES];
    bad[5] = 50;
    expect(validateJuzStarts(bad)).toMatch(/Juz 6/);
    expect(validateJuzStarts(MADANI_JUZ_START_PAGES.slice(1))).toMatch(/30/);
    expect(buildLayout(bad).juz[5]?.first).toBe(102);
  });

  it('labels page ranges compactly', () => {
    expect(pageRangeLabel([284, 282, 283, 290])).toBe('pp. 282–284, 290');
    expect(pageRangeLabel([5])).toBe('p. 5');
    expect(pageRangeLabel([])).toBe('');
  });
});
