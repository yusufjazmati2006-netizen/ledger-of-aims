-- Each reminder is sent once; its key (e.g. "revision:2026-10-15") is recorded here.
CREATE TABLE notification_log (
  key     TEXT PRIMARY KEY,
  title   TEXT NOT NULL DEFAULT '',
  sent_at TEXT NOT NULL
);
CREATE INDEX notification_log_sent ON notification_log(sent_at);
