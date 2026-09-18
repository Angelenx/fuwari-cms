import { toString as mdastToString } from "mdast-util-to-string";

/** First paragraph as excerpt. Writes `file.data.excerpt` (no Astro frontmatter). */
export function remarkExcerpt() {
	return (
		tree: { children?: Array<{ type: string }> },
		file: { data: Record<string, unknown> },
	) => {
		let excerpt = "";
		for (const node of tree.children ?? []) {
			if (node.type !== "paragraph") {
				continue;
			}
			excerpt = mdastToString(node);
			break;
		}
		file.data.excerpt = excerpt;
	};
}
