import { describe, expect, it } from 'vitest';
import { createTestContext } from './testing';

/**
 * The queries behind every screen's date ranges must search an index, not scan the
 * whole table — years of daily data should not slow the app down.
 */
const HOT_QUERIES: readonly [string, string][] = [
  ['weigh-ins by date', "SELECT * FROM weigh_ins WHERE date BETWEEN '2026-01-01' AND '2026-12-31'"],
  [
    'reviews by day',
    "SELECT * FROM quran_reviews WHERE reviewed_on BETWEEN '2026-01-01' AND '2026-12-31'",
  ],
  ['pages due', "SELECT * FROM quran_pages WHERE due_on <= '2026-10-15'"],
  ['workouts by date', "SELECT * FROM workouts WHERE date BETWEEN '2026-01-01' AND '2026-12-31'"],
  ['sets of a workout', "SELECT * FROM workout_sets WHERE workout_id = 'x'"],
  ['food by day', "SELECT * FROM food_entries WHERE date = '2026-10-15'"],
  [
    'meal plan by day',
    "SELECT * FROM meal_plan_entries WHERE date BETWEEN '2026-10-12' AND '2026-10-18'",
  ],
  ['prep sessions', "SELECT * FROM prep_sessions WHERE date BETWEEN '2026-10-12' AND '2026-10-18'"],
  [
    'study by date',
    "SELECT * FROM study_sessions WHERE date BETWEEN '2026-10-12' AND '2026-10-18'",
  ],
  ['plan by date', "SELECT * FROM plan_blocks WHERE date BETWEEN '2026-10-12' AND '2026-10-18'"],
  [
    'time entries',
    "SELECT * FROM time_entries WHERE started_at < '2026-10-19' AND (ended_at IS NULL OR ended_at > '2026-10-12')",
  ],
  ['running timer', 'SELECT * FROM time_entries WHERE ended_at IS NULL'],
  ['habit ticks', "SELECT * FROM habit_checks WHERE date BETWEEN '2025-10-15' AND '2026-10-15'"],
  ['devlog', 'SELECT * FROM devlog_entries ORDER BY date DESC'],
  ['shifts', "SELECT * FROM shift_days WHERE date BETWEEN '2026-10-12' AND '2026-10-18'"],
  ['deadlines', "SELECT * FROM assessments WHERE due_date BETWEEN '2026-10-15' AND '2026-12-15'"],
];

describe('query plans', () => {
  it.each(HOT_QUERIES)('%s uses an index', (_name, sql) => {
    const ctx = createTestContext();
    const plan = ctx.db
      .prepare<[], { detail: string }>(`EXPLAIN QUERY PLAN ${sql}`)
      .all()
      .map((r) => r.detail)
      .join(' | ');
    expect(plan).toMatch(/USING (COVERING )?INDEX|PRIMARY KEY|INTEGER PRIMARY KEY/);
    expect(plan).not.toMatch(/^SCAN \w+$/);
  });
});
