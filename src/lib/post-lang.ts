/** Content-language codes stored on posts (Fuwari `html lang`, not the UI cookie). */
export const POST_LANG_OPTIONS = [
	{ value: "en", label: "English" },
	{ value: "zh_CN", label: "简体中文" },
	{ value: "zh_TW", label: "繁體中文" },
	{ value: "ja", label: "日本語" },
	{ value: "ko", label: "한국어" },
	{ value: "es", label: "Español" },
	{ value: "th", label: "ไทย" },
	{ value: "vi", label: "Tiếng Việt" },
	{ value: "tr", label: "Türkçe" },
	{ value: "id", label: "Indonesia" },
] as const;

export type PostLang = (typeof POST_LANG_OPTIONS)[number]["value"];

const POST_LANGS = new Set<string>(
	POST_LANG_OPTIONS.map((option) => option.value),
);

export function parsePostLang(raw: unknown): PostLang | undefined {
	if (typeof raw !== "string") {
		return undefined;
	}
	const value = raw.trim();
	return POST_LANGS.has(value) ? (value as PostLang) : undefined;
}
