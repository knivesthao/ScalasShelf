-- Reading events from the app: what's read, finished and learned, for the pilot's
-- progress reports. Anonymous by design: no account, name, IP address or user agent.
-- device_id is a random id the app makes on first run (it can be reset by clearing data).
CREATE TABLE events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  book_id      TEXT,
  props        TEXT NOT NULL DEFAULT '{}',
  device_id    TEXT NOT NULL,
  app_version  TEXT NOT NULL DEFAULT '',
  occurred_at  TEXT NOT NULL,
  received_at  TEXT NOT NULL
);
CREATE INDEX idx_events_name_time ON events (name, occurred_at);
CREATE INDEX idx_events_book ON events (book_id, name);
