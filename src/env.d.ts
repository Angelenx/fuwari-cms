/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />

declare namespace App {
	interface Locals {
		locale: import("./i18n/locale").UiLocale;
	}
}
