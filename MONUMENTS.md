# Monuments

Dated log of major repository changes. Newest first.

## 2026-09-18 — Public navbar search via D1

Navbar search calls `GET /api/search` with a published-only `LIKE` query. Pagefind is gone; drafts never appear. FTS5 stays a later upgrade.

## 2026-09-18 — Profile avatar and banner reset

`/admin/profile` Reset buttons restore the bundled internal paths from `src/config.ts` (`assets/images/demo-avatar.png` and `demo-banner.png`). Save still required.

## 2026-09-18 — Admin post list timeline and filters

`/admin` lists posts by `published_at` (year groups, drafts without a date at the bottom) and can filter by search, tag, and draft/published status. Public homepage cards and archive `?tag=` stay as they are.

## 2026-09-18 — Post language and custom published_at

The editor picks lang from Fuwari's codes instead of a free-text field. `published_at` is an optional datetime (public timeline order, not scheduled publish); SQLite timestamps are normalized so the picker can reload them. Local covers/avatars/banners use hashed `/_astro` URLs so `pnpm preview` does not hit `/_image`.

## 2026-09-18 — Admin can change password

`/admin/account` checks the current password and writes a new PBKDF2 hash. Username stays `admin`.

## 2026-09-18 — Deploy command is `pnpm run deploy`

README tells owners to run `pnpm run deploy` because pnpm 9 reserves `pnpm deploy` (`ERR_PNPM_CANNOT_DEPLOY`). Remote D1 create/migrate and `secret put` stay with the owner.

## 2026-09-18 — Phase 5 docs: deploy without running it

README now describes design, architecture, D1 schema, `SESSION_SECRET`, and two deploy paths (local Wrangler and GitHub Actions). Remote `deploy` / `secret put` / D1 migrate stay with the repo owner.

## 2026-09-18 — Public EN/zh-CN language switch

Navbar toggles UI copy between English and Simplified Chinese via a `locale` cookie. SSR reads the cookie so Home/Archive/About and widgets match after reload.

## 2026-09-18 — Admin tabs, toast, and async panels

`/admin` uses a tab strip and in-page panel swap (with a hue-tinted loader) instead of full reloads; save/error feedback is a two-second toast.

## 2026-09-18 — Admin site identity and about page

`/admin/site` edits the navbar title, subtitle, and footer line; `/admin/about` edits the about Markdown (write-time HTML). Blank D1 fields still overlay `src/config.ts`.

## 2026-09-18 — Admin profile and banner live in D1

`/admin/profile` edits avatar, name, bio, three link URLs, and the home banner. A singleton `site_settings` row overlays `src/config.ts`: blank or missing fields keep the current frontend defaults. Sidebar icons are CSDN / Bilibili / GitHub (Simple Icons, `currentColor`).

## 2026-09-18 — Phase 4: admin CRUD and write-time Markdown

`/admin` can create, edit, publish, withdraw, and delete posts. Markdown is rendered in the Worker at write time (`src/lib/markdown.ts`) into `body_html`; public queries still never see drafts. First visit to `/admin/login` sets the `admin` password (`POST /api/auth/setup`); `scripts/seed-admin.sql` is gone. Code fences stay `<pre><code>` until Expressive Code runs in workerd. KaTeX math is rendered at write time.

## 2026-09-18 — Phase 3: admin login with D1 sessions

Single-admin auth is live: PBKDF2-SHA256 hashes in `users`, opaque session rows in `sessions`, and an HMAC-signed `sid` cookie. Unauthenticated `/admin` redirects to `/admin/login`; `/api/admin/*` returns 401. The phase-3 SQL admin seed was removed in phase 4 in favor of first-run password setup.

## 2026-09-18 — Phase 2: public pages read posts from D1

`src/lib/posts.ts` queries D1 instead of mock arrays. Schema lives in `migrations/0001_init.sql`; local demo posts are `scripts/seed.sql` (not a remote migration). Public SELECTs always filter `status = 'published'`, so drafts never appear on the site. Admin user seed waits for phase 3 password hashing.

## 2026-09-17 — Tool configs stay at root; LF line endings

PostCSS and Svelte preprocess moved into `astro.config.mjs` so `postcss.config.mjs` / `svelte.config.js` could be deleted; other tool configs remain at the repo root. `.gitattributes` (`* text=auto eol=lf`) and `.editorconfig` make checkouts LF regardless of `core.autocrlf`, matching Biome.

## 2026-09-17 — Agents must not create git commits

`AGENTS.md` forbids agents from running `git commit`. Only the user records commits, always as **Angelenx** `<angelen@angelen-studio.com>`, with no `Co-authored-by` or other extra identity trailers.

## 2026-09-17 — Phases 0–1: runnable SSR scaffold with the Fuwari theme

Astro 7.3 + `@astrojs/cloudflare` 14 + Hono (`src/fetch.ts` → `src/api/app.ts`) now run in workerd via `pnpm dev`, with Biome and `@cloudflare/vitest-plugin` tests. Fuwari `6d39b0d` was copied and ported: Content Collections replaced by the `PostEntry` / `src/lib/posts.ts` seam (mock data, drafts never public), pages render on demand, theme CSS imported explicitly through a single PostCSS root. D1 bindings and `SESSION_SECRET` are declared but unused until phase 2.

## 2026-09-17 — Baseline: Astro 7 + Cloudflare adapter 14

Pinned MVP to Astro ^7.2 and `@astrojs/cloudflare` ^14 so development follows current official docs (workerd `astro dev`, `cloudflare:workers` env, `src/fetch.ts` + `astro/hono`) instead of Fuwari’s Astro 5 tree, avoiding a second major upgrade later. Theme source remains Fuwari commit `6d39b0d`, copied and ported.

## 2026-09-17 — Phased development plan

Added `PLAN.md`: six MVP phases (scaffold → theme → D1 → auth → admin CRUD → deploy) plus phase 2/3 backlog, each with acceptance criteria, derived from the v1 design document.

## 2026-09-17 — Contributor process in AGENTS.md

Agents must inspect a dirty working tree and draft a commit message before further code edits, wait for the user to commit, write necessary English comments in code, and record major changes here.
