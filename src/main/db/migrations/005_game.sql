-- 005_game: roadmap with dependencies, learning path and engine decisions,
-- practice projects, time tracking, devlog and the Steam-readiness checklist.

CREATE TABLE roadmap_phases (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  milestone_id TEXT REFERENCES milestones(id) ON DELETE SET NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);

CREATE TABLE roadmap_tasks (
  id             TEXT PRIMARY KEY,
  phase_id       TEXT NOT NULL REFERENCES roadmap_phases(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  notes          TEXT NOT NULL DEFAULT '',
  estimate_hours REAL CHECK (estimate_hours IS NULL OR estimate_hours > 0),
  done           INTEGER NOT NULL DEFAULT 0,
  done_at        TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX roadmap_tasks_phase ON roadmap_tasks(phase_id);

CREATE TABLE task_dependencies (
  task_id       TEXT NOT NULL REFERENCES roadmap_tasks(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES roadmap_tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_id),
  CHECK (task_id <> depends_on_id)
);

CREATE TABLE learning_items (
  id         TEXT PRIMARY KEY,
  category   TEXT NOT NULL,
  title      TEXT NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  links      TEXT NOT NULL DEFAULT '[]',
  done       INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE engine_decisions (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,
  engine     TEXT NOT NULL,
  decision   TEXT NOT NULL,
  rationale  TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE practice_projects (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'active', 'done', 'shelved')),
  started_on  TEXT,
  finished_on TEXT,
  lessons     TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE time_entries (
  id         TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at   TEXT,
  kind       TEXT NOT NULL DEFAULT 'timer' CHECK (kind IN ('timer', 'manual')),
  focus      INTEGER NOT NULL DEFAULT 0,
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX time_entries_start ON time_entries(started_at);
-- At most one running timer.
CREATE UNIQUE INDEX time_entries_running ON time_entries((ended_at IS NULL)) WHERE ended_at IS NULL;

CREATE TABLE devlog_entries (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  tags       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX devlog_date ON devlog_entries(date);

CREATE TABLE steam_checklist (
  id         TEXT PRIMARY KEY,
  section    TEXT NOT NULL,
  title      TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  done       INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
