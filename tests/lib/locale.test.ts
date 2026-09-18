import { describe, expect, it } from "vitest";
import I18nKey from "../../src/i18n/i18nKey";
import {
	getUiLocale,
	otherLocale,
	parseLocale,
	runWithLocale,
} from "../../src/i18n/locale";
import { i18n } from "../../src/i18n/translation";

describe("ui locale", () => {
	it("parses en and zh_CN only", () => {
		expect(parseLocale("en")).toBe("en");
		expect(parseLocale("zh-CN")).toBe("zh_CN");
		expect(parseLocale("zh_cn")).toBe("zh_CN");
		expect(parseLocale("ja")).toBeUndefined();
	});

	it("translates Home/Archive inside runWithLocale", () => {
		expect(runWithLocale("en", () => i18n(I18nKey.home))).toBe("Home");
		expect(runWithLocale("zh_CN", () => i18n(I18nKey.home))).toBe("主页");
		expect(runWithLocale("zh_CN", () => i18n(I18nKey.archive))).toBe("归档");
		expect(otherLocale("en")).toBe("zh_CN");
		expect(getUiLocale()).toBe("en");
	});
});
