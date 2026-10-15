import type { MushafLayout } from './mushaf';
import { strength, type PageRecord } from './scheduler';
import type { LocalDate } from '../time/localDate';

export type Direction = 'forward' | 'backward';

/** Learned pages count towards memorisation progress whatever their revision state. */
export const isLearned = (r: PageRecord) => r.state !== 'not_started';

export interface JuzSummary {
  juz: number;
  size: number;
  learned: number;
  memorized: number;
  newPages: number;
  revision: number;
  /** Mean estimated retention of learned pages (0–1), or null if none learned. */
  strength: number | null;
  complete: boolean;
}

export function juzSummaries(
  records: readonly PageRecord[],
  layout: MushafLayout,
  today: LocalDate,
): JuzSummary[] {
  const byPage = new Map(records.map((r) => [r.page, r]));
  return layout.juz.map((range) => {
    let learned = 0;
    let memorized = 0;
    let newPages = 0;
    let revision = 0;
    let strengthSum = 0;
    for (let p = range.first; p <= range.last; p++) {
      const r = byPage.get(p);
      if (!r || !isLearned(r)) continue;
      learned++;
      if (r.state === 'memorized') memorized++;
      if (r.state === 'new') newPages++;
      if (r.state === 'revision') revision++;
      strengthSum += strength(r, today) ?? 0;
    }
    return {
      juz: range.juz,
      size: range.size,
      learned,
      memorized,
      newPages,
      revision,
      strength: learned > 0 ? strengthSum / learned : null,
      complete: learned === range.size,
    };
  });
}

/**
 * The order in which juz are taken up when learning new pages. Backward
 * memorisers (who began with juz 30) move to earlier juz but read each juz from its
 * first page, so the order is "juz descending, pages ascending".
 */
export function juzLearningOrder(direction: Direction): number[] {
  const asc = Array.from({ length: 30 }, (_, i) => i + 1);
  return direction === 'forward' ? asc : asc.reverse();
}

/** The next `count` unlearned pages in learning order. */
export function nextPagesToLearn(
  records: readonly PageRecord[],
  layout: MushafLayout,
  direction: Direction,
  count: number,
): number[] {
  const learned = new Set(records.filter(isLearned).map((r) => r.page));
  const out: number[] = [];
  // Finish partially learned juz first (in learning order), then untouched ones.
  const order = juzLearningOrder(direction);
  const started = order.filter((j) => {
    const range = layout.juz[j - 1];
    if (!range) return false;
    let any = false;
    let all = true;
    for (let p = range.first; p <= range.last; p++) {
      if (learned.has(p)) any = true;
      else all = false;
    }
    return any && !all;
  });
  const rest = order.filter((j) => !started.includes(j));
  for (const j of [...started, ...rest]) {
    const range = layout.juz[j - 1];
    if (!range) continue;
    for (let p = range.first; p <= range.last && out.length < count; p++) {
      if (!learned.has(p)) out.push(p);
    }
    if (out.length >= count) break;
  }
  return out;
}

/**
 * Juz in the order they will be completed: those already complete, then partially
 * learned ones, then untouched ones in learning order. Used to convert a milestone
 * such as "25 juz" into an exact page count for this mushaf and this person.
 */
export function juzCompletionOrder(
  records: readonly PageRecord[],
  layout: MushafLayout,
  direction: Direction,
): number[] {
  const learned = new Set(records.filter(isLearned).map((r) => r.page));
  const status = (j: number) => {
    const range = layout.juz[j - 1];
    if (!range) return 2;
    let n = 0;
    for (let p = range.first; p <= range.last; p++) if (learned.has(p)) n++;
    return n === range.size ? 0 : n > 0 ? 1 : 2;
  };
  const order = juzLearningOrder(direction);
  return [0, 1, 2].flatMap((s) => order.filter((j) => status(j) === s));
}

/** Total pages once `juzCount` juz are complete, following the completion order. */
export function pagesForJuzCount(
  juzCount: number,
  completionOrder: readonly number[],
  layout: MushafLayout,
): number {
  const whole = Math.floor(juzCount);
  let pages = 0;
  for (let i = 0; i < Math.min(whole, completionOrder.length); i++) {
    pages += layout.juz[(completionOrder[i] ?? 1) - 1]?.size ?? 0;
  }
  const fraction = juzCount - whole;
  if (fraction > 0 && whole < completionOrder.length) {
    pages += fraction * (layout.juz[(completionOrder[whole] ?? 1) - 1]?.size ?? 0);
  }
  return pages;
}
