-- Jobs can now also be "finish" (Scala Finish), which the API runs itself in the
-- background; the GPU worker only ever claims scene, layer and package jobs.
-- SQLite can't change a CHECK constraint in place, so the table is rebuilt.
CREATE TABLE jobs_new (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('scene', 'layer', 'package', 'finish')),
  payload     TEXT NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'complete', 'failed')),
  result      TEXT,
  error       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
INSERT INTO jobs_new SELECT id, user_id, project_id, kind, payload, status, result, error, created_at, updated_at FROM jobs;
DROP TABLE jobs;
ALTER TABLE jobs_new RENAME TO jobs;
CREATE INDEX idx_jobs_status ON jobs (status, created_at);
CREATE INDEX idx_jobs_user ON jobs (user_id);
