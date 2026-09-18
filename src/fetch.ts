import { actions, i18n, middleware, pages } from "astro/hono";
import { Hono } from "hono";
import { api } from "./api/app";
import type { AppEnv } from "./api/env";
import { getSession } from "./lib/auth/session";

/**
 * Advanced routing entrypoint (Astro 7). The Cloudflare adapter's default
 * worker entrypoint handles static assets and bindings before calling this app,
 * so no `cf()` companion middleware is needed here.
 */
const app = new Hono<AppEnv>();

function normalizePath(pathname: string): string {
	if (pathname.length > 1 && pathname.endsWith("/")) {
		return pathname.slice(0, -1);
	}
	return pathname;
}

// Own JSON API first so `/api/*` never reaches Astro page rendering.
app.route("/api", api);

// Guard `/admin` pages before Astro renders (same placement as the official
// advanced-routing example). `/api/admin/*` is already handled above.
app.use(async (c, next) => {
	const path = normalizePath(new URL(c.req.url).pathname);
	const isAdminPage = path === "/admin" || path.startsWith("/admin/");
	if (!isAdminPage) {
		return next();
	}

	const user = await getSession(c);
	const isLogin = path === "/admin/login";
	if (isLogin) {
		if (user) {
			return c.redirect("/admin");
		}
		return next();
	}
	if (!user) {
		return c.redirect("/admin/login");
	}
	return next();
});

// Astro's built-in pipeline, in the order documented for `astro/hono`.
app.use(actions());
app.use(middleware());
app.use(pages());
app.use(i18n());

export default app;
