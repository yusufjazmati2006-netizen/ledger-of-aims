import { describe, expect, it } from 'vitest';
import { notificationSettingsSchema } from '../../schemas/settings';
import { dayFrame, type ShiftSpan } from '../planner/freeTime';
import { dueNotifications, holdReason, inQuietHours, type NotifyState } from './schedule';

const prefs = notificationSettingsSchema.parse({});
const NIGHT: ShiftSpan = { start: 960, end: 1500 };
const MORNING: ShiftSpan = { start: 450, end: 990 };

const base: NotifyState = {
  today: '2026-10-15',
  minute: 9 * 60,
  dueRevisionPages: 12,
  revisedToday: false,
  weighedToday: false,
  trainingDue: false,
  deadlines: [],
  weekEndsToday: false,
  reviewDone: false,
  blocks: [],
  runningTimer: null,
  longTimerHours: 4,
  frame: null,
};
const keys = (state: NotifyState, sent: string[] = []) =>
  dueNotifications(state, prefs, new Set(sent)).map((n) => n.key);

describe('quiet hours and holds', () => {
  it('handles quiet hours across midnight', () => {
    expect(inQuietHours(23 * 60, '22:30', '07:00')).toBe(true);
    expect(inQuietHours(6 * 60, '22:30', '07:00')).toBe(true);
    expect(inQuietHours(7 * 60, '22:30', '07:00')).toBe(false);
    expect(inQuietHours(13 * 60, '12:00', '14:00')).toBe(true);
    expect(inQuietHours(13 * 60, '12:00', '12:00')).toBe(false);
  });

  it('holds reminders during a shift and until you are up after a night shift', () => {
    const afterNight = dayFrame('2026-10-16', (d) => (d === '2026-10-15' ? NIGHT : null));
    expect(holdReason({ minute: 9 * 60, frame: afterNight }, prefs)).toBe('sleep');
    expect(holdReason({ minute: 10 * 60 + 20, frame: afterNight }, prefs)).toBeNull();
    const morning = dayFrame('2026-10-16', (d) => (d === '2026-10-16' ? MORNING : null));
    expect(holdReason({ minute: 12 * 60, frame: morning }, prefs)).toBe('shift');
    expect(
      holdReason({ minute: 12 * 60, frame: morning }, { ...prefs, respectShifts: false }),
    ).toBeNull();
  });
});

describe('dueNotifications', () => {
  it('sends due reminders once, only when still relevant', () => {
    expect(keys(base)).toEqual(['revision:2026-10-15', 'weigh-in:2026-10-15']);
    expect(keys(base, ['revision:2026-10-15'])).toEqual(['weigh-in:2026-10-15']);
    expect(keys({ ...base, revisedToday: true, weighedToday: true })).toEqual([]);
    expect(keys({ ...base, minute: 7 * 60 + 15 })).toEqual([]); // before 07:30
  });

  it('fires a held reminder at the first moment it is allowed', () => {
    const afterNight = dayFrame('2026-10-15', (d) => (d === '2026-10-14' ? NIGHT : null));
    expect(keys({ ...base, frame: afterNight, minute: 9 * 60 })).toEqual([]);
    expect(keys({ ...base, frame: afterNight, minute: 10 * 60 + 20 })).toContain(
      'revision:2026-10-15',
    );
  });

  it('nothing in quiet hours, and nothing at all when switched off', () => {
    expect(keys({ ...base, minute: 23 * 60 })).toEqual([]);
    expect(dueNotifications(base, { ...prefs, enabled: false }, new Set())).toEqual([]);
    expect(
      dueNotifications(
        base,
        { ...prefs, revision: { enabled: false, time: '08:00' } },
        new Set(),
      ).map((n) => n.key),
    ).toEqual(['weigh-in:2026-10-15']);
  });

  it('counts down to deadlines on the chosen days', () => {
    const deadline = { id: 'a1', title: 'Marketing essay', due: '2026-10-18' };
    const sent = ['revision:2026-10-15', 'weigh-in:2026-10-15'];
    expect(keys({ ...base, deadlines: [deadline] }, sent)).toEqual(['deadline:a1:3']);
    expect(keys({ ...base, deadlines: [{ ...deadline, due: '2026-10-19' }] }, sent)).toEqual([]);
    const today = dueNotifications(
      { ...base, deadlines: [{ ...deadline, due: '2026-10-15' }] },
      prefs,
      new Set(sent),
    );
    expect(today[0]?.title).toBe('Due today: Marketing essay');
  });

  it('reminds before planned blocks, about the review, training and a forgotten timer', () => {
    const state: NotifyState = {
      ...base,
      revisedToday: true,
      weighedToday: true,
      minute: 19 * 60 + 5,
      trainingDue: true,
      weekEndsToday: true,
      blocks: [
        { id: 'b1', title: 'Study', start: 19 * 60 + 10, done: false },
        { id: 'b2', title: 'Later', start: 21 * 60, done: false },
      ],
      runningTimer: { id: 't1', minutesRunning: 5 * 60, note: 'paddles' },
    };
    const due = dueNotifications(state, prefs, new Set());
    expect(due.map((n) => n.key)).toEqual([
      'training:2026-10-15',
      'review:2026-10-15',
      'block:b1:2026-10-15',
      'timer:t1',
    ]);
    expect(due[2]?.title).toBe('In 5 min: Study');
  });
});
