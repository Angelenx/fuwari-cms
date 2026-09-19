import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { api } from "../../src/api/app";

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

type PostsBody = {
	posts: Array<{ slug: string; title: string }>;
	nextCursor: string | null;
	yearCounts?: Array<{ year: number; count: number }>;
};

describe("GET /api/posts", () => {
	it("lists published posts, pages by cursor, and filters by tag", async () => {
		const token = crypto.randomUUID();
		const tag = `api-${token}`;
		const slugs = [0, 1, 2].map((n) => `api-${n}-${token}`);
		for (let i = 0; i < slugs.length; i++) {
			await insertPost({
				slug: slugs[i] ?? "",
				title: `A${i}`,
				status: "published",
				publishedAt: `2098-01-${String(10 - i).padStart(2, "0")}T00:00:00.000Z`,
				tag,
			});
		}
		await insertPost({
			slug: `draft-${token}`,
			title: "Hidden",
			status: "draft",
			publishedAt: "2098-01-20T00:00:00.000Z",
			tag,
		});
		await insertPost({
			slug: `other-${token}`,
			title: "Other",
			status: "published",
			publishedAt: "2098-01-09T00:00:00.000Z",
			tag: `other-${token}`,
		});

		const firstRes = await api.request(
			`/posts?limit=2&tag=${encodeURIComponent(tag)}`,
			{},
			env,
		);
		expect(firstRes.status).toBe(200);
		const first = (await firstRes.json()) as PostsBody;
		expect(first.posts.map((post) => post.slug)).toEqual([slugs[0], slugs[1]]);
		expect(first.posts.some((post) => post.slug === `draft-${token}`)).toBe(
			false,
		);
		expect(first.nextCursor).toEqual(expect.any(String));
		expect(first.yearCounts).toEqual(
			expect.arrayContaining([{ year: 2098, count: 3 }]),
		);

		const secondRes = await api.request(
			`/posts?limit=2&tag=${encodeURIComponent(tag)}&cursor=${encodeURIComponent(first.nextCursor ?? "")}`,
			{},
			env,
		);
		expect(secondRes.status).toBe(200);
		const second = (await secondRes.json()) as PostsBody;
		expect(second.posts.map((post) => post.slug)).toEqual([slugs[2]]);
		expect(
			first.posts.some((post) =>
				second.posts.some((other) => other.slug === post.slug),
			),
		).toBe(false);
		expect(second.yearCounts).toBeUndefined();
		expect(second.nextCursor).toBeNull();
	});
});
