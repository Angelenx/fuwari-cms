import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { profileConfig, siteConfig } from "../../src/config";
import {
	getSiteSettings,
	parseSiteSettingsInput,
	upsertSiteSettings,
} from "../../src/lib/site-settings";

describe("site settings", () => {
	beforeEach(async () => {
		await env.DB.prepare("DELETE FROM site_settings").run();
	});
	it("uses config.ts when the table is empty", async () => {
		const settings = await getSiteSettings();
		expect(settings.profile.name).toBe(profileConfig.name);
		expect(settings.profile.avatar).toBe(profileConfig.avatar);
		expect(settings.profile.bio).toBe(profileConfig.bio);
		expect(settings.profile.links.map((link) => link.icon)).toEqual([
			"simple-icons:csdn",
			"simple-icons:bilibili",
			"simple-icons:github",
		]);
		expect(settings.banner.src).toBe(siteConfig.banner.src);
		expect(settings.banner.enable).toBe(siteConfig.banner.enable);
	});

	it("falls back per field when stored values are blank", async () => {
		await env.DB.prepare(
			`INSERT INTO site_settings (id, avatar, name, bio, links_json, banner_json)
			 VALUES (1, '', 'Ada', '', NULL, '{"enable":false}')`,
		).run();
		const settings = await getSiteSettings();
		expect(settings.profile.name).toBe("Ada");
		expect(settings.profile.avatar).toBe(profileConfig.avatar);
		expect(settings.profile.bio).toBe(profileConfig.bio);
		expect(settings.profile.links[0]?.url).toBe(profileConfig.links[0]?.url);
		expect(settings.banner.enable).toBe(false);
		expect(settings.banner.src).toBe(siteConfig.banner.src);
	});

	it("reads back an upsert and rejects javascript: avatar", async () => {
		const saved = await upsertSiteSettings({
			avatar: "https://example.com/me.png",
			name: "Ada",
			bio: "Hi",
			linkUrls: [
				"https://blog.csdn.net/ada",
				"https://space.bilibili.com/1",
				"https://github.com/ada",
			],
			banner: {
				enable: true,
				src: "https://example.com/banner.png",
				position: "top",
				credit: {
					enable: true,
					text: "Credit",
					url: "https://example.com",
				},
			},
		});
		expect(saved.profile.name).toBe("Ada");
		expect(saved.profile.links[1]?.url).toBe("https://space.bilibili.com/1");
		expect(saved.banner.position).toBe("top");
		expect(saved.banner.src).toBe("https://example.com/banner.png");

		const parsed = parseSiteSettingsInput({
			avatar: "javascript:alert(1)",
			name: "Ada",
			bio: "",
			links: [{ url: "" }, { url: "" }, { url: "" }],
			banner: {
				enable: false,
				src: "",
				position: "center",
				credit: { enable: false, text: "", url: "" },
			},
		});
		expect(parsed).toEqual({ error: "Invalid avatar" });
	});
});
