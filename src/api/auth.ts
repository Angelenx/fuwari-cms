import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { verifyPassword } from "../lib/auth/password";
import { createSession, destroySession, getSession } from "../lib/auth/session";
import type { AppEnv } from "./env";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;

type FailBucket = { n: number; reset: number };

// ponytail: isolate-local Map, not shared across Worker isolates; upgrade to D1/KV counters.
const loginFailures = new Map<string, FailBucket>();

function clientIp(c: {
	req: { header: (name: string) => string | undefined };
}): string {
	return c.req.header("CF-Connecting-IP") ?? "local";
}

function tooManyAttempts(ip: string): boolean {
	const now = Date.now();
	const bucket = loginFailures.get(ip);
	if (!bucket || now >= bucket.reset) {
		return false;
	}
	return bucket.n >= LOGIN_MAX_FAILURES;
}

function recordFailure(ip: string): void {
	const now = Date.now();
	const bucket = loginFailures.get(ip);
	if (!bucket || now >= bucket.reset) {
		loginFailures.set(ip, { n: 1, reset: now + LOGIN_WINDOW_MS });
		return;
	}
	bucket.n += 1;
}

type UserRow = {
	id: number;
	username: string;
	password_hash: string;
};

type LoginBody = {
	username: unknown;
	password: unknown;
};

function isLoginBody(value: unknown): value is LoginBody {
	return typeof value === "object" && value !== null;
}

export const auth = new Hono<AppEnv>()
	.post("/login", async (c) => {
		const ip = clientIp(c);
		if (tooManyAttempts(ip)) {
			return c.json({ error: "Too many attempts" }, 429);
		}

		let body: unknown;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: "Invalid JSON" }, 400);
		}
		if (
			!isLoginBody(body) ||
			typeof body.username !== "string" ||
			typeof body.password !== "string"
		) {
			return c.json({ error: "Invalid body" }, 400);
		}

		const user = await env.DB.prepare(
			"SELECT id, username, password_hash FROM users WHERE username = ?",
		)
			.bind(body.username)
			.first<UserRow>();

		// Trust boundary: missing user still runs verifyPassword(undefined) so timing
		// does not leak whether the username exists.
		const ok = await verifyPassword(body.password, user?.password_hash);
		if (!user || !ok) {
			recordFailure(ip);
			return c.json({ error: "Invalid credentials" }, 401);
		}

		loginFailures.delete(ip);
		await createSession(c, user.id);
		return c.json({ username: user.username });
	})
	.post("/logout", async (c) => {
		await destroySession(c);
		return c.body(null, 204);
	})
	.get("/me", async (c) => {
		const user = await getSession(c);
		if (!user) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		return c.json({ username: user.username });
	});
