import { describe, expect, it } from 'vitest';
import { parseQuickLog, quickDuration } from './parse';

const cmd = (text: string, unit: 'kg' | 'lb' = 'kg') => {
  const r = parseQuickLog(text, unit);
  return r.status === 'command' ? r.command : r.status;
};

describe('parseQuickLog', () => {
  it('reads weights in the display unit or an explicit one', () => {
    expect(cmd('w 72.4')).toEqual({ kind: 'weight', kg: 72.4 });
    expect(cmd('W 72,4')).toEqual({ kind: 'weight', kg: 72.4 });
    expect(cmd('w 160', 'lb')).toEqual({ kind: 'weight', kg: 72.57 });
    expect(cmd('w 160lb')).toEqual({ kind: 'weight', kg: 72.57 });
    expect(cmd('w 72.4 kg', 'lb')).toEqual({ kind: 'weight', kg: 72.4 });
    expect(cmd('w')).toBe('incomplete');
    expect(cmd('w 12')).toBe('incomplete');
  });

  it('reads pages to learn by count or range', () => {
    expect(cmd('p 3')).toEqual({ kind: 'learn', count: 3 });
    expect(cmd('p 322-324')).toEqual({ kind: 'learn-range', from: 322, to: 324 });
    expect(cmd('p 322')).toBe('incomplete');
    expect(cmd('p 0')).toBe('incomplete');
    expect(cmd('p 324-322')).toBe('incomplete');
  });

  it('reads reviews of a range, a single page or a juz', () => {
    expect(cmd('r 1-20 solid')).toEqual({
      kind: 'review',
      target: { from: 1, to: 20 },
      rating: 'solid',
    });
    expect(cmd('r 45 forgot')).toEqual({
      kind: 'review',
      target: { from: 45, to: 45 },
      rating: 'forgotten',
    });
    expect(cmd('r j17 shaky')).toEqual({ kind: 'review', target: { juz: 17 }, rating: 'shaky' });
    expect(cmd('r juz 30 weak')).toEqual({ kind: 'review', target: { juz: 30 }, rating: 'shaky' });
    expect(cmd('r 1-20')).toBe('incomplete');
    expect(cmd('r 1-20 great')).toBe('incomplete');
    expect(cmd('r j31 solid')).toBe('incomplete');
    expect(cmd('r 600-610 solid')).toBe('incomplete');
  });

  it('reads study and game time with notes', () => {
    expect(cmd('s 1.5h essay plan')).toEqual({ kind: 'study', minutes: 90, note: 'essay plan' });
    expect(cmd('s 2')).toEqual({ kind: 'study', minutes: 120, note: '' });
    expect(cmd('g 45 tilemap')).toEqual({ kind: 'game-time', minutes: 45, note: 'tilemap' });
    expect(cmd('g 1h 30m')).toEqual({ kind: 'game-time', minutes: 90, note: '' });
    expect(cmd('g start paddles')).toEqual({ kind: 'timer-start', note: 'paddles' });
    expect(cmd('g STOP')).toEqual({ kind: 'timer-stop' });
    expect(cmd('s')).toBe('incomplete');
    expect(cmd('g soon')).toBe('incomplete');
  });

  it('reads workout and habit commands, and leaves anything else to search', () => {
    expect(cmd('wo')).toEqual({ kind: 'workout' });
    expect(cmd('h Phone')).toEqual({ kind: 'habit', query: 'phone' });
    expect(cmd('weekly review')).toBe('none');
    expect(cmd('planner')).toBe('none');
    expect(cmd('   ')).toBe('none');
  });
});

describe('quickDuration', () => {
  it('treats small bare numbers as hours and larger ones as minutes', () => {
    expect(quickDuration('1.5')).toBe(90);
    expect(quickDuration('9')).toBe(540);
    expect(quickDuration('10')).toBe(10);
    expect(quickDuration('45')).toBe(45);
    expect(quickDuration('1:30')).toBe(90);
  });
});
