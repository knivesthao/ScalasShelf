-- What a book is for: a learning book teaches English (it has a level, new words and a
-- quiz); a reading book is just for reading. Existing books are learning books.
ALTER TABLE projects ADD COLUMN purpose TEXT NOT NULL DEFAULT 'learning' CHECK (purpose IN ('learning', 'reading'));
