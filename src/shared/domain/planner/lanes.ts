export interface Lane {
  lane: number;
  of: number;
}

/**
 * Side-by-side lanes for overlapping blocks: each block takes the first lane free at
 * its start, and every block in a group of overlaps shares that group's lane count.
 */
export function layoutLanes(blocks: readonly { id: string; start: number; end: number }[]) {
  const out = new Map<string, Lane>();
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  let group: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;
  const flush = () => {
    for (const g of group) out.set(g.id, { lane: g.lane, of: Math.max(1, laneEnds.length) });
    group = [];
    laneEnds = [];
  };
  for (const b of sorted) {
    if (b.start >= groupEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= b.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(b.end);
    } else {
      laneEnds[lane] = b.end;
    }
    group.push({ id: b.id, lane });
    groupEnd = Math.max(groupEnd, b.end);
  }
  flush();
  return out;
}
