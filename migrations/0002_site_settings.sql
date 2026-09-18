-- Singleton row for sidebar profile + home banner. No seed INSERT:
-- empty / blank fields fall back to src/config.ts at read time.

CREATE TABLE site_settings (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	avatar TEXT,
	name TEXT,
	bio TEXT,
	links_json TEXT,
	banner_json TEXT,
	updated_at TEXT
);
