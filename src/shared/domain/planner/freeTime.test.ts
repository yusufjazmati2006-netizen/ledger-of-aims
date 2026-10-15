import { describe, expect, it } from 'vitest';
import { dayFrame, proposeSessions, weekFrames, type ShiftSpan } from './freeTime';
import { subtract, merge } from './intervals';

const MORNING: ShiftSpan = { start: 450, end: 990 }; // 07:30–16:30
const NIGHT: ShiftSpan = { start: 960, end: 1500 }; // 16:00–01:00
const shifts = (map: Record<string, ShiftSpan>) => (d: string) => map[d] ?? null;
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const windowsOf = (f: ReturnType<typeof dayFrame>) =>
  f.windows.map((w) => `${hhmm(w.start)}–${hhmm(w.end)}`);

describe('intervals', () => {
  it('merges and subtracts', () => {
    expect(
      merge([
        { start: 5, end: 10 },
        { start: 0, end: 6 },
        { start: 12, end: 13 },
      ]),
    ).toEqual([
      { start: 0, end: 10 },
      { start: 12, end: 13 },
    ]);
    expect(
      subtract(
        [{ start: 0, end: 100 }],
        [
          { start: 10, end: 20 },
          { start: 90, end: 120 },
        ],
      ),
    ).toEqual([
      { start: 0, end: 10 },
      { start: 20, end: 90 },
    ]);
  });
});

describe('free time around shifts', () => {
  it('gives a full day on a day off', () => {
    const f = dayFrame('2026-10-17', shifts({}));
    expect(windowsOf(f)).toEqual(['07:00–23:00']);
    expect(f.freeMinutes).toBe(960);
  });

  it('never schedules the small hours or morning after a night shift', () => {
    // Night shift ends 01:00 → home 01:20 → wind-down → sleep 01:50–09:50 → routine → 10:20.
    const f = dayFrame('2026-10-17', shifts({ '2026-10-16': NIGHT }));
    expect(f.wake).toBe(620);
    expect(windowsOf(f)).toEqual(['10:20–23:00']);
  });

  it('only offers the morning before a night shift', () => {
    const f = dayFrame('2026-10-16', shifts({ '2026-10-16': NIGHT }));
    expect(windowsOf(f)).toEqual(['07:00–15:40']);
  });

  it('offers the evening after a morning shift, with travel and recovery', () => {
    const f = dayFrame('2026-10-16', shifts({ '2026-10-16': MORNING }));
    expect(windowsOf(f)).toEqual(['17:20–23:00']);
  });

  it('ends the evening early before a morning shift', () => {
    // Shift 07:30 → leave 07:10 → routine from 06:40 → sleep from 22:40 → wind-down from 22:10.
    const f = dayFrame('2026-10-16', shifts({ '2026-10-16': MORNING, '2026-10-17': MORNING }));
    expect(f.bedtime).toBe(1330);
    expect(windowsOf(f)).toEqual(['17:20–22:10']);
  });

  it('flags a night shift followed by a morning shift (a "clopen")', () => {
    const f = dayFrame('2026-10-17', shifts({ '2026-10-16': NIGHT, '2026-10-17': MORNING }));
    expect(f.sleepBetweenShifts).toBe(290); // 01:50 → 06:40
    expect(f.shortSleep).toBe(true);
    expect(
      dayFrame('2026-10-17', shifts({ '2026-10-16': MORNING, '2026-10-17': MORNING })).shortSleep,
    ).toBe(false);
  });

  it('drops windows shorter than the minimum', () => {
    const f = dayFrame('2026-10-16', shifts({ '2026-10-16': MORNING }));
    // 07:00–07:10 before leaving for work is too short to use.
    expect(f.windows.every((w) => w.end - w.start >= 20)).toBe(true);
  });

  it('builds a week of frames', () => {
    const frames = weekFrames(
      '2026-10-12',
      7,
      shifts({ '2026-10-13': NIGHT, '2026-10-15': MORNING }),
    );
    // Wed follows a night shift (from 10:20) and precedes a morning shift (until 22:10).
    expect(frames.map((f) => f.freeMinutes)).toEqual([960, 520, 710, 340, 960, 960, 960]);
  });
});

describe('proposing sessions', () => {
  const frames = weekFrames(
    '2026-10-12',
    7,
    shifts({ '2026-10-12': MORNING, '2026-10-13': NIGHT, '2026-10-14': MORNING }),
  );

  it('spreads the weekly target across days, earliest first', () => {
    const sessions = proposeSessions(frames, {
      totalMinutes: 360,
      sessionMinutes: 60,
      minSession: 30,
      maxPerDay: 2,
    });
    expect(sessions.reduce((s, x) => s + (x.end - x.start), 0)).toBe(360);
    expect(new Set(sessions.map((s) => s.date)).size).toBe(6);
    expect(sessions[0]?.date).toBe('2026-10-12');
    expect(sessions.some((s) => s.date === '2026-10-18')).toBe(false);
    for (const s of sessions) {
      const frame = frames.find((f) => f.date === s.date)!;
      expect(frame.windows.some((w) => s.start >= w.start && s.end <= w.end)).toBe(true);
    }
  });

  it('respects blocks already planned and the current time', () => {
    const planned = new Map([['2026-10-17', [{ start: 420, end: 1380 }]]]);
    const sessions = proposeSessions(frames, {
      totalMinutes: 600,
      sessionMinutes: 60,
      minSession: 30,
      maxPerDay: 1,
      planned,
      now: { date: '2026-10-15', minute: 12 * 60 },
    });
    expect(sessions.some((s) => s.date === '2026-10-17')).toBe(false);
    expect(sessions.some((s) => s.date < '2026-10-15')).toBe(false);
    const today = sessions.find((s) => s.date === '2026-10-15');
    expect(today?.start).toBeGreaterThanOrEqual(12 * 60 + 10);
  });

  it('never places two sessions on top of each other', () => {
    const sessions = proposeSessions(frames, {
      totalMinutes: 900,
      sessionMinutes: 60,
      minSession: 30,
      maxPerDay: 3,
    });
    const byDay = new Map<string, { start: number; end: number }[]>();
    for (const s of sessions) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);
    for (const list of byDay.values()) {
      const sorted = list.sort((a, b) => a.start - b.start);
      for (let i = 1; i < sorted.length; i++)
        expect(sorted[i]!.start).toBeGreaterThanOrEqual(sorted[i - 1]!.end);
    }
  });
});
