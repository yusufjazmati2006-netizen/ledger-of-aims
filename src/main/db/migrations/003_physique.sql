-- 003_physique: exercise library, workouts, foods and intake, meal planning,
-- and progress photos (image files live in the data folder, not the database).

CREATE TABLE exercises (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  muscle_group TEXT NOT NULL DEFAULT '',
  rep_min      INTEGER NOT NULL DEFAULT 6 CHECK (rep_min >= 1),
  rep_max      INTEGER NOT NULL DEFAULT 10 CHECK (rep_max >= rep_min),
  sets_target  INTEGER NOT NULL DEFAULT 3 CHECK (sets_target BETWEEN 1 AND 10),
  increment_kg REAL NOT NULL DEFAULT 2.5 CHECK (increment_kg >= 0),
  bodyweight   INTEGER NOT NULL DEFAULT 0,
  in_program   INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  archived     INTEGER NOT NULL DEFAULT 0,
  notes        TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE workouts (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX workouts_date ON workouts(date);

CREATE TABLE workout_sets (
  id          TEXT PRIMARY KEY,
  workout_id  TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  set_index   INTEGER NOT NULL,
  reps        INTEGER NOT NULL CHECK (reps >= 0),
  load_kg     REAL NOT NULL CHECK (load_kg >= 0),
  created_at  TEXT NOT NULL
);
CREATE INDEX workout_sets_exercise ON workout_sets(exercise_id);
CREATE INDEX workout_sets_workout ON workout_sets(workout_id);

CREATE TABLE foods (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  calories    REAL NOT NULL CHECK (calories >= 0),
  protein_g   REAL NOT NULL CHECK (protein_g >= 0),
  serving     TEXT NOT NULL DEFAULT '',
  ingredients TEXT NOT NULL DEFAULT '',
  favourite   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE food_entries (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,
  food_id    TEXT REFERENCES foods(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  calories   REAL NOT NULL CHECK (calories >= 0),
  protein_g  REAL NOT NULL CHECK (protein_g >= 0),
  servings   REAL NOT NULL DEFAULT 1 CHECK (servings > 0),
  created_at TEXT NOT NULL
);
CREATE INDEX food_entries_date ON food_entries(date);

CREATE TABLE meal_plan_entries (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,
  slot       TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id    TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  servings   REAL NOT NULL DEFAULT 1 CHECK (servings > 0),
  created_at TEXT NOT NULL
);
CREATE INDEX meal_plan_date ON meal_plan_entries(date);

CREATE TABLE prep_sessions (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  done       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE photos (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,
  pose       TEXT NOT NULL DEFAULT 'front',
  file_name  TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX photos_date ON photos(date);
