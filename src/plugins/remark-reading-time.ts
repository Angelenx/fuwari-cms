import { toString as mdastToString } from "mdast-util-to-string";

/** Word count + reading minutes on `file.data`. CJK characters count as words. */
export function remarkReadingTime() {
	return (tree: unknown, file: { data: Record<string, unknown> }) => {
		const text = mdastToString(tree);
		const cjk = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
		const latin = text
			.replace(/[\u4e00-\u9fff]/g, " ")
			.trim()
			.split(/\s+/)
			.filter(Boolean).length;
		const words = cjk + latin;
		file.data.words = words;
		file.data.minutes = Math.max(1, Math.round(words / 200) || 1);
	};
}
