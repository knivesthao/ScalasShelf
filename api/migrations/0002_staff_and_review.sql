-- Staff sign-in and the review-before-publishing workflow (docs/plans/pilot-build-plan.md).
--
-- Only staff sign in (creators, reviewers, admins); readers never do. Sign-in is a
-- passwordless email link: only SHA-256 hashes of links and sessions are stored.
-- The user id used everywhere else (projects.creator_id, jobs.user_id) is the staff email.

CREATE TABLE staff (
  email       TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL CHECK (role IN ('creator', 'reviewer', 'admin')),
  created_at  TEXT NOT NULL
);

CREATE TABLE login_tokens (
  token_hash  TEXT PRIMARY KEY,
  email       TEXT NOT NULL REFERENCES staff (email) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX idx_login_tokens_email ON login_tokens (email);

CREATE TABLE sessions (
  id_hash     TEXT PRIMARY KEY,
  email       TEXT NOT NULL REFERENCES staff (email) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX idx_sessions_email ON sessions (email);

-- Review state sits beside the draft/published status rather than inside it: widening that
-- CHECK constraint would mean rebuilding `projects`, which cascades to scenes, books and jobs.
--   none               not submitted (or approved and published)
--   in_review          waiting for a reviewer; pending_package is the exact book they'll see
--   changes_requested  sent back with review_note
ALTER TABLE projects ADD COLUMN review_status TEXT NOT NULL DEFAULT 'none'
  CHECK (review_status IN ('none', 'in_review', 'changes_requested'));
ALTER TABLE projects ADD COLUMN pending_package TEXT;
ALTER TABLE projects ADD COLUMN review_note TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN submitted_at TEXT;
ALTER TABLE projects ADD COLUMN reviewed_by TEXT;
ALTER TABLE projects ADD COLUMN reviewed_at TEXT;
CREATE INDEX idx_projects_review ON projects (review_status, submitted_at);

-- The first admin. Add other staff from the Studio's staff page (admins only).
INSERT OR IGNORE INTO staff (email, name, role, created_at)
VALUES ('yee@admais.xyz', 'Yee Thao', 'admin', '2026-09-27T00:00:00Z');
