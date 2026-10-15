import { diffDays, type LocalDate } from '../time/localDate';
import type { MushafLayout } from './mushaf';
import { strength, type PageRecord } from './scheduler';

export interface QueueSession {
  juz: number;
  pages: number[];
  kind: 'learning' | 'revision' | 'rotation';
}

export interface RevisionQueue {
  sessions: QueueSession[];
  /** Pages selected for today, in priority order. */
  selected: number[];
  dueCount: number;
  /** Due pages that did not fit in today's time; they stay due and gain priority. */
  backlog: number;
  capacity: number;
  minutes: number;
}

const KIND_RANK: Record<QueueSession['kind'], number> = { learning: 0, revision: 1, rotation: 2 };

function kindOf(record: PageRecord): QueueSession['kind'] {
  if (record.state === 'new') return 'learning';
  if (record.state === 'revision') return 'revision';
  return 'rotation';
}

/**
 * Today's revision queue, sized to the time available.
 *
 * Order of priority:
 *   1. pages still in their learning steps (recently memorised — the most fragile),
 *   2. pages being relearnt after a lapse,
 *   3. the memorised rotation, most overdue first *relative to its interval*
 *      (a page 5 days late on a 7-day interval outranks one 5 days late on 30),
 *      then the weakest first.
 * Selected pages are grouped into contiguous sessions within a juz for display.
 */
export function buildQueue(
  records: readonly PageRecord[],
  today: LocalDate,
  layout: MushafLayout,
  options: { availableMinutes: number; minutesPerPage: number },
): RevisionQueue {
  const due = records.filter(
    (r) => r.state !== 'not_started' && r.dueOn !== null && r.dueOn <= today,
  );
  const scored = due.map((r) => {
    const overdue = r.dueOn ? diffDays(r.dueOn, today) : 0;
    return {
      record: r,
      kind: kindOf(r),
      relativeOverdue: overdue / Math.max(1, r.intervalDays),
      strength: strength(r, today) ?? 1,
    };
  });
  scored.sort(
    (a, b) =>
      KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
      b.relativeOverdue - a.relativeOverdue ||
      a.strength - b.strength ||
      a.record.page - b.record.page,
  );
  const minutesPerPage = Math.max(0.5, options.minutesPerPage);
  const capacity = Math.max(0, Math.floor(options.availableMinutes / minutesPerPage));
  const chosen = scored.slice(0, capacity);

  // Group into sessions: same kind, same juz, consecutive pages.
  const byKind = [...chosen].sort(
    (a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.record.page - b.record.page,
  );
  const sessions: QueueSession[] = [];
  for (const item of byKind) {
    const juz = layout.juzOfPage[item.record.page] ?? 0;
    const last = sessions[sessions.length - 1];
    const lastPage = last?.pages[last.pages.length - 1];
    if (last && last.kind === item.kind && last.juz === juz && lastPage === item.record.page - 1) {
      last.pages.push(item.record.page);
    } else {
      sessions.push({ juz, pages: [item.record.page], kind: item.kind });
    }
  }

  return {
    sessions,
    selected: chosen.map((c) => c.record.page),
    dueCount: due.length,
    backlog: Math.max(0, due.length - chosen.length),
    capacity,
    minutes: Math.round(chosen.length * minutesPerPage),
  };
}

/** How many reviews are scheduled on each of the next `days` days (index 0 = today, incl. overdue). */
export function upcomingLoad(
  records: readonly PageRecord[],
  today: LocalDate,
  days: number,
): number[] {
  const counts = new Array<number>(days).fill(0);
  for (const r of records) {
    if (r.state === 'not_started' || r.dueOn === null) continue;
    const offset = Math.max(0, diffDays(today, r.dueOn));
    if (offset < days) counts[offset] = (counts[offset] ?? 0) + 1;
  }
  return counts;
}
