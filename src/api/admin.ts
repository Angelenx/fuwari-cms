import { env } from "cloudflare:workers";
import { Hono } from "hono";
import {
	createPost,
	deletePost,
	getAdminPost,
	listAdminPosts,
	type PostWriteInput,
	updatePost,
} from "../lib/admin-posts";
import { hashPassword, verifyPassword } from "../lib/auth/password";
import { createSession, getSession } from "../lib/auth/session";
import { MIN_PASSWORD_LENGTH } from "../lib/auth/setup";
import { renderMarkdown } from "../lib/markdown";
import {
	getSiteSettings,
	parseAboutInput,
	parseSiteIdentityInput,
	parseSiteSettingsInput,
	upsertAbout,
	upsertSiteIdentity,
	upsertSiteSettings,
} from "../lib/site-settings";
import type { AppEnv } from "./env";

/**
 * Authenticated admin JSON API. Unauthenticated calls return 401 before 404
 * so missing routes do not leak that they exist.
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX = 100;

function jsonBody(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function parseId(raw: string): number | undefined {
	if (!/^[1-9]\d*$/.test(raw)) {
		return undefined;
	}
	return Number(raw);
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function parseTags(value: unknown): string[] | { error: string } | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
		return { error: "Invalid tags" };
	}
	const tags = [
		...new Set(
			value.map((item) => item.trim()).filter((item) => item.length > 0),
		),
	];
	return tags;
}

function parseSlug(value: unknown): string | { error: string } {
	if (
		typeof value !== "string" ||
		value.length > SLUG_MAX ||
		!SLUG_RE.test(value)
	) {
		return { error: "Invalid slug" };
	}
	return value;
}

function parseCreate(body: unknown): PostWriteInput | { error: string } {
	if (!jsonBody(body)) {
		return { error: "Invalid body" };
	}
	const slug = parseSlug(body.slug);
	if (typeof slug !== "string") {
		return slug;
	}
	const title = asString(body.title)?.trim();
	if (!title) {
		return { error: "Invalid title" };
	}
	if (typeof body.bodyMd !== "string") {
		return { error: "Invalid bodyMd" };
	}
	if (body.status !== "draft" && body.status !== "published") {
		return { error: "Invalid status" };
	}
	const tags = parseTags(body.tags);
	if (tags && "error" in tags) {
		return tags;
	}
	const categoryRaw = body.category;
	if (
		categoryRaw !== undefined &&
		categoryRaw !== null &&
		typeof categoryRaw !== "string"
	) {
		return { error: "Invalid category" };
	}
	return {
		slug,
		title,
		description: asString(body.description) ?? "",
		bodyMd: body.bodyMd,
		coverUrl: asString(body.coverUrl) ?? "",
		category:
			typeof categoryRaw === "string"
				? categoryRaw.trim() || null
				: (categoryRaw ?? null),
		lang: asString(body.lang)?.trim() || "en",
		tags: tags ?? [],
		status: body.status,
	};
}

function parsePatch(
	body: unknown,
): Partial<PostWriteInput> | { error: string } {
	if (!jsonBody(body)) {
		return { error: "Invalid body" };
	}
	const patch: Partial<PostWriteInput> = {};
	if (body.slug !== undefined) {
		const slug = parseSlug(body.slug);
		if (typeof slug !== "string") {
			return slug;
		}
		patch.slug = slug;
	}
	if (body.title !== undefined) {
		const title = asString(body.title)?.trim();
		if (!title) {
			return { error: "Invalid title" };
		}
		patch.title = title;
	}
	if (body.description !== undefined) {
		if (typeof body.description !== "string") {
			return { error: "Invalid description" };
		}
		patch.description = body.description;
	}
	if (body.bodyMd !== undefined) {
		if (typeof body.bodyMd !== "string") {
			return { error: "Invalid bodyMd" };
		}
		patch.bodyMd = body.bodyMd;
	}
	if (body.coverUrl !== undefined) {
		if (typeof body.coverUrl !== "string") {
			return { error: "Invalid coverUrl" };
		}
		patch.coverUrl = body.coverUrl;
	}
	if (body.category !== undefined) {
		if (body.category !== null && typeof body.category !== "string") {
			return { error: "Invalid category" };
		}
		patch.category =
			typeof body.category === "string" ? body.category.trim() || null : null;
	}
	if (body.lang !== undefined) {
		if (typeof body.lang !== "string" || !body.lang.trim()) {
			return { error: "Invalid lang" };
		}
		patch.lang = body.lang.trim();
	}
	if (body.tags !== undefined) {
		const tags = parseTags(body.tags);
		if (tags && "error" in tags) {
			return tags;
		}
		patch.tags = tags ?? [];
	}
	if (body.status !== undefined) {
		if (body.status !== "draft" && body.status !== "published") {
			return { error: "Invalid status" };
		}
		patch.status = body.status;
	}
	return patch;
}

function isUniqueError(err: unknown): boolean {
	return String(err).includes("UNIQUE");
}

const posts = new Hono<AppEnv>()
	.get("/", async (c) => {
		return c.json({ posts: await listAdminPosts() });
	})
	.post("/", async (c) => {
		let body: unknown;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: "Invalid JSON" }, 400);
		}
		const parsed = parseCreate(body);
		if ("error" in parsed) {
			return c.json({ error: parsed.error }, 400);
		}
		try {
			const post = await createPost(parsed);
			return c.json({ post }, 201);
		} catch (err) {
			if (isUniqueError(err)) {
				return c.json({ error: "Slug already exists" }, 409);
			}
			throw err;
		}
	})
	.get("/:id", async (c) => {
		const id = parseId(c.req.param("id"));
		if (id === undefined) {
			return c.json({ error: "Not Found" }, 404);
		}
		const post = await getAdminPost(id);
		if (!post) {
			return c.json({ error: "Not Found" }, 404);
		}
		return c.json({ post });
	})
	.put("/:id", async (c) => {
		const id = parseId(c.req.param("id"));
		if (id === undefined) {
			return c.json({ error: "Not Found" }, 404);
		}
		let body: unknown;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: "Invalid JSON" }, 400);
		}
		const parsed = parsePatch(body);
		if ("error" in parsed) {
			return c.json({ error: parsed.error }, 400);
		}
		try {
			const post = await updatePost(id, parsed);
			if (!post) {
				return c.json({ error: "Not Found" }, 404);
			}
			return c.json({ post });
		} catch (err) {
			if (isUniqueError(err)) {
				return c.json({ error: "Slug already exists" }, 409);
			}
			throw err;
		}
	})
	.delete("/:id", async (c) => {
		const id = parseId(c.req.param("id"));
		if (id === undefined) {
			return c.json({ error: "Not Found" }, 404);
		}
		const deleted = await deletePost(id);
		if (!deleted) {
			return c.json({ error: "Not Found" }, 404);
		}
		return c.body(null, 204);
	});

export const admin = new Hono<AppEnv>()
	.use("*", async (c, next) => {
		const user = await getSession(c);
		if (!user) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		await next();
	})
	.post("/preview", async (c) => {
		let body: unknown;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: "Invalid JSON" }, 400);
		}
		if (!jsonBody(body)) {
			return c.json({ error: "Invalid body" }, 400);
		}
		const markdown =
			typeof body.body_md === "string"
				? body.body_md
				: typeof body.bodyMd === "string"
					? body.bodyMd
					: undefined;
		if (markdown === undefined) {
			return c.json({ error: "Invalid body" }, 400);
		}
		return c.json(await renderMarkdown(markdown));
	})
	.get("/profile", async (c) => {
		return c.json(await getSiteSettings());
	})
	.put("/profile", async (c) => {
		let body: unknown;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: "Invalid JSON" }, 400);
		}
		const parsed = parseSiteSettingsInput(body);
		if ("error" in parsed) {
			return c.json({ error: parsed.error }, 400);
		}
		return c.json(await upsertSiteSettings(parsed));
	})
	.get("/site", async (c) => {
		const { site } = await getSiteSettings();
		return c.json({ site });
	})
	.put("/site", async (c) => {
		let body: unknown;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: "Invalid JSON" }, 400);
		}
		const parsed = parseSiteIdentityInput(body);
		if ("error" in parsed) {
			return c.json({ error: parsed.error }, 400);
		}
		const saved = await upsertSiteIdentity(parsed);
		return c.json({ site: saved.site });
	})
	.get("/about", async (c) => {
		const { about } = await getSiteSettings();
		return c.json({ bodyMd: about.md, bodyHtml: about.html });
	})
	.put("/about", async (c) => {
		let body: unknown;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: "Invalid JSON" }, 400);
		}
		const parsed = parseAboutInput(body);
		if ("error" in parsed) {
			return c.json({ error: parsed.error }, 400);
		}
		const rendered = await renderMarkdown(parsed.bodyMd);
		const saved = await upsertAbout({
			bodyMd: parsed.bodyMd,
			bodyHtml: rendered.bodyHtml,
		});
		return c.json({ bodyMd: saved.about.md, bodyHtml: saved.about.html });
	})
	.put("/password", async (c) => {
		const user = await getSession(c);
		if (!user) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		let body: unknown;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: "Invalid JSON" }, 400);
		}
		if (
			!jsonBody(body) ||
			typeof body.currentPassword !== "string" ||
			typeof body.newPassword !== "string"
		) {
			return c.json({ error: "Invalid body" }, 400);
		}
		if (body.newPassword.length < MIN_PASSWORD_LENGTH) {
			return c.json(
				{
					error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
				},
				400,
			);
		}
		const row = await env.DB.prepare(
			"SELECT password_hash FROM users WHERE id = ?",
		)
			.bind(user.id)
			.first<{ password_hash: string }>();
		const ok = await verifyPassword(body.currentPassword, row?.password_hash);
		if (!row || !ok) {
			return c.json({ error: "Invalid current password" }, 401);
		}
		const passwordHash = await hashPassword(body.newPassword);
		// Drop every sid for this user so stolen cookies die; issue a fresh one.
		await env.DB.batch([
			env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(
				passwordHash,
				user.id,
			),
			env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
		]);
		await createSession(c, user.id);
		return c.json({ ok: true });
	})
	.all("/ai/:name", (c) => c.json({ error: "Not Implemented" }, 501))
	.route("/posts", posts)
	.notFound((c) => c.json({ error: "Not Found" }, 404));
