import { env } from "cloudflare:workers";
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
};

export type AdminPost = AdminPostListItem & {
	description: string;
	bodyMd: string;
	coverUrl: string;
	category: string | null;
	lang: string;
	tags: string[];
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
};

type ListRow = {
	id: number;
	slug: string;
	title: string;
	status: AdminPostStatus;
	published_at: string | null;
	updated_at: string | null;
};

type DetailRow = ListRow & {
	description: string;
	body_md: string;
	cover_url: string;
	category: string | null;
	lang: string;
	tag_names: string | null;
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
		publishedAt: row.published_at,
		updatedAt: row.updated_at,
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
		tags: row.tag_names ? row.tag_names.split(",") : [],
	};
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
): string | null {
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

export async function listAdminPosts(): Promise<AdminPostListItem[]> {
	const { results } = await env.DB.prepare(
		`SELECT id, slug, title, status, published_at, updated_at
		 FROM posts
		 ORDER BY COALESCE(updated_at, created_at) DESC, id DESC`,
	).all<ListRow>();
	return results.map(rowToListItem);
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
	const publishedAt = publishedAtFor(input.status, null);

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
	};
	const rendered = await renderMarkdown(next.bodyMd);
	const updatedAt = nowIso();
	const publishedAt = publishedAtFor(next.status, existing.publishedAt);

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
