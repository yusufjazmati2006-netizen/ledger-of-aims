/**
 * Which reminders are due right now. Pure: the main process gathers the state once a
 * minute, calls this, sends what comes back and records each key so nothing repeats.
 *
 * A scheduled reminder fires at its time or at the first moment after it that is not
 * held — so a 08:00 revision reminder on the morning after a night shift waits until
 * you are up (10:20 by default), and nothing arrives in quiet hours. Each reminder is
 * still conditional: it is skipped once the thing is done.
 */
import { toMinutes } from '../time/clockTime';
import { diffDays, type LocalDate } from '../time/localDate';
import type { Interval } from '../planner/intervals';
import type { NotificationSettings } from '../../schemas/settings';

export interface NotifyState {
  today: LocalDate;
  /** Minutes after local midnight. */
  minute: number;
  dueRevisionPages: number;
  revisedToday: boolean;
  weighedToday: boolean;
  /** True when a session is due or overdue and none was logged today. */
  trainingDue: boolean;
  deadlines: readonly { id: string; title: string; due: LocalDate }[];
  weekEndsToday: boolean;
  reviewDone: boolean;
  blocks: readonly { id: string; title: string; start: number; done: boolean }[];
  runningTimer: { id: string; minutesRunning: number; note: string } | null;
  longTimerHours: number;
  /** Today's shift-aware frame; null when the planner rules should not apply. */
  frame: { wake: number; bedtime: number; busy: readonly Interval[] } | null;
}

export interface PendingNotification {
  key: string;
  title: string;
  body: string;
  /** Where clicking it takes you. */
  path: string;
}

export function inQuietHours(minute: number, start: string, end: string): boolean {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return false;
  return s < e ? minute >= s && minute < e : minute >= s || minute < e;
}

/** Why a reminder would be held now, or null if it may be sent. */
export function holdReason(
  state: Pick<NotifyState, 'minute' | 'frame'>,
  prefs: NotificationSettings,
): 'quiet' | 'shift' | 'sleep' | null {
  if (inQuietHours(state.minute, prefs.quietStart, prefs.quietEnd)) return 'quiet';
  if (prefs.respectShifts && state.frame) {
    const m = state.minute;
    if (state.frame.busy.some((b) => m >= b.start && m < b.end)) return 'shift';
    if (m < state.frame.wake || m >= state.frame.bedtime) return 'sleep';
  }
  return null;
}

const pages = (n: number) => `${n} page${n === 1 ? '' : 's'}`;

export function dueNotifications(
  state: NotifyState,
  prefs: NotificationSettings,
  sent: ReadonlySet<string>,
): PendingNotification[] {
  if (!prefs.enabled) return [];
  const out: PendingNotification[] = [];
  const held = holdReason(state, prefs) !== null;
  const quiet = inQuietHours(state.minute, prefs.quietStart, prefs.quietEnd);
  const at = (time: string) => state.minute >= toMinutes(time);
  const add = (n: PendingNotification) => {
    if (!sent.has(n.key)) out.push(n);
  };
  const d = state.today;

  if (!held) {
    if (
      prefs.revision.enabled &&
      at(prefs.revision.time) &&
      state.dueRevisionPages > 0 &&
      !state.revisedToday
    ) {
      add({
        key: `revision:${d}`,
        title: 'Murajaʿah is due',
        body: `${pages(state.dueRevisionPages)} to revise today.`,
        path: '/quran/revision',
      });
    }
    if (prefs.weighIn.enabled && at(prefs.weighIn.time) && !state.weighedToday) {
      add({
        key: `weigh-in:${d}`,
        title: 'Weigh in',
        body: 'One minute, before breakfast if you can — it keeps the trend honest.',
        path: '/physique',
      });
    }
    if (prefs.training.enabled && at(prefs.training.time) && state.trainingDue) {
      add({
        key: `training:${d}`,
        title: 'Training day',
        body: 'Today’s full-body session is due.',
        path: '/physique/training',
      });
    }
    if (prefs.deadlines.enabled && at(prefs.deadlines.time)) {
      for (const a of state.deadlines) {
        const days = diffDays(d, a.due);
        if (!prefs.deadlines.daysBefore.includes(days)) continue;
        add({
          key: `deadline:${a.id}:${days}`,
          title:
            days === 0
              ? `Due today: ${a.title}`
              : `${a.title} is due in ${days} day${days === 1 ? '' : 's'}`,
          body: days === 0 ? 'Submit before the deadline.' : 'Plan a session for it this week.',
          path: '/degree',
        });
      }
    }
    if (
      prefs.weeklyReview.enabled &&
      at(prefs.weeklyReview.time) &&
      state.weekEndsToday &&
      !state.reviewDone
    ) {
      add({
        key: `review:${d}`,
        title: 'Weekly review',
        body: 'Ten minutes: the week in figures, and three priorities for the next.',
        path: '/review',
      });
    }
  }

  // Plan blocks are reminders you asked for by planning them; only quiet hours hold them.
  if (prefs.planBlocks.enabled && !quiet) {
    for (const b of state.blocks) {
      if (b.done) continue;
      const lead = prefs.planBlocks.leadMinutes;
      if (state.minute >= b.start - lead && state.minute < b.start + 5) {
        add({
          key: `block:${b.id}:${d}`,
          title:
            lead > 0 && state.minute < b.start
              ? `In ${b.start - state.minute} min: ${b.title}`
              : `Now: ${b.title}`,
          body: 'From your plan for today.',
          path: '/',
        });
      }
    }
  }

  if (
    prefs.longTimer.enabled &&
    !quiet &&
    state.runningTimer &&
    state.runningTimer.minutesRunning >= state.longTimerHours * 60
  ) {
    add({
      key: `timer:${state.runningTimer.id}`,
      title: 'Game timer still running',
      body: `It has run for over ${state.longTimerHours} hours${state.runningTimer.note ? ` (“${state.runningTimer.note}”)` : ''}. Forgot to stop it?`,
      path: '/game/time',
    });
  }
  return out;
}
