-- Translation cache: every translated piece of text, stored once and reused forever
-- (a sentence like "Good morning!" is only ever paid for once). hash = SHA-256 of
-- source language, target language and text.
CREATE TABLE translations (
  hash             TEXT PRIMARY KEY,
  source_lang      TEXT NOT NULL,
  target_lang      TEXT NOT NULL,
  source_text      TEXT NOT NULL,
  translated_text  TEXT NOT NULL,
  provider         TEXT NOT NULL,
  created_at       TEXT NOT NULL
);

-- Text waiting to be translated. The queue is sent to the translation service in
-- batches (many texts in one request) by a background job and a 5-minute timer.
-- One row per unique text, however many books use it.
CREATE TABLE translation_queue (
  hash         TEXT PRIMARY KEY,
  source_lang  TEXT NOT NULL,
  target_lang  TEXT NOT NULL,
  source_text  TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  error        TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_translation_queue_time ON translation_queue (attempts, created_at);

-- Shared dictionary of simple word meanings, by word and reading level. Filled from
-- meanings writers type and from Scala; a word is only ever sent to AI once per level.
CREATE TABLE word_meanings (
  word        TEXT NOT NULL,
  level       TEXT NOT NULL,
  meaning     TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('writer', 'ai')),
  created_at  TEXT NOT NULL,
  PRIMARY KEY (word, level)
);
