import { env } from "cloudflare:workers";
import type { MarkdownHeading } from "astro";
import type { PostEntry } from "@/types/post";
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

/** SQLite `datetime('now')` is UTC without an offset; ISO strings parse as-is. */
function parseSqliteDate(value: string): Date {
	if (value.includes("T") || /(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
		return new Date(value);
	}
	return new Date(`${value.replace(" ", "T")}Z`);
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
