import { Hono } from "hono";
import { getSession } from "../lib/auth/session";
import type { AppEnv } from "./env";

/**
 * Authenticated admin JSON API. Unauthenticated calls return 401 before 404
 * so missing routes do not leak that they exist.
 */
export const admin = new Hono<AppEnv>()
	.use("*", async (c, next) => {
		const user = await getSession(c);
		if (!user) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		await next();
	})
	.get("/ping", (c) => c.json({ ok: true }))
	.notFound((c) => c.json({ error: "Not Found" }, 404));
