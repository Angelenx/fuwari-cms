import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
	countPublishedPosts,
	getPublishedPost,
	listPublishedCards,
	listPublishedCategories,
	listPublishedPostsForRss,
	listPublishedTags,
} from "../../src/lib/posts";

async function insertPost(opts: {
	slug: string;
	title: string;
	status: "draft" | "published";
	publishedAt: string;
	tag?: string;
	category?: string | null;
}): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO posts (
			slug, title, description, body_md, body_html, excerpt, cover_url,
			status, category, lang, published_at, word_count, reading_minutes, headings_json
		) VALUES (?, ?, '', '', '<p>body</p>', '', '', ?, ?, 'en', ?, 1, 1, '[]')`,
	)
		.bind(
			opts.slug,
			opts.title,
			opts.status,
			opts.category === undefined ? null : opts.category,
			opts.publishedAt,
		)
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
		const token = crypto.randomUUID();
		const publishedSlug = `pub-${token}`;
		const draftSlug = `draft-${token}`;
		const tag = `tag-${token}`;

		await insertPost({
			slug: publishedSlug,
			title: "Published",
			status: "published",
			publishedAt: "2026-09-18T00:00:00.000Z",
			tag,
		});
		await insertPost({
			slug: draftSlug,
			title: "Secret",
			status: "draft",
			publishedAt: "2026-09-18T00:00:00.000Z",
			tag,
		});

		const listed = await listPublishedCards({
			limit: 50,
			offset: 0,
			filter: { tag },
		});
		expect(listed.map((p) => p.slug)).toEqual([publishedSlug]);
		expect(listed[0].data.draft).toBe(false);
		expect(listed[0].data.tags).toEqual([tag]);
		expect(listed[0].bodyHtml).toBe("");

		expect(await getPublishedPost(draftSlug)).toBeUndefined();
		const published = await getPublishedPost(publishedSlug);
		expect(published?.data.draft).toBe(false);
		expect(published?.data.title).toBe("Published");
		expect(published?.bodyHtml).toBe("<p>body</p>");

		const rss = await listPublishedPostsForRss();
		expect(rss.some((post) => post.slug === publishedSlug)).toBe(true);
		expect(rss.some((post) => post.slug === draftSlug)).toBe(false);
		expect(rss.find((post) => post.slug === publishedSlug)?.bodyHtml).toBe(
			"<p>body</p>",
		);
	});

	it("pages published cards without returning the previous page", async () => {
		const token = crypto.randomUUID();
		const tag = `page-${token}`;
		const slugs = [0, 1, 2, 3].map((n) => `page-${n}-${token}`);
		for (let i = 0; i < slugs.length; i++) {
			await insertPost({
				slug: slugs[i] ?? "",
				title: `P${i}`,
				status: "published",
				publishedAt: `2099-01-${String(10 - i).padStart(2, "0")}T00:00:00.000Z`,
				tag,
			});
		}
		await insertPost({
			slug: `draft-${token}`,
			title: "Hidden",
			status: "draft",
			publishedAt: "2099-01-20T00:00:00.000Z",
			tag,
		});

		const filter = { tag };
		const first = await listPublishedCards({ limit: 2, offset: 0, filter });
		const second = await listPublishedCards({ limit: 2, offset: 2, filter });
		const firstSlugs = first.map((post) => post.slug);
		const secondSlugs = second.map((post) => post.slug);
		expect(firstSlugs).toEqual([slugs[0], slugs[1]]);
		expect(secondSlugs).toEqual([slugs[2], slugs[3]]);
		expect(firstSlugs.some((slug) => secondSlugs.includes(slug))).toBe(false);
		expect(firstSlugs).not.toContain(`draft-${token}`);
		expect(first.every((post) => post.bodyHtml === "")).toBe(true);
	});

	it("counts tags and categories like a published-only table scan", async () => {
		const token = crypto.randomUUID();
		const tag = `scan-tag-${token}`;
		const category = `scan-cat-${token}`;
		await insertPost({
			slug: `a-${token}`,
			title: "A",
			status: "published",
			publishedAt: "2026-02-01T00:00:00.000Z",
			tag,
			category,
		});
		await insertPost({
			slug: `b-${token}`,
			title: "B",
			status: "published",
			publishedAt: "2026-02-02T00:00:00.000Z",
			tag,
			category,
		});
		await insertPost({
			slug: `draft-${token}`,
			title: "Draft",
			status: "draft",
			publishedAt: "2026-02-03T00:00:00.000Z",
			tag,
			category,
		});

		const total = await countPublishedPosts();
		const cards = await listPublishedCards({
			limit: Math.max(total, 1),
			offset: 0,
		});
		const tagCounts = new Map<string, number>();
		const categoryCounts = new Map<string | null, number>();
		for (const post of cards) {
			for (const name of post.data.tags) {
				tagCounts.set(name, (tagCounts.get(name) ?? 0) + 1);
			}
			const key = post.data.category?.trim() || null;
			categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
		}

		const tags = await listPublishedTags();
		expect(tags).toHaveLength(tagCounts.size);
		for (const row of tags) {
			expect(row.count).toBe(tagCounts.get(row.name));
		}

		const categories = await listPublishedCategories();
		expect(categories).toHaveLength(categoryCounts.size);
		for (const row of categories) {
			expect(row.count).toBe(categoryCounts.get(row.name));
		}
		expect(tags.find((row) => row.name === tag)?.count).toBe(2);
		expect(categories.find((row) => row.name === category)?.count).toBe(2);
	});
});
