-- Scala’s Shelf D1 schema (SQLite). Apply with:
--   npx wrangler d1 migrations apply textweaver --remote      (Cloudflare)
-- Locally the API applies these files to .data/textweaver.sqlite on startup.
--
-- English only and free for now: no prices, purchases or balances.
-- User ids come from the auth system (chosen later), so there is no users table yet.
-- JSON columns are TEXT; the API parses them.

CREATE TABLE projects (
  id          TEXT PRIMARY KEY,
  creator_id  TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'comic' CHECK (type IN ('comic', 'book')),
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  level       TEXT NOT NULL DEFAULT 'A1' CHECK (level IN ('A1', 'A2', 'B1', 'B2')),
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  quiz        TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_projects_creator ON projects (creator_id, created_at);

-- One row per scene; the whole Studio draft (layers, bubbles, words, audio refs) is `data`.
CREATE TABLE scenes (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  data         TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  UNIQUE (project_id, scene_number)
);

-- The public library: one row per published episode (reading needs no account).
CREATE TABLE books (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL UNIQUE REFERENCES projects (id) ON DELETE CASCADE,
  creator_id     TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  level          TEXT NOT NULL,
  reading_level  TEXT NOT NULL CHECK (reading_level IN ('beginner', 'intermediate', 'advanced')),
  cover_url      TEXT,
  manifest       TEXT NOT NULL,
  published_at   TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX idx_books_level ON books (level, published_at);

-- Cloud job queue: scene art, layer re-rolls, publish packaging. The GPU worker claims jobs over the API.
CREATE TABLE jobs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('scene', 'layer', 'package')),
  payload     TEXT NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'complete', 'failed')),
  result      TEXT,
  error       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_jobs_status ON jobs (status, created_at);
CREATE INDEX idx_jobs_user ON jobs (user_id);
