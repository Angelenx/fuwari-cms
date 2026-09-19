import { env } from "cloudflare:workers";
import type { MarkdownHeading } from "astro";
import type { PostEntry } from "@/types/post";
import { parseSqliteDate, sqliteDateToIso } from "../utils/date-utils";
import { getSiteSettings } from "./site-settings";

/**
 * Post repository backed by D1. Public-facing functions never return drafts:
 * every SELECT includes `status = 'published'`.
 */

type PostRow = {
	id: number;
	slug: string;
	title: string;
	description: string;
	body_html: string;
	excerpt: string;
	cover_url: string;
	category: string | null;
	lang: string;
	published_at: string;
	updated_at: string | null;
	word_count: number;
	reading_minutes: number;
	headings_json: string;
	tag_names: string | null;
};

type CardRow = Omit<PostRow, "body_html" | "headings_json">;

type ArchiveRow = {
	id: number;
	slug: string;
	title: string;
	category: string | null;
	published_at: string;
	tag_names: string | null;
};

type NeighborRow = {
	slug: string;
	title: string;
};

/** Full row for slug lookup and RSS. */
const PUBLISHED_SELECT = `SELECT
	p.id,
	p.slug,
	p.title,
	p.description,
	p.body_html,
	p.excerpt,
	p.cover_url,
	p.category,
	p.lang,
	p.published_at,
	p.updated_at,
	p.word_count,
	p.reading_minutes,
	p.headings_json,
	GROUP_CONCAT(t.name) AS tag_names
FROM posts p
LEFT JOIN post_tags pt ON pt.post_id = p.id
LEFT JOIN tags t ON t.id = pt.tag_id`;

/** Home / list cards: no HTML body. */
const CARD_SELECT = `SELECT
	p.id,
	p.slug,
	p.title,
	p.description,
	p.excerpt,
	p.cover_url,
	p.category,
	p.lang,
	p.published_at,
	p.updated_at,
	p.word_count,
	p.reading_minutes,
	GROUP_CONCAT(t.name) AS tag_names
FROM posts p
LEFT JOIN post_tags pt ON pt.post_id = p.id
LEFT JOIN tags t ON t.id = pt.tag_id`;

const ARCHIVE_SELECT = `SELECT
	p.id,
	p.slug,
	p.title,
	p.category,
	p.published_at,
	GROUP_CONCAT(t.name) AS tag_names
FROM posts p
LEFT JOIN post_tags pt ON pt.post_id = p.id
LEFT JOIN tags t ON t.id = pt.tag_id`;

export type PublishedListFilter = {
	tag?: string;
	category?: string;
	uncategorized?: boolean;
};

function publishedClauses(filter: PublishedListFilter = {}): {
	sql: string;
	binds: string[];
} {
	const clauses = ["p.status = 'published'"];
	const binds: string[] = [];
	const tag = filter.tag?.trim();
	if (tag) {
		clauses.push(`p.id IN (
			SELECT pt2.post_id FROM post_tags pt2
			JOIN tags t2 ON t2.id = pt2.tag_id
			WHERE t2.name = ?
		)`);
		binds.push(tag);
	}
	if (filter.uncategorized) {
		clauses.push("(p.category IS NULL OR trim(p.category) = '')");
	} else {
		const category = filter.category?.trim();
		if (category) {
			clauses.push("p.category = ?");
			binds.push(category);
		}
	}
	return { sql: clauses.join(" AND "), binds };
}

function rowToEntry(
	row: PostRow,
	neighbors: Pick<
		PostEntry["data"],
		"prevSlug" | "prevTitle" | "nextSlug" | "nextTitle"
	> = {},
): PostEntry {
	return {
		slug: row.slug,
		data: {
			title: row.title,
			published: parseSqliteDate(row.published_at),
			...(row.updated_at ? { updated: parseSqliteDate(row.updated_at) } : {}),
			draft: false,
			description: row.description,
			image: row.cover_url,
			tags: row.tag_names ? row.tag_names.split(",") : [],
			category: row.category,
			lang: row.lang,
			...neighbors,
		},
		bodyHtml: row.body_html,
		excerpt: row.excerpt,
		words: row.word_count,
		minutes: row.reading_minutes,
		headings: JSON.parse(row.headings_json) as MarkdownHeading[],
	};
}

function rowToCard(row: CardRow): PostEntry {
	return {
		slug: row.slug,
		data: {
			title: row.title,
			published: parseSqliteDate(row.published_at),
			...(row.updated_at ? { updated: parseSqliteDate(row.updated_at) } : {}),
			draft: false,
			description: row.description,
			image: row.cover_url,
			tags: row.tag_names ? row.tag_names.split(",") : [],
			category: row.category,
			lang: row.lang,
		},
		bodyHtml: "",
		excerpt: row.excerpt,
		words: row.word_count,
		minutes: row.reading_minutes,
		headings: [],
	};
}

export async function countPublishedPosts(
	filter: PublishedListFilter = {},
): Promise<number> {
	const where = publishedClauses(filter);
	const row = await env.DB.prepare(
		`SELECT COUNT(*) AS n FROM posts p WHERE ${where.sql}`,
	)
		.bind(...where.binds)
		.first<{ n: number }>();
	return Number(row?.n ?? 0);
}

/** One page of published cards, newest first. Omits `body_html`. */
export async function listPublishedCards(opts: {
	limit: number;
	offset: number;
	filter?: PublishedListFilter;
}): Promise<PostEntry[]> {
	const limit = Math.max(0, Math.floor(opts.limit));
	const offset = Math.max(0, Math.floor(opts.offset));
	const where = publishedClauses(opts.filter);
	const { results } = await env.DB.prepare(
		`${CARD_SELECT}
		 WHERE ${where.sql}
		 GROUP BY p.id
		 ORDER BY p.published_at DESC, p.id DESC
		 LIMIT ? OFFSET ?`,
	)
		.bind(...where.binds, limit, offset)
		.all<CardRow>();
	return results.map(rowToCard);
}

export type ArchivePost = {
	id: number;
	slug: string;
	title: string;
	tags: string[];
	category: string | null;
	published: string;
};

export type ArchivePage = {
	posts: ArchivePost[];
	nextCursor: string | null;
};

function encodeArchiveCursor(publishedAt: string, id: number): string {
	return btoa(JSON.stringify({ t: publishedAt, i: id }));
}

/** Trust-boundary parse for `GET /api/posts?cursor=`. */
export function parseArchiveCursor(
	raw: string | undefined,
): { publishedAt: string; id: number } | undefined | { error: string } {
	if (raw === undefined || raw === "") {
		return undefined;
	}
	try {
		const parsed = JSON.parse(atob(raw)) as { t?: unknown; i?: unknown };
		if (typeof parsed.t !== "string" || typeof parsed.i !== "number") {
			return { error: "Invalid cursor" };
		}
		if (!Number.isInteger(parsed.i) || parsed.i < 1) {
			return { error: "Invalid cursor" };
		}
		return { publishedAt: parsed.t, id: parsed.i };
	} catch {
		return { error: "Invalid cursor" };
	}
}

function rowToArchive(row: ArchiveRow): ArchivePost {
	return {
		id: row.id,
		slug: row.slug,
		title: row.title,
		tags: row.tag_names ? row.tag_names.split(",") : [],
		category: row.category,
		published: sqliteDateToIso(row.published_at) ?? row.published_at,
	};
}

/** Keyset page for the archive timeline. */
export async function listPublishedArchivePage(opts: {
	limit: number;
	cursor?: { publishedAt: string; id: number };
	filter?: PublishedListFilter;
}): Promise<ArchivePage> {
	const limit = Math.max(1, Math.floor(opts.limit));
	const where = publishedClauses(opts.filter);
	const clauses = [where.sql];
	const binds: Array<string | number> = [...where.binds];
	if (opts.cursor) {
		clauses.push("(p.published_at < ? OR (p.published_at = ? AND p.id < ?))");
		binds.push(
			opts.cursor.publishedAt,
			opts.cursor.publishedAt,
			opts.cursor.id,
		);
	}
	const { results } = await env.DB.prepare(
		`${ARCHIVE_SELECT}
		 WHERE ${clauses.join(" AND ")}
		 GROUP BY p.id
		 ORDER BY p.published_at DESC, p.id DESC
		 LIMIT ?`,
	)
		.bind(...binds, limit + 1)
		.all<ArchiveRow>();
	const extra = results.length > limit;
	const pageRows = extra ? results.slice(0, limit) : results;
	const last = pageRows[pageRows.length - 1];
	return {
		posts: pageRows.map(rowToArchive),
		nextCursor:
			extra && last ? encodeArchiveCursor(last.published_at, last.id) : null,
	};
}

export type YearCount = {
	year: number;
	count: number;
};

export async function listPublishedYearCounts(
	filter: PublishedListFilter = {},
): Promise<YearCount[]> {
	const where = publishedClauses(filter);
	const { results } = await env.DB.prepare(
		`SELECT substr(p.published_at, 1, 4) AS year, COUNT(*) AS count
		 FROM posts p
		 WHERE ${where.sql}
		 GROUP BY year
		 ORDER BY year DESC`,
	)
		.bind(...where.binds)
		.all<{ year: string; count: number }>();
	return results.map((row) => ({
		year: Number(row.year),
		count: Number(row.count),
	}));
}

export type PublicTag = {
	name: string;
	count: number;
};

export async function listPublishedTags(): Promise<PublicTag[]> {
	const { results } = await env.DB.prepare(
		`SELECT t.name AS name, COUNT(p.id) AS count
		 FROM tags t
		 JOIN post_tags pt ON pt.tag_id = t.id
		 JOIN posts p ON p.id = pt.post_id
		 WHERE p.status = 'published'
		 GROUP BY t.id
		 ORDER BY t.name COLLATE NOCASE`,
	).all<{ name: string; count: number }>();
	return results.map((row) => ({
		name: row.name,
		count: Number(row.count),
	}));
}

export type PublicCategory = {
	name: string | null;
	count: number;
};

export async function listPublishedCategories(): Promise<PublicCategory[]> {
	const { results } = await env.DB.prepare(
		`SELECT CASE
			WHEN p.category IS NULL OR trim(p.category) = '' THEN NULL
			ELSE trim(p.category)
		 END AS name,
		 COUNT(*) AS count
		 FROM posts p
		 WHERE p.status = 'published'
		 GROUP BY CASE
			WHEN p.category IS NULL OR trim(p.category) = '' THEN NULL
			ELSE trim(p.category)
		 END
		 ORDER BY name COLLATE NOCASE`,
	).all<{ name: string | null; count: number }>();
	return results.map((row) => ({
		name: row.name,
		count: Number(row.count),
	}));
}

/** Full HTML bodies for the RSS feed only. */
export async function listPublishedPostsForRss(): Promise<PostEntry[]> {
	const { results } = await env.DB.prepare(
		`${PUBLISHED_SELECT}
		 WHERE p.status = 'published'
		 GROUP BY p.id
		 ORDER BY p.published_at DESC, p.id DESC`,
	).all<PostRow>();
	return results.map((row) => rowToEntry(row));
}

/** A single published post, or `undefined` for unknown slugs and drafts. */
export async function getPublishedPost(
	slug: string,
): Promise<PostEntry | undefined> {
	const post = await env.DB.prepare(
		`${PUBLISHED_SELECT}
		 WHERE p.status = 'published' AND p.slug = ?
		 GROUP BY p.id`,
	)
		.bind(slug)
		.first<PostRow>();
	if (!post) {
		return undefined;
	}

	// Neighbour order: next = newer, prev = older.
	const [newer, older] = await env.DB.batch<NeighborRow>([
		env.DB.prepare(
			`SELECT slug, title FROM posts
			 WHERE status = 'published'
			   AND (published_at > ? OR (published_at = ? AND id > ?))
			 ORDER BY published_at ASC, id ASC
			 LIMIT 1`,
		).bind(post.published_at, post.published_at, post.id),
		env.DB.prepare(
			`SELECT slug, title FROM posts
			 WHERE status = 'published'
			   AND (published_at < ? OR (published_at = ? AND id < ?))
			 ORDER BY published_at DESC, id DESC
			 LIMIT 1`,
		).bind(post.published_at, post.published_at, post.id),
	]);
	const next = newer.results[0];
	const prev = older.results[0];

	return rowToEntry(post, {
		...(next ? { nextSlug: next.slug, nextTitle: next.title } : {}),
		...(prev ? { prevSlug: prev.slug, prevTitle: prev.title } : {}),
	});
}

/** Rendered HTML of a standalone page such as `about`. */
export async function getSpecPageHtml(name: "about"): Promise<string> {
	if (name !== "about") {
		return "";
	}
	const { about } = await getSiteSettings();
	return about.html;
}

export type PublicSearchHit = {
	url: string;
	meta: { title: string };
	excerpt: string;
};

type SearchRow = {
	slug: string;
	title: string;
	description: string;
	excerpt: string;
	body_md: string;
};

function likeContains(q: string): string | undefined {
	const literal = q.replace(/[%_]/g, "").trim().slice(0, 80);
	if (!literal) {
		return undefined;
	}
	return `%${literal}%`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function clipAround(text: string, needle: string, radius = 60): string {
	const i = text.toLowerCase().indexOf(needle.toLowerCase());
	if (i < 0) {
		return text.length > 160 ? `${text.slice(0, 160)}…` : text;
	}
	const start = Math.max(0, i - radius);
	const end = Math.min(text.length, i + needle.length + radius);
	return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function snippetFor(row: SearchRow, needle: string): string {
	const fields = [row.excerpt, row.description, row.body_md, row.title];
	const lower = needle.toLowerCase();
	for (const field of fields) {
		if (field.toLowerCase().includes(lower)) {
			return clipAround(field, needle);
		}
	}
	return row.excerpt || row.description || row.title;
}

function markNeedle(text: string, needle: string): string {
	const safe = escapeHtml(text);
	const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return safe.replace(
		new RegExp(escaped, "gi"),
		(match) => `<mark>${match}</mark>`,
	);
}

/**
 * Navbar search. Published posts only.
 * ponytail: LIKE over title/body is enough for a personal blog. Upgrade: D1 FTS5.
 */
export async function searchPublishedPosts(
	q: string,
): Promise<PublicSearchHit[]> {
	const pattern = likeContains(q);
	if (!pattern) {
		return [];
	}
	const needle = pattern.slice(1, -1);
	const { results } = await env.DB.prepare(
		`SELECT slug, title, description, excerpt, body_md
		 FROM posts
		 WHERE status = 'published'
		   AND (title LIKE ? OR slug LIKE ? OR description LIKE ? OR excerpt LIKE ? OR body_md LIKE ?)
		 ORDER BY published_at DESC, id DESC
		 LIMIT 20`,
	)
		.bind(pattern, pattern, pattern, pattern, pattern)
		.all<SearchRow>();
	return results.map((row) => ({
		url: `/posts/${row.slug}/`,
		meta: { title: row.title },
		excerpt: markNeedle(snippetFor(row, needle), needle),
	}));
}
