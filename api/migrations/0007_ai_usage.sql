-- One row per AI call (Scala): what it was for, which model, which book, how many tokens.
-- Feeds the monthly AI cost per book in the pilot's progress reports.
CREATE TABLE ai_usage (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  task           TEXT NOT NULL,
  model          TEXT NOT NULL,
  project_id     TEXT,
  user_id        TEXT,
  input_tokens   INTEGER,
  output_tokens  INTEGER,
  ms             INTEGER NOT NULL,
  ok             INTEGER NOT NULL,
  created_at     TEXT NOT NULL
);
CREATE INDEX idx_ai_usage_time ON ai_usage (created_at);
CREATE INDEX idx_ai_usage_project ON ai_usage (project_id, created_at);
