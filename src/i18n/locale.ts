import { AsyncLocalStorage } from "node:async_hooks";
import { siteConfig } from "../config";

/** Visitor UI locale. Content language on posts is separate. */
export const UI_LOCALES = ["en", "zh_CN"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

export const LOCALE_COOKIE = "locale";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const localeStore = new AsyncLocalStorage<UiLocale>();

export function parseLocale(
	raw: string | undefined | null,
): UiLocale | undefined {
	if (!raw) {
		return undefined;
	}
	const normalized = raw.trim().replace(/-/g, "_").toLowerCase();
	if (normalized === "en" || normalized.startsWith("en_")) {
		return "en";
	}
	if (
		normalized === "zh" ||
		normalized === "zh_cn" ||
		normalized.startsWith("zh_cn")
	) {
		return "zh_CN";
	}
	return undefined;
}

export function defaultLocale(): UiLocale {
	return parseLocale(siteConfig.lang) ?? "en";
}

function cookieValue(name: string): string | undefined {
	if (typeof document === "undefined") {
		return undefined;
	}
	for (const part of document.cookie.split(";")) {
		const trimmed = part.trim();
		const eq = trimmed.indexOf("=");
		if (eq < 0) {
			continue;
		}
		if (trimmed.slice(0, eq) === name) {
			return decodeURIComponent(trimmed.slice(eq + 1));
		}
	}
	return undefined;
}

/** Request locale (SSR ALS), visitor cookie, or `<html lang>` from the site default. */
export function getUiLocale(): UiLocale {
	const htmlLang =
		typeof document !== "undefined" ? document.documentElement.lang : undefined;
	return (
		localeStore.getStore() ??
		parseLocale(cookieValue(LOCALE_COOKIE)) ??
		parseLocale(htmlLang) ??
		defaultLocale()
	);
}

export function runWithLocale<T>(locale: UiLocale, fn: () => T): T {
	return localeStore.run(locale, fn);
}

export function otherLocale(locale: UiLocale): UiLocale {
	return locale === "zh_CN" ? "en" : "zh_CN";
}

/** Client-side cookie for the next full page load (SSR reads it). */
export function localeCookieHeader(locale: UiLocale): string {
	return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}
