import { describe, expect, it } from "vitest";
import { adminTabHref, isAdminAppPath } from "../../src/lib/admin-nav";

describe("admin nav", () => {
	it("maps post editor routes to the Posts tab", () => {
		expect(adminTabHref("/admin")).toBe("/admin");
		expect(adminTabHref("/admin/")).toBe("/admin");
		expect(adminTabHref("/admin/posts/new")).toBe("/admin");
		expect(adminTabHref("/admin/posts/12")).toBe("/admin");
	});

	it("maps identity tabs and ignores login", () => {
		expect(adminTabHref("/admin/profile")).toBe("/admin/profile");
		expect(adminTabHref("/admin/site")).toBe("/admin/site");
		expect(adminTabHref("/admin/about")).toBe("/admin/about");
		expect(adminTabHref("/admin/login")).toBeNull();
		expect(isAdminAppPath("/admin/login")).toBe(false);
		expect(isAdminAppPath("/admin/profile")).toBe(true);
	});
});
