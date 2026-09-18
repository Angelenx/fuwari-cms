/** Strip a trailing slash so `/admin/` and `/admin` compare equal. */
export function normalizeAdminPath(pathname: string): string {
	return pathname.replace(/\/+$/, "") || "/";
}

/** Tab href that should look current for this path, or null off the tab strip. */
export function adminTabHref(pathname: string): string | null {
	const path = normalizeAdminPath(pathname);
	if (path === "/admin" || path.startsWith("/admin/posts")) {
		return "/admin";
	}
	if (path === "/admin/profile") {
		return "/admin/profile";
	}
	if (path === "/admin/site") {
		return "/admin/site";
	}
	if (path === "/admin/about") {
		return "/admin/about";
	}
	if (path === "/admin/account") {
		return "/admin/account";
	}
	return null;
}

/** Logged-in admin shell paths (not the login page). */
export function isAdminAppPath(pathname: string): boolean {
	const path = normalizeAdminPath(pathname);
	if (path === "/admin/login") {
		return false;
	}
	return path === "/admin" || path.startsWith("/admin/");
}
