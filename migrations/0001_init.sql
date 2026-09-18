-- Schema for the public read path (phase 2) plus empty users/sessions for phase 3 auth.
-- Admin rows are not seeded here: password hashing lands with the login routes.

CREATE TABLE users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
	id TEXT PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	expires_at TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

CREATE TABLE posts (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	slug TEXT NOT NULL UNIQUE,
	title TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	body_md TEXT NOT NULL DEFAULT '',
	body_html TEXT NOT NULL DEFAULT '',
	excerpt TEXT NOT NULL DEFAULT '',
	cover_url TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
	category TEXT,
	lang TEXT NOT NULL DEFAULT 'en',
	published_at TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT,
	word_count INTEGER NOT NULL DEFAULT 0,
	reading_minutes INTEGER NOT NULL DEFAULT 1,
	headings_json TEXT NOT NULL DEFAULT '[]',
	CHECK (status != 'published' OR published_at IS NOT NULL)
);

-- slug uniqueness already indexes lookups; this covers the public list ORDER BY.
CREATE INDEX idx_posts_status_published_at ON posts (status, published_at DESC);

CREATE TABLE tags (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE
);

CREATE TABLE post_tags (
	post_id INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
	tag_id INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
	PRIMARY KEY (post_id, tag_id)
);
