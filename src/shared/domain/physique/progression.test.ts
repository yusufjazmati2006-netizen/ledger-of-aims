import { describe, expect, it } from 'vitest';
import {
  estimatedOneRepMax,
  isPersonalRecord,
  personalRecords,
  suggestNext,
  type ExerciseRule,
} from './progression';

const squat: ExerciseRule = { repMin: 6, repMax: 10, setsTarget: 3, incrementKg: 2.5 };
const session = (date: string, load: number, reps: number[]) => ({
  date,
  sets: reps.map((r) => ({ reps: r, loadKg: load })),
});

describe('double progression', () => {
  it('starts conservatively with no history', () => {
    const s = suggestNext(squat, []);
    expect(s).toMatchObject({ kind: 'start', loadKg: null, targetReps: [8, 8, 8] });
  });

  it('adds a rep to the weakest set while below the top of the range', () => {
    const s = suggestNext(squat, [session('2026-10-15', 80, [10, 9, 7])]);
    expect(s).toMatchObject({ kind: 'add-reps', loadKg: 80, targetReps: [10, 9, 8] });
  });

  it('adds load once every set reaches the top', () => {
    const s = suggestNext(squat, [session('2026-10-15', 80, [10, 10, 10])]);
    expect(s).toMatchObject({ kind: 'add-load', loadKg: 82.5, targetReps: [6, 6, 6] });
  });

  it('does not add load when fewer sets than planned were done', () => {
    expect(suggestNext(squat, [session('2026-10-15', 80, [10, 10])]).kind).toBe('add-reps');
  });

  it('ignores warm-up sets at lighter loads', () => {
    const s = suggestNext(squat, [
      {
        date: '2026-10-15',
        sets: [{ reps: 5, loadKg: 40 }, ...session('x', 80, [10, 10, 10]).sets],
      },
    ]);
    expect(s.kind).toBe('add-load');
  });

  it('suggests a 10% deload after two sessions below the range at the same load', () => {
    const s = suggestNext(squat, [
      session('2026-10-15', 100, [5, 5, 4]),
      session('2026-10-17', 100, [5, 4, 4]),
    ]);
    expect(s).toMatchObject({ kind: 'deload', loadKg: 90 });
  });

  it('rounds deloads to the load increment', () => {
    const ohp: ExerciseRule = { repMin: 6, repMax: 10, setsTarget: 3, incrementKg: 2.5 };
    const s = suggestNext(ohp, [session('a', 47.5, [4, 4, 4]), session('b', 47.5, [5, 4, 4])]);
    expect(s.loadKg).toBe(42.5);
  });
});

describe('personal records', () => {
  it('estimates one-rep maxima with Epley', () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100);
    expect(estimatedOneRepMax(100, 10)).toBeCloseTo(133.33, 2);
    expect(estimatedOneRepMax(100, 0)).toBe(0);
  });

  it('finds the best e1RM, heaviest set and best volume', () => {
    const history = [session('2026-10-15', 80, [10, 10, 10]), session('2026-10-17', 90, [6, 5, 5])];
    const pr = personalRecords(history);
    expect(pr.heaviest).toEqual({ loadKg: 90, reps: 6, date: '2026-10-17' });
    expect(pr.bestE1rm?.date).toBe('2026-10-17'); // 90 × 6 → 108 beats 80 × 10 → 106.7
    expect(pr.bestVolume).toEqual({ value: 2400, date: '2026-10-15' });
  });

  it('flags a set that beats every earlier estimate', () => {
    const history = [session('2026-10-15', 80, [10, 10, 10])];
    expect(isPersonalRecord({ loadKg: 85, reps: 10 }, history)).toBe(true);
    expect(isPersonalRecord({ loadKg: 80, reps: 10 }, history)).toBe(false);
    expect(isPersonalRecord({ loadKg: 20, reps: 5 }, [])).toBe(true);
  });
});
