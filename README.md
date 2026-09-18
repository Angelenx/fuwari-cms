# Fuwari CMS

> **状态：开发中 · 阶段 0–2 完成**（脚手架 + Fuwari 主题 SSR + D1 读通路；后台登录仍未做）  
> Fuwari 风前台 + Cloudflare D1 正文库 + 独立写稿后台。

想做一个**看起来像 [Fuwari](https://github.com/saicaca/fuwari)**、但**文章存在数据库、能后台编辑**的个人博客——跑在 Cloudflare 上，而不是每次改 Markdown 再重新构建部署。

进度与每阶段验收见 [PLAN.md](./PLAN.md)；重大变更记录见 [MONUMENTS.md](./MONUMENTS.md)。

## 本地开发

需要 Node ≥ 22.12；pnpm 由 Node 自带的 Corepack 按 `package.json` 的 `packageManager` 自动提供（无需全局安装：`corepack enable --install-directory <用户目录>` 后加入 PATH）。

```sh
pnpm install
cp .dev.vars.example .dev.vars   # 本地密钥，勿提交
pnpm db:migrate:local            # 应用 migrations/ 到本地 D1
pnpm db:seed:local               # 写入演示文章（仅本地；不要 --remote）
pnpm dev                         # wrangler types + astro dev（workerd），http://localhost:4321
pnpm build                       # astro check + astro build → dist/
pnpm preview                     # 用 wrangler 跑 dist/ 里的生产包
pnpm lint / pnpm format          # Biome
pnpm test                        # wrangler types + Vitest（@cloudflare/vitest-plugin，跑在 workerd 内）
```

---

## 一句话

**同一 Worker：公开站长得像 Fuwari；管理员登录 `/admin` 用 Markdown 写文章；正文进 D1；发布后 SSR 直接读库。**

可选后续：R2 存图、Workers AI 做标题/摘要建议。

---

## 为什么要做

| 需求 | 常见缺口 |
|------|----------|
| 好看（偏 Fuwari） | 不少 Cloudflare CMS 功能强，默认观感不对味 |
| 后台 + 真数据库 | Fuwari 本身是纯静态，无 D1、无管理端 |
| 托管在 Cloudflare | 需要 Workers + D1（以及可选 R2 / Workers AI） |

不是「给乔木换皮」，也不是「继续用 Git 当数据库」。

---

## 技术栈

| 层 | 选型 |
|----|------|
| 前台 | Astro 7 SSR + Tailwind 3（复用 Fuwari `6d39b0d` 主题，MIT） |
| 运行时 | Cloudflare Workers（`@astrojs/cloudflare` 14，`src/fetch.ts` 高级路由） |
| API | Hono（`/api/*`，与 Astro 管线同一 Worker） |
| 数据库 | D1 |
| 媒体 | R2（二期） |
| 后台 | 同站 `/admin` |
| 鉴权 | 单管理员密码 + Session Cookie |
| AI | 先留接口，后接 Workers AI |

---

## 分期预告

**一期（MVP）**  
登录、文章 CRUD、公开列表/详情/标签/归档对齐 Fuwari 观感、草稿不公开。

**二期**  
R2 上传、Workers AI（标题/摘要等）、搜索。

**三期**  
更舒服的编辑器、统计与其它扩展（按需）。

详细边界、表结构思路、API 纲要与风险坑，见：

→ [docs/初版开发思路.md](./docs/初版开发思路.md)

---

## 仓库结构

```
.
├── src/
│   ├── fetch.ts              # Worker 入口：Hono(/api) → astro/hono 管线
│   ├── api/app.ts            # Hono 路由（可脱离 Astro 单测）
│   ├── lib/posts.ts          # 文章数据源（D1，公开查询仅 published）
│   ├── types/post.ts         # PostEntry：预渲染 bodyHtml + 摘要/字数/目录
│   ├── pages/ components/ layouts/ styles/ i18n/ utils/ constants/ assets/ config.ts
│   │                         # Fuwari 主题（改编说明见 third_party/fuwari/README.md）
├── tests/                    # Vitest（workerd）
├── migrations/               # D1 迁移 SQL
├── scripts/seed.sql          # 本地演示文章（不要应用到远端）
├── astro.config.mjs  wrangler.jsonc  vitest.config.ts  biome.json  tsconfig.json
├── PLAN.md  MONUMENTS.md  AGENTS.md
├── docs/初版开发思路.md
├── LICENSE  NOTICE
└── third_party/fuwari/       # 上游 MIT 原文 + 拷贝清单
```

---

## 许可与归属

本项目自有内容采用 **[MIT License](./LICENSE)**  
Copyright (c) 2026 Angelen Atano

前台主题基于 **[Fuwari](https://github.com/saicaca/fuwari)**（MIT © 2024 saicaca）提交 `6d39b0d`。上游许可原文见 [`third_party/fuwari/LICENSE`](./third_party/fuwari/LICENSE)，拷贝与改编清单见 [`third_party/fuwari/README.md`](./third_party/fuwari/README.md)；完整第三方说明见 [`NOTICE`](./NOTICE)。

选用 MIT 的原因：与 Fuwari 及计划中的 Astro / Hono 等依赖许可兼容，便于复用主题并保持后续自有代码同样宽松可分发；本仓库**不**基于 GPL 等强 copyleft 成品派生。

---

## 欢迎

如果你也想要「好看的个人博客 + Cloudflare 真 CMS」，欢迎 Watch / Star，或开 Issue 聊需求与取舍。  
实现进度会直接推到本仓库。
