-- Local demo posts copied from the phase-1 mock source. Not a D1 migration:
-- applying this remotely would pollute production. Re-run is idempotent (OR IGNORE).

INSERT OR IGNORE INTO tags (name) VALUES
	('Astro'),
	('Cloudflare'),
	('Demo'),
	('示例'),
	('Draft');

INSERT OR IGNORE INTO posts (
	slug,
	title,
	description,
	body_md,
	body_html,
	excerpt,
	cover_url,
	status,
	category,
	lang,
	published_at,
	updated_at,
	word_count,
	reading_minutes,
	headings_json
) VALUES
	(
		'hello-fuwari-cms',
		'Hello, Fuwari CMS',
		'The Fuwari theme running as an SSR Worker with a mock data source.',
		'## Why

This post is rendered from a pre-computed HTML string, exactly like posts stored in D1 will be.

## Next

Phase 2 replaces `src/lib/posts.ts` internals with D1 queries.',
		'<h2 id="why">Why</h2><p>This post is rendered from a pre-computed HTML string, exactly like posts stored in D1 will be.</p><h2 id="next">Next</h2><p>Phase 2 replaces <code>src/lib/posts.ts</code> internals with D1 queries.</p>',
		'This post is rendered from a pre-computed HTML string.',
		'',
		'published',
		'Meta',
		'en',
		'2026-09-15T00:00:00.000Z',
		'2026-09-16T00:00:00.000Z',
		32,
		1,
		'[{"depth":2,"slug":"why","text":"Why"},{"depth":2,"slug":"next","text":"Next"}]'
	),
	(
		'cover-image-demo',
		'Post with an external cover image',
		'',
		'Cover images are external URLs in phase 1; R2 uploads arrive in a later phase.

> The excerpt below is precomputed rather than derived from a remark plugin.',
		'<p>Cover images are external URLs in phase 1; R2 uploads arrive in a later phase.</p><blockquote><p>The excerpt below is precomputed rather than derived from a remark plugin.</p></blockquote>',
		'Cover images are external URLs in phase 1; R2 uploads arrive in a later phase.',
		'https://picsum.photos/seed/fuwari-cms/1200/630',
		'published',
		'Examples',
		'en',
		'2026-09-10T00:00:00.000Z',
		NULL,
		24,
		1,
		'[]'
	),
	(
		'zh-cn-post',
		'中文文章示例',
		'验证中文排版、标签与分类过滤。',
		'这是一篇没有分类的文章，用来验证归档页的「未分类」过滤。',
		'<p>这是一篇没有分类的文章，用来验证归档页的「未分类」过滤。</p>',
		'这是一篇没有分类的文章。',
		'',
		'published',
		NULL,
		'zh_CN',
		'2025-12-01T00:00:00.000Z',
		NULL,
		25,
		1,
		'[]'
	),
	(
		'draft-post',
		'Draft that must never be public',
		'',
		'If you can read this on the public site, draft filtering is broken.',
		'<p>If you can read this on the public site, draft filtering is broken.</p>',
		'',
		'',
		'draft',
		'Meta',
		'en',
		'2026-09-17T00:00:00.000Z',
		NULL,
		14,
		1,
		'[]'
	);

INSERT OR IGNORE INTO post_tags (post_id, tag_id)
SELECT p.id, t.id FROM posts p JOIN tags t ON t.name = 'Astro' WHERE p.slug = 'hello-fuwari-cms';

INSERT OR IGNORE INTO post_tags (post_id, tag_id)
SELECT p.id, t.id FROM posts p JOIN tags t ON t.name = 'Cloudflare' WHERE p.slug = 'hello-fuwari-cms';

INSERT OR IGNORE INTO post_tags (post_id, tag_id)
SELECT p.id, t.id FROM posts p JOIN tags t ON t.name = 'Demo' WHERE p.slug = 'cover-image-demo';

INSERT OR IGNORE INTO post_tags (post_id, tag_id)
SELECT p.id, t.id FROM posts p JOIN tags t ON t.name = '示例' WHERE p.slug = 'zh-cn-post';

INSERT OR IGNORE INTO post_tags (post_id, tag_id)
SELECT p.id, t.id FROM posts p JOIN tags t ON t.name = 'Demo' WHERE p.slug = 'zh-cn-post';

INSERT OR IGNORE INTO post_tags (post_id, tag_id)
SELECT p.id, t.id FROM posts p JOIN tags t ON t.name = 'Draft' WHERE p.slug = 'draft-post';
