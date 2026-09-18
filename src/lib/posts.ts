import { env } from "cloudflare:workers";
import type { MarkdownHeading } from "astro";
import type { PostEntry } from "@/types/post";
import { parseSqliteDate } from "../utils/date-utils";
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

type NeighborRow = {
	slug: string;
	title: string;
};

// Shared projection for list + slug lookup; tags are folded into one column.
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

/** Published posts, newest first. */
export async function listPublishedPosts(): Promise<PostEntry[]> {
	// ponytail: loads every published body per request. Fine for a personal blog;
	// upgrade by dropping body_html from this SELECT once RSS has its own query.
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

	// Neighbour order matches getSortedPosts: next = newer, prev = older.
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
