-- Published books carry the project's type too, so readers don't see a level on reading books.
ALTER TABLE books ADD COLUMN purpose TEXT NOT NULL DEFAULT 'learning' CHECK (purpose IN ('learning', 'reading'));
