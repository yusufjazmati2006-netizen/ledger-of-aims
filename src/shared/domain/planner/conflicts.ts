/**
 * Problems in a plan, each explained in words: a block that overlaps a shift (with
 * its commute), one that cuts into sleep after a night shift or before a morning one,
 * two blocks on top of each other, and a night-then-morning "clopen" that leaves too
 * little sleep.
 */
import { fromMinutes, durationLabel } from '../time/clockTime';
import type { LocalDate } from '../time/localDate';
import type { DayFrame } from './freeTime';
import { overlaps } from './intervals';

export type ConflictKind = 'shift' | 'sleep' | 'overlap' | 'short-sleep';

export interface Conflict {
  kind: ConflictKind;
  date: LocalDate;
  blockIds: string[];
  message: string;
}

export interface BlockLike {
  id: string;
  date: LocalDate;
  start: number;
  end: number;
  title: string;
  done?: boolean;
}

export function findConflicts(
  frames: readonly DayFrame[],
  blocks: readonly BlockLike[],
): Conflict[] {
  const out: Conflict[] = [];
  const byDate = new Map<LocalDate, BlockLike[]>();
  for (const b of blocks) {
    if (b.done) continue;
    byDate.set(b.date, [...(byDate.get(b.date) ?? []), b]);
  }

  for (const f of frames) {
    if (f.shortSleep && f.sleepBetweenShifts !== null) {
      out.push({
        kind: 'short-sleep',
        date: f.date,
        blockIds: [],
        message: `Only ${durationLabel(f.sleepBetweenShifts)} possible for sleep between shifts.`,
      });
    }
    const day = (byDate.get(f.date) ?? []).sort((a, b) => a.start - b.start);
    for (const b of day) {
      if (f.busy.some((busy) => overlaps(busy, b))) {
        out.push({
          kind: 'shift',
          date: f.date,
          blockIds: [b.id],
          message: `“${b.title}” overlaps your shift or the commute to it.`,
        });
      } else if (b.start < f.wake) {
        out.push({
          kind: 'sleep',
          date: f.date,
          blockIds: [b.id],
          message: `“${b.title}” starts before ${fromMinutes(f.wake)}, when your day begins.`,
        });
      } else if (b.end > f.bedtime) {
        out.push({
          kind: 'sleep',
          date: f.date,
          blockIds: [b.id],
          message: `“${b.title}” runs past ${fromMinutes(f.bedtime)}, when you should be winding down.`,
        });
      }
    }
    for (let i = 0; i < day.length; i++) {
      for (let j = i + 1; j < day.length; j++) {
        const a = day[i];
        const b = day[j];
        if (a && b && overlaps(a, b)) {
          out.push({
            kind: 'overlap',
            date: f.date,
            blockIds: [a.id, b.id],
            message: `“${a.title}” and “${b.title}” overlap.`,
          });
        }
      }
    }
  }
  return out;
}
