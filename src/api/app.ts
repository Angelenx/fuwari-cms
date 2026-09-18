import { Hono } from "hono";
import { searchPublishedPosts } from "../lib/posts";
import { admin } from "./admin";
import { auth } from "./auth";
import type { AppEnv } from "./env";

/**
 * JSON API mounted under `/api` by `src/fetch.ts`.
 *
 * Kept free of Astro imports so it can be unit-tested with `api.request()`
 * without booting the Astro pipeline.
 */
export const api = new Hono<AppEnv>()
	.get("/health", (c) => c.json({ ok: true }))
	.get("/search", async (c) => {
		return c.json({
			results: await searchPublishedPosts(c.req.query("q") ?? ""),
		});
	})
	.route("/auth", auth)
	.route("/admin", admin)
	// Trust boundary: anything under /api that is not routed above is a 404, never falls through to Astro pages.
	.notFound((c) => c.json({ error: "Not Found" }, 404));
