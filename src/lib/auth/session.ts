import { env } from "cloudflare:workers";
import type { Context } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";

type AuthEnv = { Bindings: Cloudflare.Env };

/**
 * Astro calls Hono.fetch(request) without the Worker env argument, so `c.env`
 * is undefined outside `api.request(..., env)`. Bindings come from
 * `cloudflare:workers`, same as `src/lib/posts.ts`.
 */

/** HMAC-signed cookie holding the D1 session id. */
export const SESSION_COOKIE = "sid";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export type SessionUser = {
	id: number;
	username: string;
};

type SessionRow = {
	user_id: number;
	username: string;
};

function cookieOpts(url: string): {
	httpOnly: true;
	sameSite: "Lax";
	path: "/";
	secure: boolean;
	maxAge: number;
} {
	return {
		httpOnly: true,
		sameSite: "Lax",
		path: "/",
		// Local `astro dev` is http://; Secure would drop the cookie on localhost.
		secure: new URL(url).protocol === "https:",
		maxAge: SESSION_TTL_SECONDS,
	};
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function lookupSession(
	db: D1Database,
	sessionId: string | undefined | false,
): Promise<SessionUser | null> {
	if (!sessionId) {
		return null;
	}
	const row = await db
		.prepare(
			`SELECT u.id AS user_id, u.username
			 FROM sessions s
			 JOIN users u ON u.id = s.user_id
			 WHERE s.id = ? AND s.expires_at > datetime('now')`,
		)
		.bind(sessionId)
		.first<SessionRow>();
	if (!row) {
		return null;
	}
	return { id: row.user_id, username: row.username };
}

/** Validate the signed `sid` cookie against D1. Expired / forged / unknown → null. */
export async function getSession(
	c: Context<AuthEnv>,
): Promise<SessionUser | null> {
	const secret = env.SESSION_SECRET;
	if (!secret) {
		return null;
	}
	const sessionId = await getSignedCookie(c, secret, SESSION_COOKIE);
	return lookupSession(env.DB, sessionId);
}

/**
 * Same lookup for Astro pages that have a Request but not a Hono Context.
 * getSignedCookie only reads `c.req.raw` Cookie, so a shim is enough.
 */
export async function getSessionFromRequest(
	request: Request,
	bindings: Cloudflare.Env,
): Promise<SessionUser | null> {
	if (!bindings.SESSION_SECRET) {
		return null;
	}
	const shim = {
		req: { raw: request },
	} as Context<AuthEnv>;
	const sessionId = await getSignedCookie(
		shim,
		bindings.SESSION_SECRET,
		SESSION_COOKIE,
	);
	return lookupSession(bindings.DB, sessionId);
}

/** Insert a session row, drop expired rows, and set the signed cookie. */
export async function createSession(
	c: Context<AuthEnv>,
	userId: number,
): Promise<void> {
	const secret = env.SESSION_SECRET;
	if (!secret) {
		throw new Error("SESSION_SECRET is not configured");
	}
	const id = toHex(crypto.getRandomValues(new Uint8Array(32)));
	await env.DB.batch([
		env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')"),
		env.DB.prepare(
			`INSERT INTO sessions (id, user_id, expires_at)
			 VALUES (?, ?, datetime('now', '+7 days'))`,
		).bind(id, userId),
	]);
	await setSignedCookie(c, SESSION_COOKIE, id, secret, cookieOpts(c.req.url));
}

/** Delete the D1 row (if any) and clear the cookie. Missing cookie is a no-op. */
export async function destroySession(c: Context<AuthEnv>): Promise<void> {
	const secret = env.SESSION_SECRET;
	if (secret) {
		const sessionId = await getSignedCookie(c, secret, SESSION_COOKIE);
		if (sessionId) {
			await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
				.bind(sessionId)
				.run();
		}
	}
	deleteCookie(c, SESSION_COOKIE, cookieOpts(c.req.url));
}
