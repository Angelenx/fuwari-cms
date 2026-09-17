import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Tests run inside workerd so runtime behaviour (Web Crypto, D1 in later phases) matches production.
// Bindings are declared here instead of via wrangler.jsonc because its `main` points at the Astro
// adapter entrypoint, which is not a test target.
export default defineConfig({
	plugins: [
		cloudflareTest({
			miniflare: {
				compatibilityDate: "2026-08-12",
				compatibilityFlags: ["nodejs_compat"],
			},
		}),
	],
	test: {
		include: ["tests/**/*.test.ts"],
	},
});
