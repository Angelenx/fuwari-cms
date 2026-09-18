import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
	listAdminPosts,
	listAdminTags,
	parseAdminPostListFilter,
} from "../../src/lib/admin-posts";

async function insertPost(opts: {
	slug: string;
	title: string;
	status: "draft" | "published";
	publishedAt: string | null;
	description?: string;
	bodyMd?: string;
	tag?: string;
}): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO posts (
			slug, title, description, body_md, body_html, excerpt, cover_url,
			status, category, lang, published_at, word_count, reading_minutes, headings_json
		) VALUES (?, ?, ?, ?, '<p>body</p>', '', '', ?, NULL, 'en', ?, 1, 1, '[]')`,
	)
		.bind(
			opts.slug,
			opts.title,
			opts.description ?? "",
			opts.bodyMd ?? "",
			opts.status,
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

describe("admin post list filters", () => {
	it("parses query strings into list filters", () => {
		expect(parseAdminPostListFilter({})).toEqual({
			q: undefined,
			tag: undefined,
			status: "all",
		});
		expect(
			parseAdminPostListFilter({
				q: "  hello  ",
				tag: " Demo ",
				status: "draft",
			}),
		).toEqual({ q: "hello", tag: "Demo", status: "draft" });
		expect(parseAdminPostListFilter({ status: "nope" }).status).toBe("all");
	});

	it("orders by published_at and filters q, tag, and status", async () => {
		const token = crypto.randomUUID();
		const tagA = `alpha-${token}`;
		const tagB = `beta-${token}`;
		const newer = `${token}-newer`;
		const older = `${token}-older`;
		const draft = `${token}-draft`;
		const other = `${token}-other`;

		await insertPost({
			slug: older,
			title: `Hello ${token}`,
			status: "published",
			publishedAt: "2025-01-01T00:00:00.000Z",
			tag: tagB,
		});
		await insertPost({
			slug: newer,
			title: `Hello ${token}`,
			status: "published",
			publishedAt: "2026-06-01T00:00:00.000Z",
			tag: tagA,
		});
		await insertPost({
			slug: draft,
			title: `Hello ${token}`,
			status: "draft",
			publishedAt: null,
			bodyMd: `secretbody ${token}`,
		});
		await insertPost({
			slug: other,
			title: "Unrelated",
			status: "published",
			publishedAt: "2026-12-01T00:00:00.000Z",
			description: "no token here",
		});

		const listed = await listAdminPosts({ q: `Hello ${token}` });
		expect(listed.map((post) => post.slug)).toEqual([newer, older, draft]);
		expect(listed.find((post) => post.slug === newer)?.tags).toEqual([tagA]);

		const tagged = await listAdminPosts({ q: `Hello ${token}`, tag: tagA });
		expect(tagged.map((post) => post.slug)).toEqual([newer]);

		const drafts = await listAdminPosts({
			q: `Hello ${token}`,
			status: "draft",
		});
		expect(drafts.map((post) => post.slug)).toEqual([draft]);

		const published = await listAdminPosts({
			q: `Hello ${token}`,
			status: "published",
		});
		expect(published.map((post) => post.slug)).toEqual([newer, older]);

		const byBody = await listAdminPosts({ q: `secretbody ${token}` });
		expect(byBody.map((post) => post.slug)).toEqual([draft]);

		const tags = await listAdminTags();
		expect(tags.some((tag) => tag.name === tagA && tag.count >= 1)).toBe(true);
		expect(tags.some((tag) => tag.name === tagB && tag.count >= 1)).toBe(true);
	});
});
