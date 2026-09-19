import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../../src/api/app";
import { siteConfig } from "../../src/config";
import { hashPassword } from "../../src/lib/auth/password";
import { getSpecPageHtml } from "../../src/lib/posts";
import { getSiteSettings } from "../../src/lib/site-settings";

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

describe("admin site and about API", () => {
	beforeEach(async () => {
		await env.DB.prepare("DELETE FROM site_settings").run();
	});

	it("returns 401 without a session", async () => {
		for (const path of ["/admin/site", "/admin/about"]) {
			const get = await api.request(path, {}, env);
			expect(get.status, path).toBe(401);
			const put = await api.request(
				path,
				{
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: "{}",
				},
				env,
			);
			expect(put.status, path).toBe(401);
		}
	});

	it("persists title and about markdown", async () => {
		const cookie = await loginCookie();
		const sitePut = await api.request(
			"/admin/site",
			{
				method: "PUT",
				headers: {
					"content-type": "application/json",
					cookie,
				},
				body: JSON.stringify({
					title: "Ada Blog",
					subtitle: "Notes",
					footer: "",
					lang: "zh_CN",
				}),
			},
			env,
		);
		expect(sitePut.status).toBe(200);
		const siteBody = (await sitePut.json()) as {
			site: { title: string; lang: string; clientMarkdown: boolean };
		};
		expect(siteBody.site.title).toBe("Ada Blog");
		expect(siteBody.site.lang).toBe("zh_CN");
		expect(siteBody.site.clientMarkdown).toBe(false);
		expect((await getSiteSettings()).site.lang).toBe("zh_CN");
		expect((await getSiteSettings()).site.clientMarkdown).toBe(false);

		const flagOn = await api.request(
			"/admin/site",
			{
				method: "PUT",
				headers: {
					"content-type": "application/json",
					cookie,
				},
				body: JSON.stringify({
					title: "Ada Blog",
					subtitle: "Notes",
					footer: "",
					lang: "zh_CN",
					clientMarkdown: true,
				}),
			},
			env,
		);
		expect(flagOn.status).toBe(200);
		expect(
			(await flagOn.json()) as { site: { clientMarkdown: boolean } },
		).toMatchObject({ site: { clientMarkdown: true } });

		const emptySite = await api.request(
			"/admin/site",
			{ headers: { cookie } },
			env,
		);
		expect(emptySite.status).toBe(200);

		const aboutPut = await api.request(
			"/admin/about",
			{
				method: "PUT",
				headers: {
					"content-type": "application/json",
					cookie,
				},
				body: JSON.stringify({ bodyMd: "About **Ada**" }),
			},
			env,
		);
		expect(aboutPut.status).toBe(200);
		const html = await getSpecPageHtml("about");
		expect(html).toContain("Ada");
		expect(html).toContain("<strong>");
		expect(siteConfig.title).not.toBe("Ada Blog");

		const aboutClient = await api.request(
			"/admin/about",
			{
				method: "PUT",
				headers: {
					"content-type": "application/json",
					cookie,
				},
				body: JSON.stringify({
					bodyMd: "ignored",
					bodyHtml: '<p data-client="1">About kept</p>',
				}),
			},
			env,
		);
		expect(aboutClient.status).toBe(200);
		expect(await getSpecPageHtml("about")).toBe(
			'<p data-client="1">About kept</p>',
		);
	});
});
