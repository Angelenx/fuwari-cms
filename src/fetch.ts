import { actions, i18n, middleware, pages } from "astro/hono";
import { Hono } from "hono";
import { api } from "./api/app";

/**
 * Advanced routing entrypoint (Astro 7). The Cloudflare adapter's default
 * worker entrypoint handles static assets and bindings before calling this app,
 * so no `cf()` companion middleware is needed here.
 */
const app = new Hono();

// Own JSON API first so `/api/*` never reaches Astro page rendering.
app.route("/api", api);

// Astro's built-in pipeline, in the order documented for `astro/hono`.
app.use(actions());
app.use(middleware());
app.use(pages());
app.use(i18n());

export default app;
