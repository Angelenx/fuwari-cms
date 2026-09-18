import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../../src/api/app";
import { profileConfig } from "../../src/config";
import { hashPassword } from "../../src/lib/auth/password";
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

function profileBody() {
	return {
		avatar: "https://example.com/me.png",
		name: "Ada Lovelace",
		bio: "Notes",
		links: [
			{ url: "https://blog.csdn.net/ada" },
			{ url: "https://space.bilibili.com/1" },
			{ url: "https://github.com/ada" },
		],
		banner: {
			enable: false,
			src: "https://example.com/banner.png",
			position: "bottom",
			credit: { enable: false, text: "Pixiv", url: "" },
		},
	};
}

describe("admin profile API", () => {
	beforeEach(async () => {
		await env.DB.prepare("DELETE FROM site_settings").run();
	});
	it("returns 401 without a session", async () => {
		const get = await api.request("/admin/profile", {}, env);
		expect(get.status).toBe(401);
		const put = await api.request(
			"/admin/profile",
			{
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: "{}",
			},
			env,
		);
		expect(put.status).toBe(401);
	});

	it("returns config defaults then persists a PUT", async () => {
		const cookie = await loginCookie();
		const empty = await api.request(
			"/admin/profile",
			{ headers: { cookie } },
			env,
		);
		expect(empty.status).toBe(200);
		const before = (await empty.json()) as { profile: { name: string } };
		expect(before.profile.name).toBe(profileConfig.name);

		const put = await api.request(
			"/admin/profile",
			{
				method: "PUT",
				headers: {
					"content-type": "application/json",
					cookie,
				},
				body: JSON.stringify(profileBody()),
			},
			env,
		);
		expect(put.status).toBe(200);
		const saved = await getSiteSettings();
		expect(saved.profile.name).toBe("Ada Lovelace");
		expect(saved.profile.links[0]?.icon).toBe("simple-icons:csdn");
		expect(saved.banner.enable).toBe(false);
		expect(saved.banner.src).toBe("https://example.com/banner.png");
		expect(saved.banner.position).toBe("bottom");
	});
});
