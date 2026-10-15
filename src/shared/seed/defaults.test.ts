import { describe, expect, it } from 'vitest';
import { isLocalDate } from '../domain/time/localDate';
import { PLAN_START_DATE, SEED_GOALS, SEED_MILESTONES, SEED_SHIFT_TYPES } from './defaults';

describe('seed defaults', () => {
  it('starts the plan on 15 October 2026', () => {
    expect(PLAN_START_DATE).toBe('2026-10-15');
  });

  it('defines the four goals', () => {
    expect(SEED_GOALS.map((g) => g.id).sort()).toEqual(['degree', 'game', 'physique', 'quran']);
  });

  it('uses valid dates, all after the plan start', () => {
    for (const m of SEED_MILESTONES) {
      expect(isLocalDate(m.targetDate), m.title).toBe(true);
      expect(m.targetDate > PLAN_START_DATE, m.title).toBe(true);
    }
  });

  it('matches the Quran milestones in the brief', () => {
    const quran = SEED_MILESTONES.filter((m) => m.goalId === 'quran');
    expect(quran.map((m) => [m.targetValue, m.targetDate])).toEqual([
      [20, '2027-03-04'],
      [25, '2027-07-22'],
      [30, '2027-12-09'],
    ]);
  });

  it('matches the physique checkpoints (≈4.9 kg per year)', () => {
    const phys = SEED_MILESTONES.filter((m) => m.goalId === 'physique');
    expect(phys.map((m) => m.targetValue)).toEqual([71.3, 76.2, 81.1, 86]);
    for (let i = 1; i < phys.length; i++) {
      expect((phys[i]?.targetValue ?? 0) - (phys[i - 1]?.targetValue ?? 0)).toBeCloseTo(4.9, 5);
    }
  });

  it('includes the game roadmap with its hard stop', () => {
    const game = SEED_MILESTONES.filter((m) => m.goalId === 'game');
    expect(game).toHaveLength(6);
    expect(game.find((m) => m.kind === 'hard-stop')?.targetDate).toBe('2029-10-31');
    expect(game.find((m) => m.title === 'Release')?.targetDate).toBe('2028-11-30');
  });

  it('defines the two cafe shifts plus a day off', () => {
    expect(SEED_SHIFT_TYPES.map((s) => [s.id, s.start, s.end])).toEqual([
      ['morning', '07:30', '16:30'],
      ['night', '16:00', '01:00'],
      ['off', null, null],
    ]);
  });
});
