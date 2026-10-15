/** Half-open minute intervals [start, end) within a day. */
export interface Interval {
  start: number;
  end: number;
}

export const length = (i: Interval) => Math.max(0, i.end - i.start);

/** Sorts and merges overlapping or touching intervals. */
export function merge(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** `base` minus every interval in `remove`. */
export function subtract(base: readonly Interval[], remove: readonly Interval[]): Interval[] {
  let result = merge(base);
  for (const r of merge(remove)) {
    const next: Interval[] = [];
    for (const b of result) {
      if (r.end <= b.start || r.start >= b.end) {
        next.push(b);
        continue;
      }
      if (r.start > b.start) next.push({ start: b.start, end: r.start });
      if (r.end < b.end) next.push({ start: r.end, end: b.end });
    }
    result = next;
  }
  return result;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export const roundUp = (m: number, step = 5) => Math.ceil(m / step) * step;
export const roundDown = (m: number, step = 5) => Math.floor(m / step) * step;
