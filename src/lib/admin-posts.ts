import { env } from "cloudflare:workers";
import { sqliteDateToIso } from "../utils/date-utils";
import { renderMarkdown } from "./markdown";

/**
 * Admin post repository. Unlike `@lib/posts`, these queries include drafts and
 * are only called from authenticated `/api/admin/*` and `/admin` pages.
 */

export type AdminPostStatus = "draft" | "published";

export type AdminPostListItem = {
	id: number;
	slug: string;
	title: string;
	status: AdminPostStatus;
	publishedAt: string | null;
	updatedAt: string | null;
	tags: string[];
};

export type AdminPost = AdminPostListItem & {
	description: string;
	bodyMd: string;
	coverUrl: string;
	category: string | null;
	lang: string;
};

export type AdminPostListStatus = "all" | AdminPostStatus;

export type AdminPostListFilter = {
	q?: string;
	tag?: string;
	status?: AdminPostListStatus;
};

export type AdminTag = {
	name: string;
	count: number;
};

export type PostWriteInput = {
	slug: string;
	title: string;
	description: string;
	bodyMd: string;
	coverUrl: string;
	category: string | null;
	lang: string;
	tags: string[];
	status: AdminPostStatus;
	/** When set, stored as `published_at` (public list order). */
	publishedAt?: string;
};

type ListRow = {
	id: number;
	slug: string;
	title: string;
	status: AdminPostStatus;
	published_at: string | null;
	updated_at: string | null;
	tag_names: string | null;
};

type DetailRow = ListRow & {
	description: string;
	body_md: string;
	cover_url: string;
	category: string | null;
	lang: string;
};

function nowIso(): string {
	return new Date().toISOString();
}

function rowToListItem(row: ListRow): AdminPostListItem {
	return {
		id: row.id,
		slug: row.slug,
		title: row.title,
		status: row.status,
		publishedAt: sqliteDateToIso(row.published_at),
		updatedAt: sqliteDateToIso(row.updated_at),
		tags: row.tag_names ? row.tag_names.split(",") : [],
	};
}

function rowToPost(row: DetailRow): AdminPost {
	return {
		...rowToListItem(row),
		description: row.description,
		bodyMd: row.body_md,
		coverUrl: row.cover_url,
		category: row.category,
		lang: row.lang,
	};
}

/** Normalize `/admin` and `GET /api/admin/posts` query strings. */
export function parseAdminPostListFilter(input: {
	q?: string | null;
	tag?: string | null;
	status?: string | null;
}): { q?: string; tag?: string; status: AdminPostListStatus } {
	const q = input.q?.trim() || undefined;
	const tag = input.tag?.trim() || undefined;
	const status: AdminPostListStatus =
		input.status === "draft" || input.status === "published"
			? input.status
			: "all";
	return { q, tag, status };
}

/** Strip LIKE wildcards so user input is a literal substring. */
function containsPattern(q: string): string | undefined {
	const literal = q.replace(/[%_]/g, "");
	if (!literal) {
		return undefined;
	}
	return `%${literal}%`;
}

async function replaceTags(postId: number, tags: string[]): Promise<void> {
	await env.DB.prepare("DELETE FROM post_tags WHERE post_id = ?")
		.bind(postId)
		.run();
	// ponytail: one round-trip per tag; fine for a personal blog. Upgrade: a single batch.
	for (const name of tags) {
		await env.DB.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)")
			.bind(name)
			.run();
		await env.DB.prepare(
			`INSERT INTO post_tags (post_id, tag_id)
			 SELECT ?, id FROM tags WHERE name = ?`,
		)
			.bind(postId, name)
			.run();
	}
}

function publishedAtFor(
	status: AdminPostStatus,
	existing: string | null,
	custom?: string,
): string | null {
	if (custom !== undefined) {
		return custom;
	}
	if (status !== "published") {
		return existing;
	}
	return existing ?? nowIso();
}

const DETAIL_SELECT = `SELECT
	p.id,
	p.slug,
	p.title,
	p.description,
	p.body_md,
	p.cover_url,
	p.status,
	p.category,
	p.lang,
	p.published_at,
	p.updated_at,
	GROUP_CONCAT(t.name) AS tag_names
FROM posts p
LEFT JOIN post_tags pt ON pt.post_id = p.id
LEFT JOIN tags t ON t.id = pt.tag_id`;

const LIST_SELECT = `SELECT
	p.id,
	p.slug,
	p.title,
	p.status,
	p.published_at,
	p.updated_at,
	GROUP_CONCAT(t.name) AS tag_names
FROM posts p
LEFT JOIN post_tags pt ON pt.post_id = p.id
LEFT JOIN tags t ON t.id = pt.tag_id`;

export async function listAdminPosts(
	filters: AdminPostListFilter = {},
): Promise<AdminPostListItem[]> {
	const parsed = parseAdminPostListFilter(filters);
	const clauses: string[] = [];
	const binds: string[] = [];

	if (parsed.status !== "all") {
		clauses.push("p.status = ?");
		binds.push(parsed.status);
	}

	const pattern = parsed.q ? containsPattern(parsed.q) : undefined;
	if (pattern) {
		// ponytail: LIKE over body_md is enough for a personal blog. Upgrade: D1 FTS5 (PLAN 二期).
		clauses.push(
			"(p.title LIKE ? OR p.slug LIKE ? OR p.description LIKE ? OR p.body_md LIKE ?)",
		);
		binds.push(pattern, pattern, pattern, pattern);
	}

	if (parsed.tag) {
		clauses.push(`p.id IN (
			SELECT pt2.post_id FROM post_tags pt2
			JOIN tags t2 ON t2.id = pt2.tag_id
			WHERE t2.name = ?
		)`);
		binds.push(parsed.tag);
	}

	const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
	const sql = `${LIST_SELECT}
		${where}
		GROUP BY p.id
		ORDER BY (p.published_at IS NULL), p.published_at DESC, p.id DESC`;
	const stmt = env.DB.prepare(sql);
	const { results } = await (binds.length > 0
		? stmt.bind(...binds)
		: stmt
	).all<ListRow>();
	return results.map(rowToListItem);
}

export async function listAdminTags(): Promise<AdminTag[]> {
	const { results } = await env.DB.prepare(
		`SELECT t.name AS name, COUNT(pt.post_id) AS count
		 FROM tags t
		 JOIN post_tags pt ON pt.tag_id = t.id
		 GROUP BY t.id
		 ORDER BY t.name COLLATE NOCASE`,
	).all<{ name: string; count: number }>();
	return results.map((row) => ({
		name: row.name,
		count: Number(row.count),
	}));
}

export async function getAdminPost(id: number): Promise<AdminPost | undefined> {
	const row = await env.DB.prepare(
		`${DETAIL_SELECT}
		 WHERE p.id = ?
		 GROUP BY p.id`,
	)
		.bind(id)
		.first<DetailRow>();
	return row ? rowToPost(row) : undefined;
}

export async function createPost(input: PostWriteInput): Promise<AdminPost> {
	const rendered = await renderMarkdown(input.bodyMd);
	const updatedAt = nowIso();
	const publishedAt = publishedAtFor(input.status, null, input.publishedAt);

	await env.DB.prepare(
		`INSERT INTO posts (
			slug, title, description, body_md, body_html, excerpt, cover_url,
			status, category, lang, published_at, updated_at,
			word_count, reading_minutes, headings_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			input.slug,
			input.title,
			input.description,
			input.bodyMd,
			rendered.bodyHtml,
			rendered.excerpt,
			input.coverUrl,
			input.status,
			input.category,
			input.lang,
			publishedAt,
			updatedAt,
			rendered.wordCount,
			rendered.readingMinutes,
			JSON.stringify(rendered.headings),
		)
		.run();

	const created = await env.DB.prepare("SELECT id FROM posts WHERE slug = ?")
		.bind(input.slug)
		.first<{ id: number }>();
	if (!created) {
		throw new Error("createPost: insert did not persist");
	}
	await replaceTags(created.id, input.tags);
	const post = await getAdminPost(created.id);
	if (!post) {
		throw new Error("createPost: row missing after insert");
	}
	return post;
}

export async function updatePost(
	id: number,
	patch: Partial<PostWriteInput>,
): Promise<AdminPost | undefined> {
	const existing = await getAdminPost(id);
	if (!existing) {
		return undefined;
	}

	const next: PostWriteInput = {
		slug: patch.slug ?? existing.slug,
		title: patch.title ?? existing.title,
		description: patch.description ?? existing.description,
		bodyMd: patch.bodyMd ?? existing.bodyMd,
		coverUrl: patch.coverUrl ?? existing.coverUrl,
		category: patch.category === undefined ? existing.category : patch.category,
		lang: patch.lang ?? existing.lang,
		tags: patch.tags ?? existing.tags,
		status: patch.status ?? existing.status,
		publishedAt: patch.publishedAt,
	};
	const rendered = await renderMarkdown(next.bodyMd);
	const updatedAt = nowIso();
	const publishedAt = publishedAtFor(
		next.status,
		existing.publishedAt,
		patch.publishedAt,
	);

	await env.DB.prepare(
		`UPDATE posts SET
			slug = ?, title = ?, description = ?, body_md = ?, body_html = ?,
			excerpt = ?, cover_url = ?, status = ?, category = ?, lang = ?,
			published_at = ?, updated_at = ?, word_count = ?, reading_minutes = ?,
			headings_json = ?
		 WHERE id = ?`,
	)
		.bind(
			next.slug,
			next.title,
			next.description,
			next.bodyMd,
			rendered.bodyHtml,
			rendered.excerpt,
			next.coverUrl,
			next.status,
			next.category,
			next.lang,
			publishedAt,
			updatedAt,
			rendered.wordCount,
			rendered.readingMinutes,
			JSON.stringify(rendered.headings),
			id,
		)
		.run();

	await replaceTags(id, next.tags);
	return getAdminPost(id);
}

export async function deletePost(id: number): Promise<boolean> {
	const result = await env.DB.prepare("DELETE FROM posts WHERE id = ?")
		.bind(id)
		.run();
	return (result.meta.changes ?? 0) > 0;
}
