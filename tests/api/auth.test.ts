import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { api } from "../../src/api/app";
import { hashPassword } from "../../src/lib/auth/password";

async function insertUser(username: string, password: string): Promise<void> {
	const passwordHash = await hashPassword(password);
	await env.DB.prepare(
		"INSERT INTO users (username, password_hash) VALUES (?, ?)",
	)
		.bind(username, passwordHash)
		.run();
}

function sidCookie(res: Response): string {
	const cookies = res.headers.getSetCookie();
	const sid = cookies.find((line) => line.startsWith("sid="));
	expect(sid).toBeDefined();
	return sid?.split(";", 1)[0] ?? "";
}

function loginRequest(
	username: string,
	password: string,
	ip: string,
): RequestInit {
	return {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"CF-Connecting-IP": ip,
		},
		body: JSON.stringify({ username, password }),
	};
}

describe("auth routes", () => {
	it(
		"rejects a wrong password without setting a session cookie",
		{ timeout: 30_000 },
		async () => {
			const username = `user-${crypto.randomUUID()}`;
			await insertUser(username, "secret");
			const res = await api.request(
				"/auth/login",
				loginRequest(username, "nope", crypto.randomUUID()),
				env,
			);
			expect(res.status).toBe(401);
			expect(await res.json()).toEqual({ error: "Invalid credentials" });
			expect(
				res.headers.getSetCookie().some((line) => line.startsWith("sid=")),
			).toBe(false);
		},
	);

	it(
		"sets a cookie, answers /me, and 401s after logout",
		{ timeout: 30_000 },
		async () => {
			const username = `user-${crypto.randomUUID()}`;
			const password = "secret";
			await insertUser(username, password);
			const ip = crypto.randomUUID();

			const login = await api.request(
				"/auth/login",
				loginRequest(username, password, ip),
				env,
			);
			expect(login.status).toBe(200);
			expect(await login.json()).toEqual({ username });
			const cookie = sidCookie(login);
			expect(login.headers.getSetCookie()[0]).toMatch(/HttpOnly/i);
			expect(login.headers.getSetCookie()[0]).toMatch(/SameSite=Lax/i);

			const me = await api.request("/auth/me", { headers: { cookie } }, env);
			expect(me.status).toBe(200);
			expect(await me.json()).toEqual({ username });

			const ping = await api.request(
				"/admin/ping",
				{ headers: { cookie } },
				env,
			);
			expect(ping.status).toBe(200);
			expect(await ping.json()).toEqual({ ok: true });

			const logout = await api.request(
				"/auth/logout",
				{ method: "POST", headers: { cookie } },
				env,
			);
			expect(logout.status).toBe(204);

			const meAfter = await api.request(
				"/auth/me",
				{ headers: { cookie } },
				env,
			);
			expect(meAfter.status).toBe(401);
		},
	);

	it("returns 401 for /admin without a session, including unknown paths", async () => {
		const ping = await api.request("/admin/ping", {}, env);
		expect(ping.status).toBe(401);
		const missing = await api.request("/admin/does-not-exist", {}, env);
		expect(missing.status).toBe(401);
	});

	it("logout without a cookie is still 204", async () => {
		const res = await api.request("/auth/logout", { method: "POST" }, env);
		expect(res.status).toBe(204);
	});

	it(
		"rate-limits a sixth failed login from the same IP",
		{ timeout: 60_000 },
		async () => {
			const username = `user-${crypto.randomUUID()}`;
			await insertUser(username, "secret");
			const ip = crypto.randomUUID();

			for (let i = 0; i < 5; i++) {
				const res = await api.request(
					"/auth/login",
					loginRequest(username, "nope", ip),
					env,
				);
				expect(res.status).toBe(401);
			}

			const sixth = await api.request(
				"/auth/login",
				loginRequest(username, "nope", ip),
				env,
			);
			expect(sixth.status).toBe(429);
		},
	);
});
