import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { getPublishedPost, listPublishedPosts } from "../../src/lib/posts";

async function insertPost(opts: {
	slug: string;
	title: string;
	status: "draft" | "published";
	publishedAt: string;
	tag?: string;
}): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO posts (
			slug, title, description, body_md, body_html, excerpt, cover_url,
			status, category, lang, published_at, word_count, reading_minutes, headings_json
		) VALUES (?, ?, '', '', '<p>body</p>', '', '', ?, NULL, 'en', ?, 1, 1, '[]')`,
	)
		.bind(opts.slug, opts.title, opts.status, opts.publishedAt)
		.run();

	if (!opts.tag) {
		return;
	}
	await env.DB.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)")
		.bind(opts.tag)
		.run();
	await env.DB.prepare(
		`INSERT INTO post_tags (post_id, tag_id)
		 SELECT p.id, t.id FROM posts p JOIN tags t ON t.name = ? WHERE p.slug = ?`,
	)
		.bind(opts.tag, opts.slug)
		.run();
}

describe("public post queries", () => {
	it("excludes drafts from the public list and slug lookup", async () => {
		const publishedSlug = `pub-${crypto.randomUUID()}`;
		const draftSlug = `draft-${crypto.randomUUID()}`;

		await insertPost({
			slug: publishedSlug,
			title: "Published",
			status: "published",
			publishedAt: "2026-09-18T00:00:00.000Z",
			tag: "Test",
		});
		await insertPost({
			slug: draftSlug,
			title: "Secret",
			status: "draft",
			publishedAt: "2026-09-18T00:00:00.000Z",
		});

		const listed = await listPublishedPosts();
		expect(listed.map((p) => p.slug)).toEqual([publishedSlug]);
		expect(listed[0].data.draft).toBe(false);
		expect(listed[0].data.tags).toEqual(["Test"]);

		expect(await getPublishedPost(draftSlug)).toBeUndefined();
		const published = await getPublishedPost(publishedSlug);
		expect(published?.data.draft).toBe(false);
		expect(published?.data.title).toBe("Published");
	});
});
