-- A translation run claims the texts it sends, so two runs at the same time (a Translate
-- click and the 5-minute timer) never send the same text to Google twice.
ALTER TABLE translation_queue ADD COLUMN claimed_at TEXT;
