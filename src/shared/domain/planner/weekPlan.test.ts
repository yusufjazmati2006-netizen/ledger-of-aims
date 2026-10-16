import { describe, expect, it } from 'vitest';
import { weekFrames, type ShiftSpan } from './freeTime';
import { planWeek, type Demand } from './weekPlan';
import { findConflicts } from './conflicts';
import { buildDemands, trainingDates } from './demands';

const MORNING: ShiftSpan = { start: 450, end: 990 }; // 07:30–16:30
const NIGHT: ShiftSpan = { start: 960, end: 1500 }; // 16:00–01:00
// Mon 19 Oct: morning · Tue: night · Wed: off (after a night) · Thu: off · Fri–Sun: off
const SHIFTS: Record<string, ShiftSpan> = { '2026-10-19': MORNING, '2026-10-20': NIGHT };
const frames = weekFrames('2026-10-19', 7, (d) => SHIFTS[d] ?? null);

const quran: Demand = {
  key: 'quran',
  goalId: 'quran',
  kind: 'revision',
  title: 'Revision',
  daily: {
    dates: ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'],
    minutes: 30,
    minMinutes: 15,
  },
  prefer: 'early',
};

describe('planWeek', () => {
  it('places daily items early, respecting shifts and sleep after a night shift', () => {
    const { blocks, unplaced } = planWeek(frames, [quran]);
    expect(unplaced).toEqual([]);
    const at = (date: string) => blocks.find((b) => b.date === date);
    // Monday: the 10 minutes before the commute are too short, so it goes after work.
    expect(at('2026-10-19')).toMatchObject({ start: 1040, end: 1070 });
    expect(at('2026-10-20')).toMatchObject({ start: 420, end: 450 });
    // Wednesday follows a night shift ending 01:00: nothing before 10:20.
    expect(at('2026-10-21')).toMatchObject({ start: 620, end: 650 });
    expect(at('2026-10-22')).toMatchObject({ start: 420, end: 450 });
  });

  it('places late-preferring items at the end of the last window', () => {
    const training: Demand = {
      key: 'training',
      goalId: 'physique',
      kind: 'training',
      title: 'Training',
      daily: { dates: ['2026-10-19'], minutes: 75, minMinutes: 45 },
      prefer: 'late',
    };
    expect(planWeek(frames, [training]).blocks[0]).toMatchObject({ start: 1305, end: 1380 });
  });

  it('spreads a weekly budget one session per day, in date order', () => {
    const study: Demand = {
      key: 'study',
      goalId: 'degree',
      kind: 'study',
      title: 'Study',
      weekly: { minutes: 180, session: 60, minSession: 30, maxPerDay: 2 },
      prefer: 'early',
    };
    const { blocks, unplaced } = planWeek(frames, [study]);
    expect(unplaced).toEqual([]);
    expect(blocks.map((b) => b.date)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21']);
    expect(blocks.every((b) => b.end - b.start === 60)).toBe(true);
  });

  it('leaves a break after each block and never double-books', () => {
    const study: Demand = {
      key: 'study',
      goalId: 'degree',
      kind: 'study',
      title: 'Study',
      weekly: { minutes: 60, session: 60, minSession: 30, maxPerDay: 1 },
      prefer: 'early',
    };
    const { blocks } = planWeek(frames, [quran, study]);
    const tuesday = blocks.filter((b) => b.date === '2026-10-19');
    expect(tuesday.map((b) => [b.start, b.end])).toEqual([
      [1040, 1070],
      [1080, 1140],
    ]);
    expect(
      findConflicts(
        frames,
        blocks.map((b, i) => ({ ...b, id: String(i) })),
      ),
    ).toEqual([]);
  });

  it('reports what does not fit instead of squeezing it in', () => {
    const marathon: Demand = {
      key: 'long',
      goalId: 'game',
      kind: 'game',
      title: 'Game jam',
      daily: { dates: ['2026-10-19'], minutes: 600, minMinutes: 600 },
      prefer: 'early',
    };
    expect(planWeek(frames, [marathon])).toEqual({
      blocks: [],
      unplaced: [{ demand: 'long', title: 'Game jam', goalId: 'game', minutes: 600 }],
    });
  });

  it('respects existing blocks, off-day-only demands and the current time', () => {
    const prep: Demand = {
      key: 'prep',
      goalId: 'physique',
      kind: 'meal-prep',
      title: 'Meal prep',
      weekly: { minutes: 60, session: 60, minSession: 45, maxPerDay: 1 },
      offDaysOnly: true,
      prefer: 'early',
    };
    const { blocks } = planWeek(frames, [prep], {
      occupied: new Map([['2026-10-21', [{ start: 600, end: 900 }]]]),
      now: { date: '2026-10-21', minute: 300 },
    });
    // Monday and Tuesday are past and have shifts; Wednesday's morning is taken.
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ date: '2026-10-21', start: 910, end: 970 });
  });
});

describe('findConflicts', () => {
  const block = (id: string, date: string, start: number, end: number, done = false) => ({
    id,
    date,
    start,
    end,
    title: id,
    done,
  });

  it('flags shifts, sleep, overlaps and clopens, and ignores finished blocks', () => {
    const clopen = weekFrames('2026-10-19', 2, (d) =>
      d === '2026-10-18' ? NIGHT : d === '2026-10-19' ? MORNING : null,
    );
    const kinds = (list: ReturnType<typeof findConflicts>) => list.map((c) => c.kind);
    expect(kinds(findConflicts(clopen, []))).toEqual(['short-sleep']);

    const found = findConflicts(frames, [
      block('during-shift', '2026-10-19', 480, 540),
      block('too-early', '2026-10-21', 480, 540),
      block('too-late', '2026-10-22', 1350, 1410),
      block('a', '2026-10-23', 600, 660),
      block('b', '2026-10-23', 630, 690),
      block('old', '2026-10-19', 480, 540, true),
    ]);
    expect(found.map((c) => [c.kind, c.blockIds.join('+')])).toEqual([
      ['shift', 'during-shift'],
      ['sleep', 'too-early'],
      ['sleep', 'too-late'],
      ['overlap', 'a+b'],
    ]);
    expect(found[1]?.message).toContain('10:20');
  });
});

describe('buildDemands', () => {
  const base = {
    dates: [
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ],
    today: '2026-10-21',
    quran: { setUp: true, revisionMinutes: 30, newMinutes: 20 },
    training: { lastWorkout: '2026-10-20', restDays: 1, minutes: 75 },
    study: { weeklyMinutes: 360, coveredMinutes: 120, sessionMinutes: 60 },
    game: { weeklyMinutes: 360, coveredMinutes: 360, sessionMinutes: 60 },
    mealPrep: { perWeek: 1, minutes: 60, coveredSessions: 0 },
  };

  it('orders demands by priority and sizes budgets by what is left', () => {
    const demands = buildDemands(base);
    expect(demands.map((d) => d.key)).toEqual([
      'quran-revision',
      'training',
      'quran-new',
      'study',
      'meal-prep',
    ]);
    expect(demands[0]?.daily?.dates).toEqual(base.dates.slice(2));
    expect(demands.find((d) => d.key === 'training')?.daily?.dates).toEqual([
      '2026-10-22',
      '2026-10-24',
    ]);
    expect(demands.find((d) => d.key === 'study')?.weekly?.minutes).toBe(240);
  });

  it('starts training today when it is due and skips the Quran until set up', () => {
    expect(trainingDates('2026-10-17', '2026-10-21', 1, '2026-10-25')).toEqual([
      '2026-10-21',
      '2026-10-23',
      '2026-10-25',
    ]);
    const keys = buildDemands({ ...base, quran: { ...base.quran, setUp: false } }).map(
      (d) => d.key,
    );
    expect(keys).not.toContain('quran-revision');
  });
});
