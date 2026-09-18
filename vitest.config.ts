import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Tests run inside workerd so runtime behaviour (Web Crypto, D1) matches production.
// Bindings are declared here instead of via wrangler.jsonc because its `main` points at the Astro
// adapter entrypoint, which is not a test target.
export default defineConfig({
	plugins: [
		cloudflareTest(async () => {
			const migrations = await readD1Migrations(
				path.join(import.meta.dirname, "migrations"),
			);
			return {
				miniflare: {
					compatibilityDate: "2026-08-12",
					compatibilityFlags: ["nodejs_compat"],
					d1Databases: ["DB"],
					// Test-only: setup file applies these to env.DB via applyD1Migrations.
					bindings: {
						TEST_MIGRATIONS: migrations,
						SESSION_SECRET: "test-session-secret-at-least-32-chars",
					},
				},
			};
		}),
	],
	test: {
		include: ["tests/**/*.test.ts"],
		setupFiles: ["./tests/apply-migrations.ts"],
	},
});
