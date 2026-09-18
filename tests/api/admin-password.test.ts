import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { api } from "../../src/api/app";
import { hashPassword } from "../../src/lib/auth/password";

async function loginCookie(
	username: string,
	password: string,
): Promise<string> {
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

describe("admin password API", () => {
	it("returns 401 without a session", async () => {
		const res = await api.request(
			"/admin/password",
			{
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					currentPassword: "password1",
					newPassword: "password2",
				}),
			},
			env,
		);
		expect(res.status).toBe(401);
	});

	it(
		"rejects a wrong current password and a short new password",
		{ timeout: 30_000 },
		async () => {
			const username = `user-${crypto.randomUUID()}`;
			const cookie = await loginCookie(username, "password1");

			const wrong = await api.request(
				"/admin/password",
				{
					method: "PUT",
					headers: {
						"content-type": "application/json",
						cookie,
					},
					body: JSON.stringify({
						currentPassword: "nope-nope",
						newPassword: "password2",
					}),
				},
				env,
			);
			expect(wrong.status).toBe(401);
			expect(await wrong.json()).toEqual({
				error: "Invalid current password",
			});

			const short = await api.request(
				"/admin/password",
				{
					method: "PUT",
					headers: {
						"content-type": "application/json",
						cookie,
					},
					body: JSON.stringify({
						currentPassword: "password1",
						newPassword: "short",
					}),
				},
				env,
			);
			expect(short.status).toBe(400);
		},
	);

	it(
		"updates the hash, rotates the session, and accepts the new password",
		{ timeout: 60_000 },
		async () => {
			const username = `user-${crypto.randomUUID()}`;
			const cookie = await loginCookie(username, "password1");

			const put = await api.request(
				"/admin/password",
				{
					method: "PUT",
					headers: {
						"content-type": "application/json",
						cookie,
					},
					body: JSON.stringify({
						currentPassword: "password1",
						newPassword: "password2",
					}),
				},
				env,
			);
			expect(put.status).toBe(200);
			expect(await put.json()).toEqual({ ok: true });
			const nextSid = put.headers
				.getSetCookie()
				.find((line) => line.startsWith("sid="));
			expect(nextSid).toBeDefined();
			const nextCookie = nextSid?.split(";", 1)[0] ?? "";

			const stale = await api.request("/auth/me", { headers: { cookie } }, env);
			expect(stale.status).toBe(401);

			const me = await api.request(
				"/auth/me",
				{ headers: { cookie: nextCookie } },
				env,
			);
			expect(me.status).toBe(200);

			const oldLogin = await api.request(
				"/auth/login",
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ username, password: "password1" }),
				},
				env,
			);
			expect(oldLogin.status).toBe(401);

			const newLogin = await api.request(
				"/auth/login",
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ username, password: "password2" }),
				},
				env,
			);
			expect(newLogin.status).toBe(200);
		},
	);
});
