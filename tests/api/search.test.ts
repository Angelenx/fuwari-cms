import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { api } from "../../src/api/app";

async function insertPost(opts: {
	slug: string;
	title: string;
	status: "draft" | "published";
	bodyMd?: string;
}): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO posts (
			slug, title, description, body_md, body_html, excerpt, cover_url,
			status, category, lang, published_at, word_count, reading_minutes, headings_json
		) VALUES (?, ?, '', ?, '<p>body</p>', '', '', ?, NULL, 'en', '2026-09-18T00:00:00.000Z', 1, 1, '[]')`,
	)
		.bind(opts.slug, opts.title, opts.bodyMd ?? "", opts.status)
		.run();
}

describe("GET /api/search", () => {
	it("returns published hits and never drafts", async () => {
		const token = crypto.randomUUID();
		const published = `pub-${token}`;
		const draft = `draft-${token}`;
		await insertPost({
			slug: published,
			title: `Visible ${token}`,
			status: "published",
			bodyMd: `unique-body ${token}`,
		});
		await insertPost({
			slug: draft,
			title: `Hidden ${token}`,
			status: "draft",
			bodyMd: `unique-body ${token}`,
		});

		const empty = await api.request("/search?q=", {}, env);
		expect(empty.status).toBe(200);
		expect(await empty.json()).toEqual({ results: [] });

		const titled = await api.request(
			`/search?q=${encodeURIComponent(token)}`,
			{},
			env,
		);
		expect(titled.status).toBe(200);
		const titledBody = (await titled.json()) as {
			results: Array<{ url: string; meta: { title: string }; excerpt: string }>;
		};
		expect(titledBody.results.map((hit) => hit.url)).toEqual([
			`/posts/${published}/`,
		]);
		expect(titledBody.results[0]?.meta.title).toBe(`Visible ${token}`);
		expect(titledBody.results[0]?.excerpt).toContain("<mark>");

		const byBody = await api.request(
			`/search?q=${encodeURIComponent(`unique-body ${token}`)}`,
			{},
			env,
		);
		expect(byBody.status).toBe(200);
		const byBodyHits = (await byBody.json()) as {
			results: Array<{ url: string }>;
		};
		expect(
			byBodyHits.results.some((hit) => hit.url === `/posts/${published}/`),
		).toBe(true);
		expect(
			byBodyHits.results.some((hit) => hit.url === `/posts/${draft}/`),
		).toBe(false);
	});
});
