import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../src/lib/markdown";

describe("write-time markdown", () => {
	it("renders gfm, excerpt, headings, and fenced code as pre", async () => {
		const result = await renderMarkdown(`# Hello

First paragraph.

## Sub Head

| a | b |
| - | - |
| 1 | 2 |

\`\`\`js
const n = 1;
\`\`\`
`);
		expect(result.excerpt).toBe("First paragraph.");
		expect(result.bodyHtml).toContain("<h1");
		expect(result.bodyHtml).toContain('id="hello"');
		expect(result.bodyHtml).toContain("<table>");
		expect(result.bodyHtml).toContain("<pre>");
		expect(result.bodyHtml).toContain("<code");
		expect(result.headings.map((h) => h.slug)).toEqual(["hello", "sub-head"]);
		expect(result.wordCount).toBeGreaterThan(0);
		expect(result.readingMinutes).toBeGreaterThanOrEqual(1);
	});

	it("renders KaTeX for math", async () => {
		const result = await renderMarkdown("Euler: $x^2$");
		expect(result.bodyHtml).toContain("katex");
	});

	it("counts CJK characters as words", async () => {
		const result = await renderMarkdown("你好世界");
		expect(result.wordCount).toBe(4);
		expect(result.excerpt).toBe("你好世界");
	});
});
