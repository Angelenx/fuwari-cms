<script lang="ts">
import type { UiLocale } from "@i18n/locale";
import { localeCookieHeader, otherLocale } from "@i18n/locale";

let { locale }: { locale: UiLocale } = $props();

function toggle() {
	// SSR reads this cookie on the next load; Cookie Store is not everywhere.
	// biome-ignore lint/suspicious/noDocumentCookie: visitor locale cookie
	document.cookie = localeCookieHeader(otherLocale(locale));
	location.reload();
}
</script>

<button
	aria-label="Switch language"
	class="btn-plain scale-animation rounded-lg h-11 min-w-11 px-2 font-bold text-sm active:scale-90"
	onclick={toggle}
	type="button"
>
	{locale === "zh_CN" ? "中" : "EN"}
</button>
