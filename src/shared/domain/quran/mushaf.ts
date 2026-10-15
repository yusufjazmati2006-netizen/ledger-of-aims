/**
 * Structural layout of a 604-page mushaf: which pages belong to which juz.
 *
 * Only page numbering is encoded here — no text, names or other content. The
 * default is the widely used 15-line Madani print; the boundaries are editable in
 * Settings because other prints differ slightly.
 */
export const TOTAL_PAGES = 604;
export const TOTAL_JUZ = 30;

export const MADANI_JUZ_START_PAGES: readonly number[] = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402,
  422, 442, 462, 482, 502, 522, 542, 562, 582,
];

export interface JuzRange {
  juz: number;
  first: number;
  last: number;
  size: number;
}

export interface MushafLayout {
  juz: readonly JuzRange[];
  /** juzOfPage[page] for page 1…604 (index 0 unused). */
  juzOfPage: readonly number[];
}

/** Checks that start pages are 30 strictly increasing pages beginning at 1. */
export function validateJuzStarts(starts: readonly number[]): string | null {
  if (starts.length !== TOTAL_JUZ)
    return `Expected ${TOTAL_JUZ} start pages, got ${starts.length}.`;
  if (starts[0] !== 1) return 'Juz 1 must start on page 1.';
  for (let i = 1; i < starts.length; i++) {
    const prev = starts[i - 1] ?? 0;
    const cur = starts[i] ?? 0;
    if (!Number.isInteger(cur) || cur <= prev) return `Juz ${i + 1} must start after juz ${i}.`;
    if (cur > TOTAL_PAGES) return `Juz ${i + 1} starts beyond page ${TOTAL_PAGES}.`;
  }
  return null;
}

export function buildLayout(starts: readonly number[] = MADANI_JUZ_START_PAGES): MushafLayout {
  const safe = validateJuzStarts(starts) === null ? starts : MADANI_JUZ_START_PAGES;
  const juz: JuzRange[] = safe.map((first, i) => {
    const last = (safe[i + 1] ?? TOTAL_PAGES + 1) - 1;
    return { juz: i + 1, first, last, size: last - first + 1 };
  });
  const juzOfPage = new Array<number>(TOTAL_PAGES + 1).fill(0);
  for (const range of juz) {
    for (let p = range.first; p <= range.last; p++) juzOfPage[p] = range.juz;
  }
  return { juz, juzOfPage };
}

export function pagesOfJuz(layout: MushafLayout, juz: number): number[] {
  const range = layout.juz[juz - 1];
  if (!range) return [];
  return Array.from({ length: range.size }, (_, i) => range.first + i);
}

/** A compact human label for a set of pages, e.g. "pp. 282–284, 290". */
export function pageRangeLabel(pages: readonly number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  const parts: string[] = [];
  let start = sorted[0] ?? 0;
  let prev = start;
  for (const p of sorted.slice(1).concat(Number.NaN)) {
    if (p === prev + 1) {
      prev = p;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = p;
    prev = p;
  }
  return `${sorted.length === 1 ? 'p.' : 'pp.'} ${parts.join(', ')}`;
}

/** Pages per juz on average — used only where an exact layout is unavailable. */
export const PAGES_PER_JUZ = TOTAL_PAGES / TOTAL_JUZ;
