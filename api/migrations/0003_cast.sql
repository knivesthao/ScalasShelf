-- The episode's characters and places (the Studio's Cast tab), drawn once and reused in
-- every scene. JSON: {"characters": [...], "places": [...]} (src/lib/format.ts → Cast).
ALTER TABLE projects ADD COLUMN cast_json TEXT NOT NULL DEFAULT '{"characters":[],"places":[]}';
