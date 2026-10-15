-- 001_core: settings, goals, milestones, shifts, weigh-ins.

CREATE TABLE settings (
  namespace  TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE goals (
  id          TEXT PRIMARY KEY CHECK (id IN ('quran', 'game', 'degree', 'physique')),
  title       TEXT NOT NULL,
  subtitle    TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE milestones (
  id           TEXT PRIMARY KEY,
  goal_id      TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  target_date  TEXT NOT NULL,
  target_value REAL,
  unit         TEXT,
  kind         TEXT NOT NULL DEFAULT 'milestone' CHECK (kind IN ('milestone', 'hard-stop')),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  notes        TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX milestones_goal ON milestones(goal_id, sort_order);
CREATE INDEX milestones_date ON milestones(target_date);

CREATE TABLE shift_types (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  start_time TEXT,
  end_time   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE shift_days (
  date          TEXT PRIMARY KEY,
  shift_type_id TEXT NOT NULL REFERENCES shift_types(id) ON DELETE CASCADE
);

CREATE TABLE weigh_ins (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL UNIQUE,
  weight_kg  REAL NOT NULL CHECK (weight_kg > 0),
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
