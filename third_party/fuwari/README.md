# Fuwari (third-party)

Upstream: https://github.com/saicaca/fuwari — MIT License, Copyright (c) 2024 saicaca. Full license text: [`LICENSE`](./LICENSE).

## Vendored snapshot

- Commit: `6d39b0dec41282e7852e23e032998a5789abee28` (2025-12-11, "chore(deps): bump the patch-updates group across 1 directory with 13 updates (#681)")
- Method: files copied into this repository (not a submodule) and adapted for Astro 7 SSR on Cloudflare Workers. Upstream files carry no per-file copyright headers; attribution is this README plus the root `NOTICE`.

## Files taken from upstream

Copied verbatim, then adapted where noted:

| Destination | Notes |
|-------------|-------|
| `src/components/**`, `src/layouts/**` | `PostCard`, `PostPage`, `ImageWrapper`, `Navbar`, `Footer`, `ArchivePanel`, `Layout` adapted (see below) |
| `src/styles/**` | plus new `tailwind.css` that combines the sheets into one PostCSS root |
| `src/i18n/**`, `src/constants/**`, `src/types/config.ts`, `src/utils/{date,setting,url}-utils.ts`, `src/config.ts`, `src/env.d.ts`, `src/global.d.ts`, `src/assets/**` | unchanged |
| `src/utils/content-utils.ts` | rewritten: same exports, backed by `src/lib/posts.ts` instead of Content Collections |
| `src/pages/{[...page],about,archive,rss.xml,robots.txt}.astro/ts`, `src/pages/posts/[...slug].astro` | rewritten for on-demand rendering without `getStaticPaths` / `astro:content` |
| `public/favicon/**` | unchanged |
| `biome.json`, `tailwind.config.cjs` | unchanged |
| `postcss.config.mjs`, `svelte.config.js` | inlined into `astro.config.mjs`, files removed |

Not taken: `src/content/**` (Content Collections), Fuwari admonition / GitHub-card / Expressive Code helpers (write-time renderer uses a smaller unified chain; see `src/plugins/README.md`), `astro.config.mjs` (rewritten), Pagefind wiring, `@astrojs/tailwind`, `@astrojs/sitemap`.

Taken and adapted in phase 4: excerpt / reading-time remark plugins → `src/plugins/remark-excerpt.ts` and `src/plugins/remark-reading-time.ts` (they write `vfile.data` instead of Astro frontmatter).

## Notable adaptations

- Posts are `PostEntry` objects (`src/types/post.ts`) with pre-rendered `bodyHtml`, excerpt and reading stats; components no longer call `entry.render()`.
- `ImageWrapper` glob narrowed to `src/assets/**`; the theme stylesheets are imported explicitly from `Layout.astro` (upstream loaded them implicitly through the `../../**` glob).
- `trailingSlash` is `"ignore"` so `/api/*` handled in `src/fetch.ts` is reachable in dev.
- Commented-out markup with HTML-entity-escaped `--` in `Footer.astro` removed (broke the Lightning CSS minifier via Tailwind class scanning).
