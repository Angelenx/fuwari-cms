# 多阶段开发计划

> 依据：[docs/初版开发思路.md](./docs/初版开发思路.md) 第 8–12 节。  
> 原则：每个阶段可独立验收；未通过验收不进入下一阶段。  
> 状态标记：`[ ]` 未开始 · `[~]` 进行中 · `[x]` 完成。阶段完成时在 `MONUMENTS.md` 记一条。

**文档优先：** 每个阶段开工前先读该阶段「参考文档」。官方文档与本计划冲突时，以官方文档为准，并回改本计划。

---

## 参考文档索引

### 上游主题

| 文档 | 用途 |
|------|------|
| [saicaca/fuwari](https://github.com/saicaca/fuwari) | 主题源仓库（MIT） |
| [Fuwari 中文 README](https://github.com/saicaca/fuwari/blob/main/docs/README.zh-CN.md) | 命令、frontmatter、Markdown 扩展语法 |
| [PR #763](https://github.com/saicaca/fuwari/pull/763) | 社区将 Fuwari 升到 Astro 7 的移植参考（未合并，有 demo） |
| [`astro.config.mjs`（main）](https://github.com/saicaca/fuwari/blob/main/astro.config.mjs) | 上游 Markdown remark/rehype 插件链原文 |

固定拷贝提交：`6d39b0d`（2025-12-11；Astro 5.13.10 / Tailwind 3 / Biome 2 / pnpm 9）。

### Astro

| 文档 | 用途 |
|------|------|
| [Install Astro](https://docs.astro.build/en/install-and-setup/) | Node ≥ 22.12；`create astro` / 手动安装 |
| [Upgrade to v7](https://docs.astro.build/en/guides/upgrade-to/v7/) | Sätteri 默认 Markdown、Rust 编译器、`src/fetch.ts` 保留名、`compressHTML: 'jsx'` |
| [Routing · Advanced routing](https://docs.astro.build/en/guides/routing/) | `src/fetch.ts` 管线；Hono 组合示例 |
| [`astro/hono` API](https://docs.astro.build/en/reference/modules/astro-hono/) | `actions()` / `middleware()` / `pages()` / `i18n()` |
| [Middleware](https://docs.astro.build/en/guides/middleware/) | `src/middleware.ts` |
| [On-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/) | `output: 'server'` |
| [`@astrojs/cloudflare`](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) | adapter 13/14 升级：workerd dev、`cloudflare:workers` env、wrangler `main`、postcss 预编译 |
| [Styling · Tailwind](https://docs.astro.build/en/guides/styling/#tailwind) | Astro 7 下接 Tailwind（`@astrojs/tailwind` 已废弃） |

### Cloudflare

| 文档 | 用途 |
|------|------|
| [Workers · Astro 框架指南](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/) | 部署与 wrangler 自动配置 |
| [Wrangler 配置](https://developers.cloudflare.com/workers/wrangler/configuration/) | `secrets.required`、bindings |
| [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/) | `.dev.vars*` 本地密钥；勿提交 |
| [D1 入门](https://developers.cloudflare.com/d1/get-started/) | 创建库、绑定 `DB` |
| [D1 Migrations](https://developers.cloudflare.com/d1/reference/migrations/) | `migrations/*.sql` |
| [D1 本地开发](https://developers.cloudflare.com/d1/best-practices/local-development/) | `--local` SQLite |
| [`wrangler d1` 命令](https://developers.cloudflare.com/workers/wrangler/commands/d1/) | `migrations create/apply`、`execute` |
| [Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) | PBKDF2-SHA256 |
| [Vitest 集成 · 第一个测试](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/) | workerd 内测 D1 |
| [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/) | 二期上传 |
| [Workers AI 入门](https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/) | 二期标题/摘要 |

### Hono

| 文档 | 用途 |
|------|------|
| [Cloudflare Workers 指南](https://hono.dev/docs/getting-started/cloudflare-workers) | `c.env`、`.dev.vars`、`wrangler types --env-interface CloudflareBindings` |
| [Cookie helper](https://hono.dev/docs/helpers/cookie) | Session Cookie |
| [Middleware 指南](https://hono.dev/docs/guides/middleware) | `/api/admin/*` 鉴权 |

### 工具链

| 文档 | 用途 |
|------|------|
| [Biome 入门](https://biomejs.dev/guides/getting-started/) | lint / format（复用 Fuwari `biome.json`） |
| [Expressive Code · rehype](https://expressive-code.com/installation/) | 运行时代码高亮 |
| [Tailwind 升级指南](https://tailwindcss.com/docs/upgrade-guide) | 阶段 1 对照 PR #763 决定是否升 4 |

---

## 已拍板的决策（不再摇摆）

| 项 | 决定 |
|----|------|
| 架构 | 单仓库、单 Cloudflare Worker：Astro 7 SSR + `@astrojs/cloudflare` 14。Hono 挂在 `src/fetch.ts`，用 `astro/hono` 的 `actions()` / `middleware()` / `pages()` / `i18n()` 串起 Astro 管线；自有 API 走 `/api/*` |
| 基线版本 | Astro ^7.2、`@astrojs/cloudflare` ^14、Node ≥ 22.12、pnpm 9（沿用 Fuwari `packageManager`） |
| 主题来源 | 从 Fuwari 固定提交 `6d39b0d` **拷贝**进本仓库（非 submodule，因为要深改）。实际拷贝后把 SHA 写入 `third_party/fuwari/README.md` |
| 运行时 Markdown | 写入时用 `unified` + Fuwari 的 remark/rehype 插件链 + `rehype-expressive-code` 渲染并缓存 `body_html`（默认在 Worker 内；`/admin/site` 可改为浏览器渲染后存库）；**不走** Astro 的 `.md` 管线（v7 默认 Sätteri） |
| 数据 | D1；Markdown 存 `body_md` |
| 鉴权 | 单管理员密码（PBKDF2-SHA256）+ HttpOnly Session Cookie |
| 后台 | 同站 `/admin/*`，Markdown textarea + 简易预览 |
| 图片 | 一期外链 URL；二期 R2 |
| AI | 一期只留 `501` stub；二期接 Workers AI |
| 许可 | 自有代码 MIT；Fuwari 文件保留上游版权声明 |

---

## 阶段 0 · 脚手架与工具链

**目标**：仓库能 `pnpm dev` 跑出一个空白 SSR 页，本地 D1 可用。

**参考文档：** [Install Astro](https://docs.astro.build/en/install-and-setup/)、[`@astrojs/cloudflare`](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)、[Advanced routing](https://docs.astro.build/en/guides/routing/)、[`astro/hono`](https://docs.astro.build/en/reference/modules/astro-hono/)、[Wrangler 配置](https://developers.cloudflare.com/workers/wrangler/configuration/)、[Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[D1 Migrations](https://developers.cloudflare.com/d1/reference/migrations/)、[Vitest 第一个测试](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/)、[Biome 入门](https://biomejs.dev/guides/getting-started/)、[Hono on Workers](https://hono.dev/docs/getting-started/cloudflare-workers)

- [x] 拉取 Fuwari 作为拷贝源（不进本仓库）：
  ```sh
  git clone https://github.com/saicaca/fuwari.git /tmp/fuwari-src
  git -C /tmp/fuwari-src checkout 6d39b0d
  ```
- [x] 在本仓库初始化 Astro 7（手动 `pnpm add astro`，落地 Astro 7.3 / adapter 14.3），`output: 'server'`，接入 `@astrojs/cloudflare` ^14；`imageService: 'compile'`、`session: false`
- [x] 复用 Fuwari 的 `biome.json` 作为 lint/format（不再另选 ESLint）
- [x] `wrangler.jsonc` 按适配器文档：
  - `main`: `"@astrojs/cloudflare/entrypoints/server"`
  - `compatibility_flags`: `["nodejs_compat"]`
  - `d1_databases` 绑定 `DB`
  - `secrets.required`: `["SESSION_SECRET"]`
  - `assets.directory`: `"./dist"`
- [x] `src/fetch.ts`：Hono 应用；`GET /api/health` → `{ ok: true }`；其后挂 `astro/hono` 的 `actions()` / `middleware()` / `pages()` / `i18n()`。Hono 路由本体放在 `src/api/app.ts`，便于不起 Astro 直接单测
- [x] `package.json` scripts 前置 `wrangler types`（适配器文档示例：`wrangler types && astro dev` / `build`）
- [x] 测试底座：官方包已更名为 **`@cloudflare/vitest-plugin`**（`cloudflareTest()` Vite 插件，要求 Vitest ≥ 4.1；`@cloudflare/vitest-pool-workers` 0.22 不再导出 `/config`）。`vitest.config.ts` 直接给 `miniflare` 选项而非 `wrangler.configPath`，因为 wrangler `main` 指向适配器入口，不是测试目标。health 冒烟测试在 `tests/api/health.test.ts`
- [x] 建 `migrations/` 与 `pnpm db:migrate:local`（`wrangler d1 migrations apply <db> --local`）
- [x] `.gitignore` 加入 `.dev.vars*`、`.env*`、`.wrangler/`、`worker-configuration.d.ts`；`.dev.vars` 本地写 `SESSION_SECRET`，`.dev.vars.example` 入库
- [x] 把真实命令写入 `README.md` 与 `AGENTS.md` 的 Build/Test 段

**工具链备注**：全局 `npm i -g pnpm` 在本机无写权限；改用 Node 自带 Corepack：`corepack enable --install-directory %LOCALAPPDATA%\corepack-bin` 并加入用户 PATH，`package.json` 的 `packageManager` 固定 pnpm 9.14.4。`typescript` 钉在 5.9（`@astrojs/check` 尚不支持 7）。

**验收**：`pnpm dev` 可访问首页与 `/api/health`；`pnpm build` 通过；`pnpm lint` 零错误；health 测试通过。 ✅ 2026-09-17

---

## 阶段 1 · Fuwari 主题迁入（SSR 可运行）

**目标**：前台壳「看起来就是 Fuwari」，数据先用硬编码假文章。

**参考文档：** [Fuwari 仓库](https://github.com/saicaca/fuwari)、[中文 README](https://github.com/saicaca/fuwari/blob/main/docs/README.zh-CN.md)、[PR #763](https://github.com/saicaca/fuwari/pull/763)、[Upgrade to v7](https://docs.astro.build/en/guides/upgrade-to/v7/)、[`@astrojs/cloudflare` · 预编译依赖](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)、[Styling · Tailwind](https://docs.astro.build/en/guides/styling/#tailwind)、[Tailwind 升级指南](https://tailwindcss.com/docs/upgrade-guide)

- [x] 从 `/tmp/fuwari-src`（`6d39b0d`）拷贝：`src/{components,layouts,styles,i18n,utils,constants,types,assets,pages}`、`src/config.ts`、`public/`、`tailwind.config.cjs`、`postcss.config.mjs`、`svelte.config.js`、`biome.json`。`astro.config.mjs` 已按 Astro 7 + Cloudflare adapter 重写。**`src/plugins/` 推迟到阶段 4**（它们只服务 Markdown 渲染链，阶段 1 无消费者）
- [x] SHA 与文件清单写入 `third_party/fuwari/README.md`；上游文件无逐文件版权头，以该 README + `NOTICE` 归属；`NOTICE` 已更新（含图标集 / 字体许可）
- [x] Tailwind 保持 3.4，经 `astro.config.mjs` 的 `vite.css.postcss`（postcss-import → tailwindcss/nesting → tailwindcss）接入，不用 `@astrojs/tailwind`。**发现：** 上游 `src/styles/*` 从未被显式 import，全靠 `ImageWrapper` 的 `import.meta.glob("../../**")` 副作用带入；本仓库把 glob 收窄到 `src/assets/**`，在 `Layout.astro` 显式导入，并新增 `src/styles/tailwind.css` 用 `@import` 把 CSS 合成一个 PostCSS root（Tailwind 3 的 `@apply link` 只能引用同 root 内的 `@layer components` 类）。代码高亮在写入时走 `rehype-expressive-code`（见阶段 4），`prerenderEnvironment` 保持默认 workerd
- [x] Rust 编译器无报错；`Footer.astro` 中注释里被实体转义的 `&#45;&#45;` 会被 Tailwind 扫成类名并让 Lightning CSS 压缩失败，已删除该死代码（连带删掉不存在的 sitemap 链接）
- [x] 删除所有 `getCollection` / `astro:content`：新增 `src/types/post.ts`（`PostEntry`：`data` + `bodyHtml` + `excerpt` / `words` / `minutes` / `headings`）与 `src/lib/posts.ts`（阶段 1 为硬编码假数据，公开函数永不返回草稿）；`content-utils.ts` 保持原导出名并新增 `paginatePosts()` 替代只在 `getStaticPaths` 可用的 `paginate()`；`[...page]` / `posts/[...slug]` / `about` / `rss.xml` 改为按需渲染，未知 slug / 页码返回 404
- [x] 移除 Pagefind 加载脚本（搜索留待 `/api`）；`trailingSlash` 由 `always` 改为 `ignore`（Astro dev 会在 `src/fetch.ts` 之前强制尾斜杠，导致 `/api/health` 404）。`/admin` 关闭 Swup 留到阶段 4 一并做

**验收**：首页、`/posts/:slug`、`/archive/`（含 `?tag=` / `?category=`）、`/about/`、`/rss.xml`、`/robots.txt` 用假数据渲染正常；草稿 slug 与越界页码 404；`astro preview`（workerd 跑生产包）同样通过。 ✅ 2026-09-17

---

## 阶段 2 · 数据层（D1 读通路）

**目标**：手写 SQL 插一篇文章，前台刷新即可见；草稿绝不外泄。本阶段不实现登录、后台 CRUD、写入时 Markdown 渲染。

**参考文档：** [D1 入门](https://developers.cloudflare.com/d1/get-started/)、[D1 Migrations](https://developers.cloudflare.com/d1/reference/migrations/)、[D1 本地开发](https://developers.cloudflare.com/d1/best-practices/local-development/)、[`wrangler d1`](https://developers.cloudflare.com/workers/wrangler/commands/d1/)、[`@astrojs/cloudflare` · env](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)、[Vitest 配置 · `readD1Migrations`](https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/)、[Vitest 测试 API · `applyD1Migrations`](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/)

- [x] `migrations/0001_init.sql`：`users` / `sessions` / `posts` / `tags` / `post_tags`。`posts` 补上 `PostEntry` 需要而设计文档未写的列（`excerpt`、`lang`、`headings_json`）；`status='published'` 时 `published_at` 非空；slug 靠 UNIQUE 索引，不另建。`pnpm db:migrate:local`
- [x] 索引：`posts(status, published_at DESC)`、`sessions(expires_at)`
- [x] `users` / `sessions` 建表但保持空。**管理员种子推迟到阶段 3**（需要 PBKDF2）；本阶段不写 `password.ts`
- [x] 演示文章在 `scripts/seed.sql`（阶段 1 的 3 篇 published + 1 篇 draft），**不进**会应用到远端的 migration。`pnpm db:seed:local`（`wrangler d1 execute --local --yes --file`）
- [x] `src/lib/posts.ts` 假数据换成 D1；`import { env } from "cloudflare:workers"`；公开查询一律 `status = 'published'`。主页 `countPublishedPosts` + `listPublishedCards`（`LIMIT/OFFSET`，不选 `body_html`）；归档 `GET /api/posts` keyset；RSS `listPublishedPostsForRss` 仍带全文。`getPublishedPost` 单行 + prev/next（next=更新、prev=更旧）。`getSpecPageHtml("about")` 读 `site_settings.about_html`，空则回退默认 HTML
- [x] `posts/[...slug]` 改调 `getPublishedPost`；其余前台页仍走 `content-utils` → `@lib/posts`
- [x] `vitest.config.ts` 继续不读 wrangler `main`；`miniflare` 加 `d1Databases: ["DB"]`，`readD1Migrations` 从 `@cloudflare/vitest-plugin` 根导出（官方类型注释里的 `/config` 子路径在 1.1 已不存在）。`tests/apply-migrations.ts` 调 `applyD1Migrations`
- [x] `tests/lib/posts.test.ts`：插入 `draft` + `published`（带 tag），公开列表只含后者，草稿 slug 为 `undefined`。`pnpm test` 前置 `wrangler types`

**验收**：`pnpm db:migrate:local && pnpm db:seed:local` 后前台可见 3 篇 published，`/posts/draft-post/` 404；再 `wrangler d1 execute --local` 插入一篇后刷新可见；draft 测试通过。 ✅ 2026-09-18

---

## 阶段 3 · 鉴权与 Session

**目标**：能登录、能登出、未登录访问 `/admin` 与 `/api/admin/*` 被拒。本阶段不写文章 CRUD。

**参考文档：** [Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)（PBKDF2 / `deriveBits` / `timingSafeEqual`）、[Hono Cookie](https://hono.dev/docs/helpers/cookie)（`setSignedCookie`）、[Hono Middleware](https://hono.dev/docs/guides/middleware)、[Advanced routing 示例](https://github.com/withastro/astro/blob/main/examples/advanced-routing/src/fetch.ts)、[Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

- [x] `src/lib/auth/password.ts`：Web Crypto PBKDF2-SHA256，`deriveBits(256)`，盐 16 字节，迭代 **100000**（`ponytail:` Workers SubtleCrypto 天花板，只改这一处）。存储 `pbkdf2$sha256$100000$<b64url-salt>$<b64url-dk>`。比对用 `crypto.subtle.timingSafeEqual`。用户不存在时 `verifyPassword(password, undefined)` 仍跑一次假 hash，避免按耗时枚举用户名
- [x] `src/lib/auth/session.ts`：32 字节 hex 作 `sessions.id`，TTL 7 天（SQL `datetime('now', '+7 days')`）。Cookie 名 `sid`，`hono/cookie` 的 HMAC 签名（`SESSION_SECRET`）；`HttpOnly; SameSite=Lax; Path=/`；**仅 HTTPS 时 Secure**（本地 HTTP 否则丢 Cookie）。`SESSION_SECRET` 不当密码胡椒。绑定走 `import { env } from "cloudflare:workers"`（Astro 调 `Hono.fetch(request)` 时 `c.env` 为空；与 `posts.ts` 相同）
- [x] Hono（`src/api/auth.ts`，`Bindings: Cloudflare.Env`）：`POST /api/auth/login`、`POST /api/auth/logout`（无 Cookie 也 204）、`GET /api/auth/me`。错密码统一 `"Invalid credentials"` 且不 Set-Cookie
- [x] `src/api/admin.ts`：`use("*", requireAuth)` → 401 JSON。本阶段 `GET /api/admin/ping` 作可测靶子；未登录访问任意 `/api/admin/*` 都是 401，不先 404
- [x] `src/fetch.ts` 在 `pages()` 之前守卫 `/admin`（对齐官方 advanced-routing 示例）：无有效 D1 session → `302 /admin/login`；已登录访问登录页 → `302 /admin`。校验走 D1，不只看 Cookie 是否存在
- [x] 素页面：`/admin/login`（`fetch` + `location.assign`，避开 Swup）、`/admin` stub（当前用户 + 登出；阶段 4 换成文章列表）
- [x] 登录限速：按 `CF-Connecting-IP` 的内存 Map，15 分钟 5 次失败 → 429（`ponytail:` isolate 不共享，升级 D1/KV）
- [x] 登录成功时 `DELETE FROM sessions WHERE expires_at < datetime('now')`（与 INSERT 同 `batch`）
- [x] ~~`scripts/seed-admin.sql` + `pnpm db:seed:admin`~~ **阶段 4 已删除**：空 `users` 表时首次访问 `/admin/login` 设密，用户名固定 `admin`
- [x] `tests/lib/password.test.ts`、`tests/api/auth.test.ts`：错密码无 Cookie、登录/me/logout、未登录 `/api/admin/*` 401、第 6 次失败 429

**验收**：错误密码 401；正确密码得 Cookie；带 Cookie 访问 `/api/auth/me` 返回用户；登出后再访问 401；无 Cookie 访问 `/admin` 到登录页、`/api/admin/*` 401。 ✅ 2026-09-18

---

## 阶段 4 · 后台 CRUD

**目标**：管理员在 `/admin` 完成创建 / 编辑 / 发布 / 撤回 / 删除。

**参考文档：** [Fuwari `astro.config.mjs` 插件链](https://github.com/saicaca/fuwari/blob/main/astro.config.mjs)、[Expressive Code rehype](https://expressive-code.com/installation/)、[`@astrojs/cloudflare` · 预编译](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)、[Upgrade to v7 · unified Markdown](https://docs.astro.build/en/guides/upgrade-to/v7/)

- [x] 首次设密：`POST /api/auth/setup`（密码 ≥ 8，用户名固定 `admin`）；`users` 已有行则 409。删除 `scripts/seed-admin.sql` / `db:seed:admin`。登录页按 `needsSetup()` 分支
- [x] `GET/POST /api/admin/posts`，`GET/PUT/DELETE /api/admin/posts/:id`，`POST /api/admin/preview`；草稿只走 `src/lib/admin-posts.ts`，公开查询仍只用 `src/lib/posts.ts`
- [x] 写入时：校验 slug 唯一与 kebab 格式；`src/lib/markdown.ts` 用 `unified` + `remark-gfm` / `remark-math` + 改编自 Fuwari 的 excerpt / reading-time 插件 + `rehype-katex` / `rehype-slug` / `rehype-expressive-code`（Shiki `engine: "javascript"`，workerd 无 WASM）渲染 `body_html`，并算 `word_count` / `reading_minutes` / `headings_json`
- [x] 已有贴文：鉴权 `POST /api/admin/posts/rerender` + 后台 **Re-render posts**；只重写 HTML / excerpt / 字数 / 目录，不改 `published_at`、状态、slug、标签、`updated_at`。Fuwari admonition / GitHub card 已拷入 `src/plugins/` 但未接线
- [x] `/admin` 文章列表 + 快捷发布/撤回/删除；`/admin/posts/new`、`/admin/posts/:id`。Swup `ignore` `/admin`
- [x] 编辑页：标题 / slug / 摘要 / 标签 / 封面 URL / 状态 / Markdown 大文本框 / 预览
- [x] `POST /api/admin/ai/:name` 一律返回 `501`
- [x] Vitest：CRUD 全流程 + 未登录调用全部 401；markdown 渲染单测
- [x] `/admin/profile`：D1 `site_settings` 单行；头像 / 姓名 / 简介 / 三链 / banner 空字段回退 `src/config.ts` 当前前端值；社交图标 CSDN / Bilibili / GitHub（Simple Icons）
- [x] `/admin/site`、`/admin/about`：站点标题 / 副标题 / 页脚与 About Markdown；空字段回退 `src/config.ts`。`clientMarkdown` 开关：打开后后台预览/保存/Re-render 在浏览器渲染再存 HTML

**验收**：后台发布一篇文章，公开站刷新即见；撤回为草稿后公开站消失。 ✅ 2026-09-18

---

## 阶段 5 · MVP 收尾与部署

**目标**：线上可用，满足设计文档第 12 节全部成功标准。

**参考文档：** [Workers · Astro 框架指南](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/)、[`wrangler d1`](https://developers.cloudflare.com/workers/wrangler/commands/d1/)、[Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

- [ ] **由仓库所有者按 [README.md](./README.md)（英文默认）或 [README.zh-CN.md](./README.zh-CN.md) 执行：** 替换 `wrangler.jsonc` 的真实 `database_id`；`pnpm db:migrate:remote`；`wrangler secret put SESSION_SECRET`；`pnpm deploy`。代理/助手不代为跑这些远端命令。
- [x] README 从「预告」改为「一期可用」，含设计思路、技术架构、数据库、环境变量与两种部署路径，并保留 Fuwari（MIT）归属。GitHub 默认展示英文 [`README.md`](./README.md)，简体中文为 [`README.zh-CN.md`](./README.zh-CN.md)，文首可互相跳转
- [x] 逐条核对成功标准，写入 README「一期成功标准」（线上验收仍取决于上述远端步骤）
- [x] `MONUMENTS.md` 记录阶段 5 文档与部署说明就绪（不是「已代为上线」）

**一期不做**：真 AI、评论、FTS 全文索引、多作者、重型编辑器、边缘缓存。导航 `LIKE` 搜索已走 `GET /api/search`。

---

## 二期

**参考文档：** [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/)、[Workers AI 入门](https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/)、[`wrangler d1 execute`](https://developers.cloudflare.com/workers/wrangler/commands/d1/)、Fuwari 已有 [`@astrojs/rss`](https://docs.astro.build/en/guides/rss/)

- [ ] R2：`POST /api/admin/media` multipart 上传，MIME 白名单，`media` 表
- [ ] Workers AI：标题 / 摘要 / 标签建议，替换 `501` stub
- [ ] 搜索：D1 FTS5（`GET /api/search` 已用 LIKE；先用 `wrangler d1 execute` 验证虚拟表可用再替换）
- [ ] RSS / sitemap / OG 图（RSS 复用 Fuwari 的 `@astrojs/rss`）
- [ ] 可选：Cloudflare Access 替代自建密码
- [ ] 可选：发文后失效公开页缓存

## 三期（有余力再排）

- 更舒服的编辑器（CodeMirror / TipTap）
- 阅读统计
- 友链 / 说说等扩展内容类型

---

## 进度总览

| 阶段 | 状态 | 完成日期 |
|------|------|----------|
| 0 脚手架 | `[x]` | 2026-09-17 |
| 1 主题迁入 | `[x]` | 2026-09-17 |
| 2 数据层 | `[x]` | 2026-09-18 |
| 3 鉴权 | `[x]` | 2026-09-18 |
| 4 后台 CRUD | `[x]` | 2026-09-18 |
| 5 MVP 部署 | `[~]` 文档就绪，远端由所有者按 README 执行 | 2026-09-18 |
| 二期 | `[ ]` | — |
