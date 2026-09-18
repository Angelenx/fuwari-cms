import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import "../src/i18n/locale-als";

// Schema only. Each test inserts its own rows; do not load scripts/seed.sql here.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
