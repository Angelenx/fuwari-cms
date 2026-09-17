import { Hono } from "hono";

/**
 * JSON API mounted under `/api` by `src/fetch.ts`.
 *
 * Kept free of Astro imports so it can be unit-tested with `api.request()`
 * without booting the Astro pipeline.
 */
export const api = new Hono()
	.get("/health", (c) => c.json({ ok: true }))
	// Trust boundary: anything under /api that is not routed above is a 404, never falls through to Astro pages.
	.notFound((c) => c.json({ error: "Not Found" }, 404));
