import { describe, expect, it } from 'vitest';
import { candidates, pack, type TodayInputs } from './prioritise';

const base: TodayInputs = {
  quran: {
    dueCount: 12,
    minutesPerPage: 3,
    revisionMinutes: 30,
    newMinutes: 20,
    verdict: 'on-track',
    deficitPages: 0,
    revisedToday: false,
    learnedToday: false,
    revisionStreakAtRisk: false,
  },
  training: { status: { kind: 'due', date: '2026-10-15' }, minutes: 75 },
  weighedToday: false,
  deadline: null,
  study: { behindMinutes: 240, sessionMinutes: 60 },
  game: { task: 'Finish the tutorial', behindMinutes: 360, sessionMinutes: 60 },
  habitsAtRisk: [],
};

describe('today candidates', () => {
  it('ranks due revision first and sizes it to the pages due', () => {
    const list = candidates(base);
    // 82 revision · 70 weigh-in · 68 training · 63 game (6 h behind) · 60 study · 58 new pages
    expect(list.map((c) => c.id)).toEqual([
      'quran-revision',
      'weigh-in',
      'training',
      'game',
      'study',
      'quran-new',
    ]);
    expect(list[0]).toMatchObject({ id: 'quran-revision', minutes: 30, title: 'Revise 12 pages' });
  });

  it('raises an imminent deadline above everything and drops finished work', () => {
    const list = candidates({
      ...base,
      quran: { ...base.quran!, revisedToday: true, learnedToday: true },
      weighedToday: true,
      training: { status: { kind: 'rest', next: '2026-10-16' }, minutes: 75 },
      deadline: { title: 'Marketing essay', urgency: 'imminent', label: 'Due in 2 days' },
    });
    expect(list[0]).toMatchObject({ id: 'deadline', title: 'Work on Marketing essay' });
    expect(list.map((c) => c.id)).not.toContain('quran-revision');
    expect(list.map((c) => c.id)).not.toContain('study');
    expect(list.map((c) => c.id)).not.toContain('training');
  });

  it('pushes new pages up when behind the plan', () => {
    const behind = candidates({
      ...base,
      quran: { ...base.quran!, verdict: 'behind', deficitPages: -6 },
    });
    expect(behind.find((c) => c.id === 'quran-new')).toMatchObject({
      score: 78,
      reason: '6 pages behind the plan',
    });
  });
});

describe('pack', () => {
  it('fits the highest-scoring actions into the time available, shortening the last', () => {
    const { now, later, usedMinutes } = pack(candidates(base), 45);
    expect(now.map((c) => [c.id, c.minutes])).toEqual([
      ['quran-revision', 30],
      ['weigh-in', 1],
      ['quran-new', 14],
    ]);
    // Training, game and study need at least 25 minutes; new pages fit the last 14.
    expect(usedMinutes).toBe(45);
    expect(later.map((c) => c.id)).toContain('training');
  });

  it('shortens a flexible action down to its minimum when it is the best remaining use', () => {
    const { now } = pack(candidates({ ...base, weighedToday: true, quran: null }), 50);
    expect(now).toEqual([expect.objectContaining({ id: 'training', minutes: 50 })]);
  });

  it('never lets a long action crowd out a one-minute one', () => {
    const { now } = pack(candidates(base), 15);
    expect(now.map((c) => [c.id, c.minutes])).toEqual([
      ['quran-revision', 14],
      ['weigh-in', 1],
    ]);
  });

  it('handles no time at all', () => {
    expect(pack(candidates(base), 0).now).toEqual([]);
  });
});
