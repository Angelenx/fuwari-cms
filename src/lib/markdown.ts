/**
 * Write-time Markdown renderer. Pages never call this; they read `body_html`.
 *
 * ponytail: Fuwari admonition / GitHub-card / Expressive Code plugins are not
 * wired here — they expect Astro's markdown pipeline (or shiki in workerd).
 * Fence blocks become `<pre><code>`. Upgrade: rehype-expressive-code after it
 * runs in workerd, then wire src/plugins/rehype-component-* via rehype-components.
 */
import type { MarkdownHeading } from "astro";
import { toString as hastToString } from "hast-util-to-string";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { type Plugin, unified } from "unified";
import { visit } from "unist-util-visit";
import { remarkExcerpt } from "../plugins/remark-excerpt";
import { remarkReadingTime } from "../plugins/remark-reading-time";

export type RenderedMarkdown = {
	bodyHtml: string;
	excerpt: string;
	wordCount: number;
	readingMinutes: number;
	headings: MarkdownHeading[];
};

function rehypeCollectHeadings() {
	return (
		tree: Parameters<typeof visit>[0],
		file: { data: Record<string, unknown> },
	) => {
		const headings: MarkdownHeading[] = [];
		visit(tree, "element", (raw) => {
			const node = raw as {
				tagName?: string;
				properties?: { id?: unknown };
			};
			const match = /^h([1-6])$/.exec(node.tagName ?? "");
			if (!match) {
				return;
			}
			headings.push({
				depth: Number(match[1]),
				slug: String(node.properties?.id ?? ""),
				text: hastToString(raw as Parameters<typeof hastToString>[0]),
			});
		});
		file.data.headings = headings;
	};
}

const processor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkMath)
	.use(remarkExcerpt as Plugin)
	.use(remarkReadingTime as Plugin)
	.use(remarkRehype)
	.use(rehypeKatex)
	.use(rehypeSlug)
	.use(rehypeCollectHeadings as Plugin)
	.use(rehypeStringify);

export async function renderMarkdown(
	markdown: string,
): Promise<RenderedMarkdown> {
	const file = await processor.process(markdown);
	const data = file.data as {
		excerpt?: string;
		words?: number;
		minutes?: number;
		headings?: MarkdownHeading[];
	};
	return {
		bodyHtml: String(file),
		excerpt: data.excerpt ?? "",
		wordCount: data.words ?? 0,
		readingMinutes: data.minutes ?? 1,
		headings: data.headings ?? [],
	};
}
