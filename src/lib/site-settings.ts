import { env } from "cloudflare:workers";
import { profileConfig, siteConfig } from "../config";
import { parseLocale, type UiLocale } from "../i18n/locale";
import type { ProfileConfig, SiteConfig } from "../types/config";

/**
 * Public appearance stored as one D1 row (profile, banner, site identity, about).
 * Missing row or blank fields overlay `src/config.ts` so the live frontend
 * values stay the defaults until something is saved.
 */

export type BannerSettings = SiteConfig["banner"];

export type SiteIdentity = {
	title: string;
	subtitle: string;
	footer: string;
	lang: UiLocale;
};

export type AboutContent = {
	md: string;
	html: string;
};

export type SiteSettings = {
	profile: ProfileConfig;
	banner: BannerSettings;
	site: SiteIdentity;
	about: AboutContent;
};

/** Matches the previous hardcoded about page until `/admin/about` is saved. */
export const DEFAULT_ABOUT_MD =
	"This is the about page. It will be editable from `/admin` once the data layer lands.";

export const DEFAULT_ABOUT_HTML =
	"<p>This is the about page. It will be editable from <code>/admin</code> once the data layer lands.</p>";

export type SiteSettingsWrite = {
	avatar: string;
	name: string;
	bio: string;
	linkUrls: string[];
	banner: {
		enable: boolean;
		src: string;
		position: "top" | "center" | "bottom";
		credit: {
			enable: boolean;
			text: string;
			url: string;
		};
	};
};

export type SiteIdentityWrite = {
	title: string;
	subtitle: string;
	footer: string;
	lang: UiLocale;
};

export type AboutWrite = {
	bodyMd: string;
	bodyHtml: string;
};

type SettingsRow = {
	avatar: string | null;
	name: string | null;
	bio: string | null;
	links_json: string | null;
	banner_json: string | null;
	title: string | null;
	subtitle: string | null;
	footer: string | null;
	lang: string | null;
	about_md: string | null;
	about_html: string | null;
};
const NAME_MAX = 80;
const TITLE_MAX = 80;
const SUBTITLE_MAX = 120;
const FOOTER_MAX = 200;
const BIO_MAX = 500;
const URL_MAX = 2048;
const CREDIT_MAX = 200;
const LINK_SLOTS = 3;
const POSITIONS = new Set(["top", "center", "bottom"]);

function nonempty(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function parseJson(raw: string | null): unknown {
	if (!raw) {
		return undefined;
	}
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return undefined;
	}
}

function isHttpUrl(value: string): boolean {
	try {
		const parsed = new URL(value);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

/** Avatar / banner src: empty (fallback), http(s), public `/…`, or local `assets/…`. */
export function isSafeImageSrc(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) {
		return true;
	}
	if (trimmed.length > URL_MAX) {
		return false;
	}
	const lower = trimmed.toLowerCase();
	if (
		lower.startsWith("javascript:") ||
		lower.startsWith("data:") ||
		lower.startsWith("vbscript:")
	) {
		return false;
	}
	if (trimmed.startsWith("//")) {
		return false;
	}
	if (/^https?:\/\//i.test(trimmed)) {
		return isHttpUrl(trimmed);
	}
	if (trimmed.startsWith("/")) {
		return !trimmed.includes("..");
	}
	return !trimmed.includes("..") && /^[\w./-]+$/.test(trimmed);
}

function mergeLinks(raw: unknown): ProfileConfig["links"] {
	const defaults = profileConfig.links;
	const stored = Array.isArray(raw) ? raw : [];
	return defaults.map((slot, index) => {
		const item = stored[index];
		const url =
			item && typeof item === "object"
				? nonempty((item as { url?: unknown }).url)
				: nonempty(item);
		return { ...slot, url: url ?? slot.url };
	});
}

function mergeBanner(raw: unknown): BannerSettings {
	const defaults = siteConfig.banner;
	if (!raw || typeof raw !== "object") {
		return {
			...defaults,
			credit: { ...defaults.credit },
		};
	}
	const stored = raw as Record<string, unknown>;
	const creditRaw =
		stored.credit && typeof stored.credit === "object"
			? (stored.credit as Record<string, unknown>)
			: {};
	const position = nonempty(stored.position);
	const creditUrl = nonempty(creditRaw.url);
	return {
		enable:
			typeof stored.enable === "boolean" ? stored.enable : defaults.enable,
		src: nonempty(stored.src) ?? defaults.src,
		position:
			position && POSITIONS.has(position)
				? (position as "top" | "center" | "bottom")
				: (defaults.position ?? "center"),
		credit: {
			enable:
				typeof creditRaw.enable === "boolean"
					? creditRaw.enable
					: defaults.credit.enable,
			text: nonempty(creditRaw.text) ?? defaults.credit.text,
			...(creditUrl
				? { url: creditUrl }
				: defaults.credit.url
					? { url: defaults.credit.url }
					: {}),
		},
	};
}

function defaultFooter(title: string): string {
	return `Powered by Astro & ${title}`;
}

function mergeIdentity(row: SettingsRow | null): SiteIdentity {
	const title = nonempty(row?.title) ?? siteConfig.title;
	return {
		title,
		subtitle: nonempty(row?.subtitle) ?? siteConfig.subtitle,
		footer: nonempty(row?.footer) ?? defaultFooter(title),
		lang: parseLocale(row?.lang) ?? parseLocale(siteConfig.lang) ?? "en",
	};
}

function mergeAbout(row: SettingsRow | null): AboutContent {
	return {
		md: nonempty(row?.about_md) ?? DEFAULT_ABOUT_MD,
		html: nonempty(row?.about_html) ?? DEFAULT_ABOUT_HTML,
	};
}

function mergeRow(row: SettingsRow | null): SiteSettings {
	if (!row) {
		const site = mergeIdentity(null);
		return {
			profile: {
				...profileConfig,
				links: profileConfig.links.map((link) => ({ ...link })),
			},
			banner: {
				...siteConfig.banner,
				credit: { ...siteConfig.banner.credit },
			},
			site,
			about: mergeAbout(null),
		};
	}
	return {
		profile: {
			avatar: nonempty(row.avatar) ?? profileConfig.avatar,
			name: nonempty(row.name) ?? profileConfig.name,
			bio: nonempty(row.bio) ?? profileConfig.bio,
			links: mergeLinks(parseJson(row.links_json)),
		},
		banner: mergeBanner(parseJson(row.banner_json)),
		site: mergeIdentity(row),
		about: mergeAbout(row),
	};
}

/** Effective profile, banner, identity, and about after overlaying D1 on `src/config.ts`. */
export async function getSiteSettings(): Promise<SiteSettings> {
	const row = await env.DB.prepare(
		`SELECT avatar, name, bio, links_json, banner_json,
			title, subtitle, footer, lang, about_md, about_html
		 FROM site_settings WHERE id = 1`,
	).first<SettingsRow>();
	return mergeRow(row);
}

function asRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function parseLinkUrls(value: unknown): string[] | { error: string } {
	if (!Array.isArray(value) || value.length !== LINK_SLOTS) {
		return { error: "Invalid links" };
	}
	const urls: string[] = [];
	for (const item of value) {
		const url =
			item && typeof item === "object"
				? nonempty((item as { url?: unknown }).url)
				: nonempty(item);
		const raw = url ?? "";
		if (raw.length > URL_MAX) {
			return { error: "Invalid link URL" };
		}
		if (raw && !isHttpUrl(raw)) {
			return { error: "Invalid link URL" };
		}
		urls.push(raw);
	}
	return urls;
}

function parseBanner(
	value: unknown,
): SiteSettingsWrite["banner"] | { error: string } {
	if (!asRecord(value)) {
		return { error: "Invalid banner" };
	}
	if (typeof value.enable !== "boolean") {
		return { error: "Invalid banner" };
	}
	if (typeof value.src !== "string" || !isSafeImageSrc(value.src)) {
		return { error: "Invalid banner src" };
	}
	const position = nonempty(value.position) ?? "center";
	if (!POSITIONS.has(position)) {
		return { error: "Invalid banner position" };
	}
	if (!asRecord(value.credit)) {
		return { error: "Invalid banner credit" };
	}
	if (typeof value.credit.enable !== "boolean") {
		return { error: "Invalid banner credit" };
	}
	if (typeof value.credit.text !== "string") {
		return { error: "Invalid banner credit" };
	}
	const text = value.credit.text.trim();
	if (text.length > CREDIT_MAX) {
		return { error: "Invalid banner credit" };
	}
	const creditUrl =
		typeof value.credit.url === "string" ? value.credit.url.trim() : "";
	if (creditUrl.length > URL_MAX || (creditUrl && !isHttpUrl(creditUrl))) {
		return { error: "Invalid banner credit URL" };
	}
	return {
		enable: value.enable,
		src: value.src.trim(),
		position: position as "top" | "center" | "bottom",
		credit: { enable: value.credit.enable, text, url: creditUrl },
	};
}

/** Trust-boundary parse for PUT /api/admin/profile. */
export function parseSiteSettingsInput(
	body: unknown,
): SiteSettingsWrite | { error: string } {
	if (!asRecord(body)) {
		return { error: "Invalid body" };
	}
	if (typeof body.avatar !== "string" || !isSafeImageSrc(body.avatar)) {
		return { error: "Invalid avatar" };
	}
	const name = nonempty(body.name);
	if (!name || name.length > NAME_MAX) {
		return { error: "Invalid name" };
	}
	if (typeof body.bio !== "string" || body.bio.length > BIO_MAX) {
		return { error: "Invalid bio" };
	}
	const linkUrls = parseLinkUrls(body.links);
	if (!Array.isArray(linkUrls)) {
		return linkUrls;
	}
	const banner = parseBanner(body.banner);
	if ("error" in banner) {
		return banner;
	}
	return {
		avatar: body.avatar.trim(),
		name,
		bio: body.bio.trim(),
		linkUrls,
		banner,
	};
}

export async function upsertSiteSettings(
	input: SiteSettingsWrite,
): Promise<SiteSettings> {
	const linksJson = JSON.stringify(
		profileConfig.links.map((slot, index) => ({
			name: slot.name,
			icon: slot.icon,
			url: input.linkUrls[index] ?? "",
		})),
	);
	const bannerJson = JSON.stringify(input.banner);
	await env.DB.prepare(
		`INSERT INTO site_settings (id, avatar, name, bio, links_json, banner_json, updated_at)
		 VALUES (1, ?, ?, ?, ?, ?, datetime('now'))
		 ON CONFLICT(id) DO UPDATE SET
			avatar = excluded.avatar,
			name = excluded.name,
			bio = excluded.bio,
			links_json = excluded.links_json,
			banner_json = excluded.banner_json,
			updated_at = excluded.updated_at`,
	)
		.bind(input.avatar, input.name, input.bio, linksJson, bannerJson)
		.run();
	return getSiteSettings();
}

/** Trust-boundary parse for PUT /api/admin/site. */
export function parseSiteIdentityInput(
	body: unknown,
): SiteIdentityWrite | { error: string } {
	if (!asRecord(body)) {
		return { error: "Invalid body" };
	}
	const title = nonempty(body.title);
	if (!title || title.length > TITLE_MAX) {
		return { error: "Invalid title" };
	}
	if (
		typeof body.subtitle !== "string" ||
		body.subtitle.length > SUBTITLE_MAX
	) {
		return { error: "Invalid subtitle" };
	}
	if (typeof body.footer !== "string" || body.footer.length > FOOTER_MAX) {
		return { error: "Invalid footer" };
	}
	const lang = parseLocale(
		typeof body.lang === "string" ? body.lang : undefined,
	);
	if (!lang) {
		return { error: "Invalid lang" };
	}
	return {
		title,
		subtitle: body.subtitle.trim(),
		footer: body.footer.trim(),
		lang,
	};
}

export async function upsertSiteIdentity(
	input: SiteIdentityWrite,
): Promise<SiteSettings> {
	await env.DB.prepare(
		`INSERT INTO site_settings (id, title, subtitle, footer, lang, updated_at)
		 VALUES (1, ?, ?, ?, ?, datetime('now'))
		 ON CONFLICT(id) DO UPDATE SET
			title = excluded.title,
			subtitle = excluded.subtitle,
			footer = excluded.footer,
			lang = excluded.lang,
			updated_at = excluded.updated_at`,
	)
		.bind(input.title, input.subtitle, input.footer, input.lang)
		.run();
	return getSiteSettings();
}

/** Trust-boundary parse for PUT /api/admin/about. */
export function parseAboutInput(
	body: unknown,
): { bodyMd: string } | { error: string } {
	if (!asRecord(body)) {
		return { error: "Invalid body" };
	}
	if (typeof body.bodyMd !== "string") {
		return { error: "Invalid bodyMd" };
	}
	return { bodyMd: body.bodyMd };
}

export async function upsertAbout(input: AboutWrite): Promise<SiteSettings> {
	await env.DB.prepare(
		`INSERT INTO site_settings (id, about_md, about_html, updated_at)
		 VALUES (1, ?, ?, datetime('now'))
		 ON CONFLICT(id) DO UPDATE SET
			about_md = excluded.about_md,
			about_html = excluded.about_html,
			updated_at = excluded.updated_at`,
	)
		.bind(input.bodyMd, input.bodyHtml)
		.run();
	return getSiteSettings();
}
