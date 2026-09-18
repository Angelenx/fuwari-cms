import { defineMiddleware } from "astro:middleware";
import "./i18n/locale-als";
import {
	defaultLocale,
	LOCALE_COOKIE,
	parseLocale,
	runWithLocale,
} from "./i18n/locale";
import { getSiteSettings } from "./lib/site-settings";

/**
 * Cookie wins; otherwise the Site default language from D1 / config.ts.
 */
export const onRequest = defineMiddleware(async (context, next) => {
	const fromCookie = parseLocale(context.cookies.get(LOCALE_COOKIE)?.value);
	const locale =
		fromCookie ??
		parseLocale((await getSiteSettings()).site.lang) ??
		defaultLocale();
	context.locals.locale = locale;
	return runWithLocale(locale, () => next());
});
