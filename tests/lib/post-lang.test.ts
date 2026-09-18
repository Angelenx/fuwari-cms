import { describe, expect, it } from "vitest";
import { parsePostLang } from "../../src/lib/post-lang";

describe("parsePostLang", () => {
	it("accepts Fuwari content codes and rejects junk", () => {
		expect(parsePostLang("zh_CN")).toBe("zh_CN");
		expect(parsePostLang(" en ")).toBe("en");
		expect(parsePostLang("zh-CN")).toBeUndefined();
		expect(parsePostLang("not-a-locale")).toBeUndefined();
	});
});
