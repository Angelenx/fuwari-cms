/** Hono env for `/api` and `src/fetch.ts` so `c.env` matches wrangler types. */
export type AppEnv = {
	Bindings: Cloudflare.Env;
};
