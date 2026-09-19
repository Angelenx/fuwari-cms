import { Hono } from "hono";
import {
	listPublishedArchivePage,
	listPublishedYearCounts,
	parseArchiveCursor,
	searchPublishedPosts,
} from "../lib/posts";
import { admin } from "./admin";
import { auth } from "./auth";
import type { AppEnv } from "./env";

const ARCHIVE_LIMIT_DEFAULT = 20;
const ARCHIVE_LIMIT_MAX = 50;

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
	// Public archive feed. Always `status = 'published'` (enforced in the repository).
	.get("/posts", async (c) => {
		const limitRaw = c.req.query("limit");
		let limit = ARCHIVE_LIMIT_DEFAULT;
		if (limitRaw !== undefined && limitRaw !== "") {
			const parsed = Number(limitRaw);
			if (!Number.isInteger(parsed) || parsed < 1) {
				return c.json({ error: "Invalid limit" }, 400);
			}
			limit = Math.min(parsed, ARCHIVE_LIMIT_MAX);
		}
		const cursor = parseArchiveCursor(c.req.query("cursor"));
		if (cursor && "error" in cursor) {
			return c.json({ error: cursor.error }, 400);
		}
		const uncategorizedRaw = c.req.query("uncategorized");
		const filter = {
			tag: c.req.query("tag") || undefined,
			category: c.req.query("category") || undefined,
			uncategorized: uncategorizedRaw === "true" || uncategorizedRaw === "1",
		};
		const page = await listPublishedArchivePage({
			limit,
			cursor: cursor && !("error" in cursor) ? cursor : undefined,
			filter,
		});
		if (!cursor) {
			return c.json({
				...page,
				yearCounts: await listPublishedYearCounts(filter),
			});
		}
		return c.json(page);
	})
	.route("/auth", auth)
	.route("/admin", admin)
	// Trust boundary: anything under /api that is not routed above is a 404, never falls through to Astro pages.
	.notFound((c) => c.json({ error: "Not Found" }, 404));
