/**
 * Write-time Markdown renderer. Public pages never call this; they read
 * `body_html`. Default path is the Worker; `/admin/site` can opt into the same
 * function in the browser so free-plan CPU does not 503 on save.
 *
 * ponytail: Fuwari admonition / GitHub-card plugins still need rehype-components.
 * Fence blocks go through rehype-expressive-code (Shiki JS engine for workerd).
 */
import type { MarkdownHeading } from "astro";
import { toString as hastToString } from "hast-util-to-string";
import rehypeExpressiveCode from "rehype-expressive-code";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { type Plugin, unified } from "unified";
import { visit } from "unist-util-visit";
import { expressiveCodeConfig } from "../config";
import { remarkExcerpt } from "../plugins/remark-excerpt";
import { remarkReadingTime } from "../plugins/remark-reading-time";

export type RenderedMarkdown = {
	bodyHtml: string;
	excerpt: string;
	wordCount: number;
	readingMinutes: number;
	headings: MarkdownHeading[];
};

/**
 * Client-rendered payload from an admin session. Incomplete objects return
 * undefined so the Worker still runs `renderMarkdown`.
 */
export function parseRenderedMarkdown(
	body: unknown,
): RenderedMarkdown | undefined {
	if (!body || typeof body !== "object") {
		return undefined;
	}
	const rec = body as Record<string, unknown>;
	if (typeof rec.bodyHtml !== "string" || typeof rec.excerpt !== "string") {
		return undefined;
	}
	if (
		typeof rec.wordCount !== "number" ||
		!Number.isFinite(rec.wordCount) ||
		typeof rec.readingMinutes !== "number" ||
		!Number.isFinite(rec.readingMinutes)
	) {
		return undefined;
	}
	if (!Array.isArray(rec.headings)) {
		return undefined;
	}
	const headings: MarkdownHeading[] = [];
	for (const item of rec.headings) {
		if (!item || typeof item !== "object") {
			return undefined;
		}
		const heading = item as Record<string, unknown>;
		if (
			typeof heading.depth !== "number" ||
			!Number.isFinite(heading.depth) ||
			typeof heading.slug !== "string" ||
			typeof heading.text !== "string"
		) {
			return undefined;
		}
		headings.push({
			depth: heading.depth,
			slug: heading.slug,
			text: heading.text,
		});
	}
	return {
		bodyHtml: rec.bodyHtml,
		excerpt: rec.excerpt,
		wordCount: rec.wordCount,
		readingMinutes: rec.readingMinutes,
		headings,
	};
}

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
	.use(
		// unified's Plugin types don't match EC's async hast transformer.
		rehypeExpressiveCode as unknown as Plugin<
			[{ themes: string[]; shiki: { engine: "javascript" } }]
		>,
		{
			themes: [expressiveCodeConfig.theme],
			// workerd cannot init Shiki's default embedded WASM.
			shiki: { engine: "javascript" },
		},
	)
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
