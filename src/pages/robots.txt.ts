import type { APIRoute } from "astro";

// No sitemap yet (SSR routes are not enumerated at build time); keep crawlers out of the admin area.
const robotsTxt = `
User-agent: *
Disallow: /_astro/
Disallow: /admin/
Disallow: /api/
`.trim();

export const GET: APIRoute = () => {
	return new Response(robotsTxt, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
};
