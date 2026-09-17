import type { PostEntry } from "@/types/post";

/**
 * Post repository seam. Phase 1 serves hard-coded posts so the theme can be
 * verified; phase 2 swaps the internals for D1 without touching callers.
 *
 * Public-facing functions never return drafts.
 */

const MOCK_POSTS: PostEntry[] = [
	{
		slug: "hello-fuwari-cms",
		data: {
			title: "Hello, Fuwari CMS",
			published: new Date("2026-09-15"),
			updated: new Date("2026-09-16"),
			draft: false,
			description:
				"The Fuwari theme running as an SSR Worker with a mock data source.",
			image: "",
			tags: ["Astro", "Cloudflare"],
			category: "Meta",
			lang: "en",
		},
		bodyHtml:
			'<h2 id="why">Why</h2><p>This post is rendered from a pre-computed HTML string, exactly like posts stored in D1 will be.</p><h2 id="next">Next</h2><p>Phase 2 replaces <code>src/lib/posts.ts</code> internals with D1 queries.</p>',
		excerpt: "This post is rendered from a pre-computed HTML string.",
		words: 32,
		minutes: 1,
		headings: [
			{ depth: 2, slug: "why", text: "Why" },
			{ depth: 2, slug: "next", text: "Next" },
		],
	},
	{
		slug: "cover-image-demo",
		data: {
			title: "Post with an external cover image",
			published: new Date("2026-09-10"),
			draft: false,
			description: "",
			image: "https://picsum.photos/seed/fuwari-cms/1200/630",
			tags: ["Demo"],
			category: "Examples",
			lang: "en",
		},
		bodyHtml:
			"<p>Cover images are external URLs in phase 1; R2 uploads arrive in a later phase.</p><blockquote><p>The excerpt below is precomputed rather than derived from a remark plugin.</p></blockquote>",
		excerpt:
			"Cover images are external URLs in phase 1; R2 uploads arrive in a later phase.",
		words: 24,
		minutes: 1,
		headings: [],
	},
	{
		slug: "zh-cn-post",
		data: {
			title: "中文文章示例",
			published: new Date("2025-12-01"),
			draft: false,
			description: "验证中文排版、标签与分类过滤。",
			image: "",
			tags: ["示例", "Demo"],
			category: null,
			lang: "zh_CN",
		},
		bodyHtml: "<p>这是一篇没有分类的文章，用来验证归档页的「未分类」过滤。</p>",
		excerpt: "这是一篇没有分类的文章。",
		words: 25,
		minutes: 1,
		headings: [],
	},
	{
		slug: "draft-post",
		data: {
			title: "Draft that must never be public",
			published: new Date("2026-09-17"),
			draft: true,
			description: "",
			image: "",
			tags: ["Draft"],
			category: "Meta",
			lang: "en",
		},
		bodyHtml:
			"<p>If you can read this on the public site, draft filtering is broken.</p>",
		excerpt: "",
		words: 14,
		minutes: 1,
		headings: [],
	},
];

const ABOUT_HTML =
	"<p>This is the about page. It will be editable from <code>/admin</code> once the data layer lands.</p>";

/** Published posts, newest first. */
export async function listPublishedPosts(): Promise<PostEntry[]> {
	return MOCK_POSTS.filter((p) => !p.data.draft).sort(
		(a, b) => b.data.published.getTime() - a.data.published.getTime(),
	);
}

/** A single published post, or `undefined` for unknown slugs and drafts. */
export async function getPublishedPost(
	slug: string,
): Promise<PostEntry | undefined> {
	return (await listPublishedPosts()).find((p) => p.slug === slug);
}

/** Rendered HTML of a standalone page such as `about`. */
export async function getSpecPageHtml(name: "about"): Promise<string> {
	return name === "about" ? ABOUT_HTML : "";
}
