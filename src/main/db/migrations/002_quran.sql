-- 002_quran: the 604 pages of the mushaf with their revision schedule, and the
-- history of every review.

CREATE TABLE quran_pages (
  page             INTEGER PRIMARY KEY CHECK (page BETWEEN 1 AND 604),
  state            TEXT NOT NULL DEFAULT 'not_started'
                   CHECK (state IN ('not_started', 'new', 'memorized', 'revision')),
  learned_on       TEXT,
  ease             REAL NOT NULL DEFAULT 2.0,
  interval_days    INTEGER NOT NULL DEFAULT 0,
  step             INTEGER NOT NULL DEFAULT 0,
  due_on           TEXT,
  last_reviewed_on TEXT,
  lapses           INTEGER NOT NULL DEFAULT 0,
  reviews          INTEGER NOT NULL DEFAULT 0,
  relearn_interval INTEGER NOT NULL DEFAULT 0,
  note             TEXT NOT NULL DEFAULT '',
  updated_at       TEXT NOT NULL DEFAULT ''
);

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 604)
INSERT INTO quran_pages (page) SELECT n FROM seq;

CREATE INDEX quran_pages_due ON quran_pages(due_on);
CREATE INDEX quran_pages_learned ON quran_pages(learned_on);

CREATE TABLE quran_reviews (
  id          TEXT PRIMARY KEY,
  batch_id    TEXT NOT NULL,
  page        INTEGER NOT NULL REFERENCES quran_pages(page),
  reviewed_on TEXT NOT NULL,
  rating      TEXT NOT NULL CHECK (rating IN ('solid', 'shaky', 'forgotten')),
  before_json TEXT NOT NULL,
  after_json  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX quran_reviews_date ON quran_reviews(reviewed_on);
CREATE INDEX quran_reviews_batch ON quran_reviews(batch_id);
