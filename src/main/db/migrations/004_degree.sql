-- 004_degree: degree structure (years → modules → assessments), study time, and the
-- generic plan blocks that the planner places around shifts.

CREATE TABLE degree_years (
  id         TEXT PRIMARY KEY,
  level      INTEGER NOT NULL CHECK (level IN (4, 5, 6)),
  label      TEXT NOT NULL,
  start_date TEXT,
  end_date   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE modules (
  id         TEXT PRIMARY KEY,
  year_id    TEXT NOT NULL REFERENCES degree_years(id) ON DELETE CASCADE,
  code       TEXT NOT NULL DEFAULT '',
  title      TEXT NOT NULL,
  credits    INTEGER NOT NULL CHECK (credits > 0),
  notes      TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX modules_year ON modules(year_id);

CREATE TABLE assessments (
  id         TEXT PRIMARY KEY,
  module_id  TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'coursework',
  weight     REAL NOT NULL CHECK (weight >= 0 AND weight <= 100),
  due_date   TEXT,
  status     TEXT NOT NULL DEFAULT 'not-started'
             CHECK (status IN ('not-started', 'in-progress', 'submitted', 'graded')),
  grade      REAL CHECK (grade IS NULL OR (grade >= 0 AND grade <= 100)),
  notes      TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX assessments_module ON assessments(module_id);
CREATE INDEX assessments_due ON assessments(due_date);

CREATE TABLE study_sessions (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,
  minutes    INTEGER NOT NULL CHECK (minutes > 0),
  module_id  TEXT REFERENCES modules(id) ON DELETE SET NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX study_sessions_date ON study_sessions(date);

CREATE TABLE plan_blocks (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,
  start_min  INTEGER NOT NULL CHECK (start_min >= 0 AND start_min < 1440),
  end_min    INTEGER NOT NULL CHECK (end_min > start_min AND end_min <= 1440),
  goal_id    TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'session',
  title      TEXT NOT NULL DEFAULT '',
  pinned     INTEGER NOT NULL DEFAULT 1,
  done       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX plan_blocks_date ON plan_blocks(date);
