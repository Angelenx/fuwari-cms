import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { api } from "../../src/api/app";
import { hashPassword } from "../../src/lib/auth/password";
import { getPublishedPost, listPublishedPosts } from "../../src/lib/posts";

async function loginCookie(): Promise<string> {
	const username = `user-${crypto.randomUUID()}`;
	const password = "secret";
	const passwordHash = await hashPassword(password);
	await env.DB.prepare(
		"INSERT INTO users (username, password_hash) VALUES (?, ?)",
	)
		.bind(username, passwordHash)
		.run();
	const res = await api.request(
		"/auth/login",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ username, password }),
		},
		env,
	);
	expect(res.status).toBe(200);
	const sid = res.headers
		.getSetCookie()
		.find((line) => line.startsWith("sid="));
	expect(sid).toBeDefined();
	return sid?.split(";", 1)[0] ?? "";
}

function jsonInit(cookie: string, method: string, body?: unknown): RequestInit {
	return {
		method,
		headers: {
			"content-type": "application/json",
			cookie,
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	};
}

describe("admin post CRUD", () => {
	it("returns 401 for every admin write path without a session", async () => {
		const paths: Array<[string, RequestInit]> = [
			["/admin/posts", {}],
			[
				"/admin/posts",
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: "{}",
				},
			],
			[
				"/admin/preview",
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: '{"body_md":"x"}',
				},
			],
			["/admin/profile", {}],
			[
				"/admin/profile",
				{
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: "{}",
				},
			],
			["/admin/site", {}],
			[
				"/admin/site",
				{
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: "{}",
				},
			],
			["/admin/about", {}],
			[
				"/admin/about",
				{
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: "{}",
				},
			],
			["/admin/posts/1", {}],
			[
				"/admin/posts/1",
				{
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: "{}",
				},
			],
			["/admin/posts/1", { method: "DELETE" }],
			["/admin/ai/suggest-title", { method: "POST" }],
		];
		for (const [path, init] of paths) {
			const res = await api.request(path, init, env);
			expect(res.status, path).toBe(401);
		}
	});

	it(
		"creates, publishes, withdraws, and deletes a post",
		{ timeout: 30_000 },
		async () => {
			const cookie = await loginCookie();
			const slug = `crud-${crypto.randomUUID()}`;

			const created = await api.request(
				"/admin/posts",
				jsonInit(cookie, "POST", {
					slug,
					title: "CRUD Post",
					bodyMd: "# Title\n\nHello world.\n",
					status: "draft",
					tags: ["Demo"],
				}),
				env,
			);
			expect(created.status).toBe(201);
			const createdBody = (await created.json()) as {
				post: { id: number; status: string; slug: string };
			};
			const id = createdBody.post.id;
			expect(createdBody.post.status).toBe("draft");
			expect(await getPublishedPost(slug)).toBeUndefined();

			const listed = await api.request(
				"/admin/posts",
				{ headers: { cookie } },
				env,
			);
			expect(listed.status).toBe(200);
			const listedBody = (await listed.json()) as {
				posts: Array<{ id: number }>;
			};
			expect(listedBody.posts.some((p) => p.id === id)).toBe(true);

			const preview = await api.request(
				"/admin/preview",
				jsonInit(cookie, "POST", { body_md: "# Preview\n\nHi.\n" }),
				env,
			);
			expect(preview.status).toBe(200);
			const previewBody = (await preview.json()) as {
				bodyHtml: string;
				excerpt: string;
			};
			expect(previewBody.bodyHtml).toContain("<h1");
			expect(previewBody.excerpt).toBe("Hi.");

			const published = await api.request(
				`/admin/posts/${id}`,
				jsonInit(cookie, "PUT", { status: "published" }),
				env,
			);
			expect(published.status).toBe(200);
			const publicPost = await getPublishedPost(slug);
			expect(publicPost?.data.title).toBe("CRUD Post");
			expect(publicPost?.data.draft).toBe(false);
			expect(publicPost?.bodyHtml).toContain("<h1");
			expect(publicPost?.data.tags).toEqual(["Demo"]);

			const withdrawn = await api.request(
				`/admin/posts/${id}`,
				jsonInit(cookie, "PUT", { status: "draft" }),
				env,
			);
			expect(withdrawn.status).toBe(200);
			expect(await getPublishedPost(slug)).toBeUndefined();

			const deleted = await api.request(
				`/admin/posts/${id}`,
				jsonInit(cookie, "DELETE"),
				env,
			);
			expect(deleted.status).toBe(204);
			const missing = await api.request(
				`/admin/posts/${id}`,
				{ headers: { cookie } },
				env,
			);
			expect(missing.status).toBe(404);
		},
	);

	it(
		"rejects a bad slug and a duplicate slug",
		{ timeout: 30_000 },
		async () => {
			const cookie = await loginCookie();
			const bad = await api.request(
				"/admin/posts",
				jsonInit(cookie, "POST", {
					slug: "Hello World",
					title: "Nope",
					bodyMd: "x",
					status: "draft",
				}),
				env,
			);
			expect(bad.status).toBe(400);

			const slug = `dup-${crypto.randomUUID()}`;
			const first = await api.request(
				"/admin/posts",
				jsonInit(cookie, "POST", {
					slug,
					title: "One",
					bodyMd: "a",
					status: "draft",
				}),
				env,
			);
			expect(first.status).toBe(201);
			const second = await api.request(
				"/admin/posts",
				jsonInit(cookie, "POST", {
					slug,
					title: "Two",
					bodyMd: "b",
					status: "draft",
				}),
				env,
			);
			expect(second.status).toBe(409);
		},
	);

	it("rejects an unknown post language", { timeout: 30_000 }, async () => {
		const cookie = await loginCookie();
		const res = await api.request(
			"/admin/posts",
			jsonInit(cookie, "POST", {
				slug: `lang-${crypto.randomUUID()}`,
				title: "Lang",
				bodyMd: "x",
				status: "draft",
				lang: "not-a-locale",
			}),
			env,
		);
		expect(res.status).toBe(400);
	});

	it(
		"uses a custom publishedAt on the public timeline",
		{ timeout: 30_000 },
		async () => {
			const cookie = await loginCookie();
			const newerSlug = `newer-${crypto.randomUUID()}`;
			const olderSlug = `older-${crypto.randomUUID()}`;
			const newer = await api.request(
				"/admin/posts",
				jsonInit(cookie, "POST", {
					slug: newerSlug,
					title: "Newer",
					bodyMd: "n",
					status: "published",
					publishedAt: "2020-06-01T00:00:00.000Z",
				}),
				env,
			);
			expect(newer.status).toBe(201);
			const older = await api.request(
				"/admin/posts",
				jsonInit(cookie, "POST", {
					slug: olderSlug,
					title: "Older",
					bodyMd: "o",
					status: "published",
					publishedAt: "2019-01-01T00:00:00.000Z",
				}),
				env,
			);
			expect(older.status).toBe(201);
			expect(
				(await older.json()) as { post: { publishedAt: string } },
			).toMatchObject({
				post: { publishedAt: "2019-01-01T00:00:00.000Z" },
			});

			const listed = await listPublishedPosts();
			const slugs = listed.map((post) => post.slug);
			expect(slugs.indexOf(newerSlug)).toBeLessThan(slugs.indexOf(olderSlug));
			expect(
				(await getPublishedPost(newerSlug))?.data.published.toISOString(),
			).toBe("2020-06-01T00:00:00.000Z");
		},
	);

	it("rejects an invalid publishedAt", { timeout: 30_000 }, async () => {
		const cookie = await loginCookie();
		const res = await api.request(
			"/admin/posts",
			jsonInit(cookie, "POST", {
				slug: `when-${crypto.randomUUID()}`,
				title: "When",
				bodyMd: "x",
				status: "published",
				publishedAt: "not-a-date",
			}),
			env,
		);
		expect(res.status).toBe(400);
	});

	it("returns ISO publishedAt when D1 stored sqlite datetime", async () => {
		const cookie = await loginCookie();
		const slug = `sqlite-date-${crypto.randomUUID()}`;
		await env.DB.prepare(
			`INSERT INTO posts (
				slug, title, description, body_md, body_html, excerpt, cover_url,
				status, category, lang, published_at, word_count, reading_minutes, headings_json
			) VALUES (?, 'Sqlite date', '', '', '<p>x</p>', '', '', 'published', NULL, 'en',
				'2020-06-01 08:00:00', 1, 1, '[]')`,
		)
			.bind(slug)
			.run();
		const row = await env.DB.prepare("SELECT id FROM posts WHERE slug = ?")
			.bind(slug)
			.first<{ id: number }>();
		expect(row?.id).toBeDefined();
		const res = await api.request(
			`/admin/posts/${row?.id}`,
			{ headers: { cookie } },
			env,
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			post: { publishedAt: "2020-06-01T08:00:00.000Z" },
		});
	});

	it("returns 501 for AI stubs", { timeout: 30_000 }, async () => {
		const cookie = await loginCookie();
		const res = await api.request(
			"/admin/ai/suggest-title",
			jsonInit(cookie, "POST", {}),
			env,
		);
		expect(res.status).toBe(501);
	});
});
