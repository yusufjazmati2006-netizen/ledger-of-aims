import { minutesByDay } from '@shared/domain/game/time';
import { addDays, localDateOf, localMidnight, type LocalDate } from '@shared/domain/time/localDate';
import type { GoalId } from '@shared/schemas/common';
import type { Habit, HabitsData, WeekMetrics, WeeklyReview } from '@shared/schemas/review';
import { notFound } from '../../errors';
import { newId, type RepoContext } from './context';
import { listTime } from './game';

// ── Week metrics ────────────────────────────────────────────────────────────────

/** A local date for a stored value that is either a date or an ISO instant. */
const dayOf = (value: string): LocalDate =>
  value.length === 10 ? value : localDateOf(new Date(value));

export function weekMetrics(ctx: RepoContext, weekStart: LocalDate): WeekMetrics {
  const from = weekStart;
  const to = addDays(weekStart, 6);
  const db = ctx.db;
  const count = (sql: string) =>
    db.prepare<[string, string], { n: number | null }>(sql).get(from, to)?.n ?? 0;

  const weights = db
    .prepare<[string, string], { weight_kg: number }>(
      'SELECT weight_kg FROM weigh_ins WHERE date BETWEEN ? AND ? ORDER BY date',
    )
    .all(from, to);
  const first = weights[0]?.weight_kg;
  const last = weights[weights.length - 1]?.weight_kg;

  const entries = listTime(
    ctx,
    localMidnight(from).toISOString(),
    localMidnight(addDays(to, 1)).toISOString(),
  );
  let gameMinutes = 0;
  for (const [day, minutes] of minutesByDay(entries, ctx.clock.now()))
    if (day >= from && day <= to) gameMinutes += minutes;
  const inWeek = (iso: string | null) => iso !== null && dayOf(iso) >= from && dayOf(iso) <= to;

  return {
    weekStart,
    quranPagesLearned: count(
      'SELECT COUNT(*) AS n FROM quran_pages WHERE learned_on BETWEEN ? AND ?',
    ),
    quranPagesRevised: count(
      'SELECT COUNT(*) AS n FROM quran_reviews WHERE reviewed_on BETWEEN ? AND ?',
    ),
    quranDaysRevised: count(
      'SELECT COUNT(DISTINCT reviewed_on) AS n FROM quran_reviews WHERE reviewed_on BETWEEN ? AND ?',
    ),
    weighIns: weights.length,
    weightChangeKg:
      weights.length >= 2 && first !== undefined && last !== undefined
        ? Math.round((last - first) * 10) / 10
        : null,
    workouts: count(
      'SELECT COUNT(DISTINCT w.date) AS n FROM workouts w WHERE w.date BETWEEN ? AND ? AND EXISTS (SELECT 1 FROM workout_sets s WHERE s.workout_id = w.id)',
    ),
    studyMinutes: count('SELECT SUM(minutes) AS n FROM study_sessions WHERE date BETWEEN ? AND ?'),
    gameMinutes: Math.round(gameMinutes),
    focusSessions: entries.filter((e) => e.focus && e.endedAt && inWeek(e.startedAt)).length,
    tasksFinished: db
      .prepare<[], { done_at: string | null }>(
        'SELECT done_at FROM roadmap_tasks WHERE done = 1 AND done_at IS NOT NULL',
      )
      .all()
      .filter((r) => inWeek(r.done_at)).length,
    devlogEntries: count('SELECT COUNT(*) AS n FROM devlog_entries WHERE date BETWEEN ? AND ?'),
    milestonesCompleted: db
      .prepare<[], { title: string; completed_at: string | null }>(
        'SELECT title, completed_at FROM milestones WHERE completed_at IS NOT NULL ORDER BY completed_at',
      )
      .all()
      .filter((r) => inWeek(r.completed_at))
      .map((r) => r.title),
    planBlocksDone: count(
      'SELECT COUNT(*) AS n FROM plan_blocks WHERE done = 1 AND date BETWEEN ? AND ?',
    ),
    planBlocksPlanned: count('SELECT COUNT(*) AS n FROM plan_blocks WHERE date BETWEEN ? AND ?'),
  };
}

// ── Weekly reviews ──────────────────────────────────────────────────────────────

interface ReviewRow {
  week_start: string;
  priorities: string;
  went_well: string;
  went_badly: string;
  adjust: string;
  metrics: string;
  completed_at: string | null;
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

const toReview = (r: ReviewRow): WeeklyReview => {
  const metrics = parseJson<Partial<WeekMetrics>>(r.metrics, {});
  return {
    weekStart: r.week_start,
    priorities: parseJson<unknown[]>(r.priorities, []).filter(
      (p): p is string => typeof p === 'string',
    ),
    wentWell: r.went_well,
    wentBadly: r.went_badly,
    adjust: r.adjust,
    metrics: metrics.weekStart ? (metrics as WeekMetrics) : null,
    completedAt: r.completed_at,
  };
};

export function getReview(ctx: RepoContext, weekStart: LocalDate): WeeklyReview | null {
  const row = ctx.db
    .prepare<[string], ReviewRow>('SELECT * FROM weekly_reviews WHERE week_start = ?')
    .get(weekStart);
  return row ? toReview(row) : null;
}

export function listReviews(ctx: RepoContext): WeeklyReview[] {
  return ctx.db
    .prepare<[], ReviewRow>('SELECT * FROM weekly_reviews ORDER BY week_start DESC')
    .all()
    .map(toReview);
}

export function saveReview(
  ctx: RepoContext,
  input: {
    weekStart: LocalDate;
    priorities: string[];
    wentWell: string;
    wentBadly: string;
    adjust: string;
    complete: boolean;
  },
): WeeklyReview {
  const now = ctx.clock.nowIso();
  const existing = getReview(ctx, input.weekStart);
  const priorities = JSON.stringify(input.priorities.map((p) => p.trim()).filter(Boolean));
  const metrics = input.complete
    ? JSON.stringify(weekMetrics(ctx, input.weekStart))
    : JSON.stringify(existing?.metrics ?? {});
  const completedAt = input.complete
    ? (existing?.completedAt ?? now)
    : (existing?.completedAt ?? null);
  ctx.db
    .prepare(
      `INSERT INTO weekly_reviews (week_start, priorities, went_well, went_badly, adjust, metrics, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(week_start) DO UPDATE SET priorities = excluded.priorities, went_well = excluded.went_well,
         went_badly = excluded.went_badly, adjust = excluded.adjust, metrics = excluded.metrics,
         completed_at = excluded.completed_at, updated_at = excluded.updated_at`,
    )
    .run(
      input.weekStart,
      priorities,
      input.wentWell,
      input.wentBadly,
      input.adjust,
      metrics,
      completedAt,
      now,
      now,
    );
  return getReview(ctx, input.weekStart) as WeeklyReview;
}

// ── Habits ──────────────────────────────────────────────────────────────────────

interface HabitRow {
  id: string;
  name: string;
  goal_id: GoalId | null;
  grace_days: number;
  archived: number;
  sort_order: number;
}

const toHabit = (r: HabitRow): Habit => ({
  id: r.id,
  name: r.name,
  goalId: r.goal_id,
  graceDays: r.grace_days,
  archived: r.archived === 1,
  sortOrder: r.sort_order,
});

export function habitsData(ctx: RepoContext, from: LocalDate, to: LocalDate): HabitsData {
  const habits = ctx.db
    .prepare<[], HabitRow>('SELECT * FROM habits ORDER BY archived, sort_order, created_at')
    .all()
    .map(toHabit);
  const checks: Record<string, string[]> = {};
  for (const h of habits) checks[h.id] = [];
  for (const row of ctx.db
    .prepare<[string, string], { habit_id: string; date: string }>(
      'SELECT habit_id, date FROM habit_checks WHERE date BETWEEN ? AND ? ORDER BY date',
    )
    .all(from, to)) {
    (checks[row.habit_id] ??= []).push(row.date);
  }
  return { habits, checks };
}

export function saveHabit(
  ctx: RepoContext,
  input: {
    id?: string;
    name: string;
    goalId: GoalId | null;
    graceDays: number;
    archived: boolean;
  },
): Habit {
  const now = ctx.clock.nowIso();
  const id = input.id ?? newId();
  if (input.id) {
    const r = ctx.db
      .prepare(
        'UPDATE habits SET name = ?, goal_id = ?, grace_days = ?, archived = ?, updated_at = ? WHERE id = ?',
      )
      .run(input.name, input.goalId, input.graceDays, input.archived ? 1 : 0, now, id);
    if (r.changes === 0) throw notFound('Habit', id);
  } else {
    const order =
      ctx.db.prepare<[], { n: number | null }>('SELECT MAX(sort_order) + 1 AS n FROM habits').get()
        ?.n ?? 0;
    ctx.db
      .prepare(
        'INSERT INTO habits (id, name, goal_id, grace_days, archived, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(id, input.name, input.goalId, input.graceDays, input.archived ? 1 : 0, order, now, now);
  }
  return toHabit(
    ctx.db.prepare<[string], HabitRow>('SELECT * FROM habits WHERE id = ?').get(id) as HabitRow,
  );
}

export function deleteHabit(ctx: RepoContext, id: string): void {
  if (ctx.db.prepare('DELETE FROM habits WHERE id = ?').run(id).changes === 0)
    throw notFound('Habit', id);
}

export function checkHabit(
  ctx: RepoContext,
  habitId: string,
  date: LocalDate,
  done: boolean,
): void {
  if (!ctx.db.prepare('SELECT 1 FROM habits WHERE id = ?').get(habitId))
    throw notFound('Habit', habitId);
  if (done) {
    ctx.db
      .prepare('INSERT OR IGNORE INTO habit_checks (habit_id, date, created_at) VALUES (?, ?, ?)')
      .run(habitId, date, ctx.clock.nowIso());
  } else {
    ctx.db.prepare('DELETE FROM habit_checks WHERE habit_id = ? AND date = ?').run(habitId, date);
  }
}
