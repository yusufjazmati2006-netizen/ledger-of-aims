import { dayFrame, type ShiftSpan } from '@shared/domain/planner/freeTime';
import { plannerRules } from '@shared/domain/planner/rules';
import { trainingStatus } from '@shared/domain/physique/schedule';
import type { NotifyState, PendingNotification } from '@shared/domain/notifications/schedule';
import { spanOf } from '@shared/domain/time/clockTime';
import { addDays, startOfWeek, type LocalDate } from '@shared/domain/time/localDate';
import type { RepoContext } from '../db/repositories/context';
import { getSettings } from '../db/repositories/settings';
import { listShiftDays, listShiftTypes } from '../db/repositories/shifts';
import { listPages } from '../db/repositories/quran';
import { listPlanBlocks } from '../db/repositories/plan';
import { runningTimer } from '../db/repositories/game';

/** Everything the reminder rules need, read from the database at one instant. */
export function gatherNotifyState(ctx: RepoContext): NotifyState {
  const now = ctx.clock.now();
  const today = ctx.clock.today();
  const db = ctx.db;
  const settings = {
    general: getSettings(ctx, 'general'),
    planner: getSettings(ctx, 'planner'),
    physique: getSettings(ctx, 'physique'),
    game: getSettings(ctx, 'game'),
  };
  const exists = (sql: string, ...args: string[]) =>
    db.prepare<string[], { one: number }>(sql).get(...args) !== undefined;

  // Shifts around today shape when reminders may arrive.
  const spans = new Map<string, ShiftSpan | null>();
  for (const t of listShiftTypes(ctx))
    spans.set(t.id, t.start && t.end ? spanOf(t.start, t.end) : null);
  const assigned = new Map(
    listShiftDays(ctx, addDays(today, -1), addDays(today, 1)).map((d) => [d.date, d.shiftTypeId]),
  );
  const shiftOn = (date: LocalDate) => {
    const id = assigned.get(date);
    return id ? (spans.get(id) ?? null) : null;
  };
  const frame = dayFrame(today, shiftOn, plannerRules(settings.planner));

  const lastWorkout =
    db
      .prepare<[], { date: string }>(
        'SELECT w.date FROM workouts w WHERE EXISTS (SELECT 1 FROM workout_sets s WHERE s.workout_id = w.id) ORDER BY w.date DESC LIMIT 1',
      )
      .get()?.date ?? null;
  const training = trainingStatus(lastWorkout, today, settings.physique.restDays);

  const weekStart = startOfWeek(today, settings.general.weekStartsOn);
  const timer = runningTimer(ctx);

  return {
    today,
    minute: now.getHours() * 60 + now.getMinutes(),
    dueRevisionPages: listPages(ctx).records.filter(
      (r) => r.state !== 'not_started' && r.dueOn !== null && r.dueOn <= today,
    ).length,
    revisedToday: exists('SELECT 1 AS one FROM quran_reviews WHERE reviewed_on = ? LIMIT 1', today),
    weighedToday: exists('SELECT 1 AS one FROM weigh_ins WHERE date = ?', today),
    trainingDue: training.kind === 'due' || training.kind === 'overdue',
    deadlines: db
      .prepare<[string, string], { id: string; title: string; due_date: string }>(
        `SELECT a.id, a.title, a.due_date FROM assessments a
         WHERE a.due_date BETWEEN ? AND ? AND a.status NOT IN ('submitted', 'graded')`,
      )
      .all(today, addDays(today, 60))
      .map((r) => ({ id: r.id, title: r.title, due: r.due_date })),
    weekEndsToday: addDays(weekStart, 6) === today,
    reviewDone: exists(
      'SELECT 1 AS one FROM weekly_reviews WHERE week_start = ? AND completed_at IS NOT NULL',
      weekStart,
    ),
    blocks: listPlanBlocks(ctx, today, today).map((b) => ({
      id: b.id,
      title: b.title || 'Planned block',
      start: b.start,
      done: b.done,
    })),
    runningTimer: timer
      ? {
          id: timer.id,
          note: timer.note,
          minutesRunning: (now.getTime() - new Date(timer.startedAt).getTime()) / 60_000,
        }
      : null,
    longTimerHours: settings.game.longTimerHours,
    frame,
  };
}

export function sentKeys(ctx: RepoContext): Set<string> {
  // Keys older than two months can never recur (they contain dates or ids), so prune.
  const cutoff = new Date(ctx.clock.now().getTime() - 60 * 86_400_000).toISOString();
  ctx.db.prepare('DELETE FROM notification_log WHERE sent_at < ?').run(cutoff);
  return new Set(
    ctx.db
      .prepare<[], { key: string }>('SELECT key FROM notification_log')
      .all()
      .map((r) => r.key),
  );
}

export function recordSent(ctx: RepoContext, n: PendingNotification): void {
  ctx.db
    .prepare('INSERT OR IGNORE INTO notification_log (key, title, sent_at) VALUES (?, ?, ?)')
    .run(n.key, n.title, ctx.clock.nowIso());
}
