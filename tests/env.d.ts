/// <reference types="@cloudflare/vitest-plugin/types" />

declare namespace Cloudflare {
	interface Env {
		/** Injected by vitest.config.ts so setup can apply migrations. */
		TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
	}
}
