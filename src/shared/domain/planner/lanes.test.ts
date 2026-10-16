import { describe, expect, it } from 'vitest';
import { layoutLanes } from './lanes';

describe('layoutLanes', () => {
  it('gives separate blocks the full width and overlapping ones side-by-side lanes', () => {
    const lanes = layoutLanes([
      { id: 'a', start: 600, end: 660 },
      { id: 'b', start: 630, end: 690 },
      { id: 'c', start: 670, end: 700 }, // overlaps b only; reuses a's lane
      { id: 'd', start: 800, end: 860 },
    ]);
    expect(Object.fromEntries(lanes)).toEqual({
      a: { lane: 0, of: 2 },
      b: { lane: 1, of: 2 },
      c: { lane: 0, of: 2 },
      d: { lane: 0, of: 1 },
    });
  });
});
