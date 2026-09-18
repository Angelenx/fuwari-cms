import cloudflare from "@astrojs/cloudflare";
import svelte, { vitePreprocess } from "@astrojs/svelte";
import swup from "@swup/astro";
import icon from "astro-icon";
import { defineConfig } from "astro/config";
import postcssImport from "postcss-import";
import tailwindcss from "tailwindcss";
import postcssNesting from "tailwindcss/nesting/index.js";

// Theme integration set is ported from Fuwari (third_party/fuwari); Tailwind 3 is wired through
// vite.css.postcss instead of the deprecated @astrojs/tailwind. Markdown is rendered at write time
// inside the Worker (see PLAN.md), so no remark/rehype/expressive-code config lives here.
// https://astro.build/config
export default defineConfig({
	site: "https://example.com",
	base: "/",
	// Fuwari used "always", but Astro enforces it ahead of `src/fetch.ts` in dev, which 404s slash-less
	// `/api/*` calls. Theme links still emit trailing slashes; both forms resolve.
	trailingSlash: "ignore",
	output: "server",
	adapter: cloudflare({
		// Local assets (banner/avatar) are optimized at build time; on-demand pages pass images through,
		// so no Cloudflare Images binding is required.
		imageService: "compile",
	}),
	// Auth sessions live in D1 (see PLAN.md); disabling Astro sessions keeps the adapter from provisioning KV.
	session: false,
	vite: {
		// Inline replaces postcss.config.mjs; Vite skips config-file discovery when this is set.
		// postcss-import must run first so Tailwind sees the sheets as one root (@apply across files).
		css: {
			postcss: {
				plugins: [postcssImport(), postcssNesting(), tailwindcss()],
			},
		},
	},
	integrations: [
		swup({
			theme: false,
			animationClass: "transition-swup-", // see https://swup.js.org/options/#animationselector
			// the default value `transition-` cause transition delay
			// when the Tailwind class `transition-all` is used
			containers: ["main", "#toc"],
			// Admin uses fetch + location.assign; a Swup visit would drop the session cookie dance.
			ignore: (url) => {
				const path = url.startsWith("http")
					? new URL(url).pathname
					: url.split("?")[0];
				return path === "/admin" || path.startsWith("/admin/");
			},
			smoothScrolling: true,
			cache: true,
			preload: true,
			accessibility: true,
			updateHead: true,
			updateBodyClass: false,
			globalInstance: true,
		}),
		icon({
			include: {
				"material-symbols": ["*"],
				"fa6-brands": ["*"],
				"fa6-regular": ["*"],
				"fa6-solid": ["*"],
			},
		}),
		// Replaces svelte.config.js; vitePreprocess is required for <style lang="stylus"> in theme components.
		svelte({ preprocess: [vitePreprocess({ script: true })] }),
	],
});
