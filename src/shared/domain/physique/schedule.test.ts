import { describe, expect, it } from 'vitest';
import { trainingCalendar, trainingStatus } from './schedule';

const T = '2026-10-15';

describe('every-other-day training', () => {
  it('is due with no history', () => {
    expect(trainingStatus(null, T)).toEqual({ kind: 'due', date: T });
  });
  it('rests the day after a session', () => {
    expect(trainingStatus('2026-10-14', T)).toEqual({ kind: 'rest', next: '2026-10-16' });
  });
  it('is due two days after a session', () => {
    expect(trainingStatus('2026-10-13', T)).toEqual({ kind: 'due', date: T });
  });
  it('is overdue (not doubled up) after a missed session', () => {
    expect(trainingStatus('2026-10-10', T)).toEqual({ kind: 'overdue', date: T, daysLate: 3 });
  });
  it('knows when today is done', () => {
    expect(trainingStatus(T, T)).toEqual({ kind: 'trained-today', next: '2026-10-17' });
  });
  it('supports a different number of rest days', () => {
    expect(trainingStatus('2026-10-13', T, 2)).toEqual({ kind: 'rest', next: '2026-10-16' });
  });

  it('lays out past and planned days', () => {
    const cal = trainingCalendar(['2026-10-09', '2026-10-11'], '2026-10-09', '2026-10-19', T);
    expect(cal.map((d) => d.kind)).toEqual([
      'trained', // 9
      'rest', // 10
      'trained', // 11
      'rest', // 12
      'missed', // 13 (was due)
      'rest', // 14 (the rhythm continues)
      'planned', // 15 today — due
      'planned-rest', // 16
      'planned', // 17
      'planned-rest', // 18
      'planned', // 19
    ]);
  });

  it('marks missed sessions on the rhythm, not every day after a miss', () => {
    const cal = trainingCalendar(['2026-10-03'], '2026-10-04', '2026-10-12', T);
    expect(cal.filter((d) => d.kind === 'missed').map((d) => d.date)).toEqual([
      '2026-10-05',
      '2026-10-07',
      '2026-10-09',
      '2026-10-11',
    ]);
  });

  it('plans from the next due date when today is a rest day', () => {
    const cal = trainingCalendar(['2026-10-14'], T, '2026-10-18', T);
    expect(cal.map((d) => d.kind)).toEqual(['planned-rest', 'planned', 'planned-rest', 'planned']);
  });
});
