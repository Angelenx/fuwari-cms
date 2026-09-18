import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { LinkPreset, type NavBarLink } from "@/types/config";

/** Built per request so Home/Archive/About follow the UI locale. */
export function getLinkPresets(): { [key in LinkPreset]: NavBarLink } {
	return {
		[LinkPreset.Home]: {
			name: i18n(I18nKey.home),
			url: "/",
		},
		[LinkPreset.About]: {
			name: i18n(I18nKey.about),
			url: "/about/",
		},
		[LinkPreset.Archive]: {
			name: i18n(I18nKey.archive),
			url: "/archive/",
		},
	};
}
