-- Weekly review: one row per week, keyed by the week's first day.
CREATE TABLE weekly_reviews (
  week_start   TEXT PRIMARY KEY,
  priorities   TEXT NOT NULL DEFAULT '[]', -- JSON array of up to three strings (for the next week)
  went_well    TEXT NOT NULL DEFAULT '',
  went_badly   TEXT NOT NULL DEFAULT '',
  adjust       TEXT NOT NULL DEFAULT '',
  metrics      TEXT NOT NULL DEFAULT '{}', -- JSON snapshot taken when the review was saved
  completed_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE habits (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  goal_id     TEXT REFERENCES goals(id) ON DELETE SET NULL,
  grace_days  INTEGER NOT NULL DEFAULT 1 CHECK (grace_days BETWEEN 0 AND 6),
  archived    INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE habit_checks (
  habit_id   TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (habit_id, date)
);
CREATE INDEX habit_checks_date ON habit_checks(date);
