import { adminTabHref, isAdminAppPath, normalizeAdminPath } from "./admin-nav";

const TOAST_MS = 2000;

function pageKey(href: string): string {
	const url = new URL(href, location.origin);
	return `${normalizeAdminPath(url.pathname)}${url.search}`;
}

function runInlineScripts(root: ParentNode): void {
	for (const old of [...root.querySelectorAll("script")]) {
		const next = document.createElement("script");
		for (const attr of old.attributes) {
			next.setAttribute(attr.name, attr.value);
		}
		if (old.src) {
			next.src = old.src;
		} else {
			const body = old.textContent ?? "";
			// Classic `let`/`const` outlive the <script> node, so a later tab's
			// `const form = ...` would throw without a fresh function scope.
			next.textContent =
				old.type === "module" ? body : `void function(){\n${body}\n}();`;
		}
		old.replaceWith(next);
	}
}

export function bootAdminChrome(): void {
	if (window.__adminChromeBooted) {
		return;
	}
	window.__adminChromeBooted = true;
	const toastEl = document.getElementById("admin-toast");
	let toastTimer = 0;

	function adminToast(ok: boolean, message: string): void {
		if (!toastEl) {
			return;
		}
		toastEl.textContent = message;
		toastEl.style.backgroundColor = ok ? "#16a34a" : "#dc2626";
		toastEl.classList.remove("opacity-0");
		window.clearTimeout(toastTimer);
		toastTimer = window.setTimeout(() => {
			toastEl.classList.add("opacity-0");
		}, TOAST_MS);
	}

	function queueAdminToast(ok: boolean, message: string): void {
		sessionStorage.setItem("admin-toast", JSON.stringify({ ok, message }));
	}

	function flushQueuedToast(): void {
		try {
			const raw = sessionStorage.getItem("admin-toast");
			if (!raw) {
				return;
			}
			sessionStorage.removeItem("admin-toast");
			const pending = JSON.parse(raw) as { ok?: boolean; message?: string };
			adminToast(Boolean(pending.ok), String(pending.message ?? ""));
		} catch {
			sessionStorage.removeItem("admin-toast");
		}
	}

	window.adminToast = adminToast;
	window.queueAdminToast = queueAdminToast;
	flushQueuedToast();

	document
		.getElementById("admin-logout")
		?.addEventListener("click", async () => {
			await fetch("/api/auth/logout", { method: "POST" });
			location.assign("/admin/login");
		});

	const nav = document.querySelector<HTMLElement>("nav[aria-label='Admin']");
	const panel = document.getElementById("admin-panel");
	const loading = document.getElementById("admin-loading");
	const actions = document.getElementById("admin-actions");
	const titleEl = document.getElementById("admin-header-title");
	if (!nav || !panel || !loading) {
		return;
	}

	let navAbort: AbortController | null = null;
	let navGen = 0;

	function setActiveTab(pathname: string): void {
		const current = adminTabHref(pathname);
		for (const link of nav.querySelectorAll("a")) {
			if (!(link instanceof HTMLAnchorElement)) {
				continue;
			}
			const on = adminTabHref(link.pathname) === current && current !== null;
			if (on) {
				link.setAttribute("aria-current", "page");
			} else {
				link.removeAttribute("aria-current");
			}
		}
	}

	function showLoader(): void {
		panel.replaceChildren();
		panel.hidden = true;
		actions?.replaceChildren();
		loading.hidden = false;
		loading.setAttribute("aria-busy", "true");
	}

	function hideLoader(): void {
		loading.hidden = true;
		loading.removeAttribute("aria-busy");
		panel.hidden = false;
	}

	function applyPage(html: string): boolean {
		const doc = new DOMParser().parseFromString(html, "text/html");
		if (!doc.querySelector("nav[aria-label='Admin']")) {
			return false;
		}
		const nextPanel = doc.getElementById("admin-panel");
		if (!nextPanel) {
			return false;
		}
		panel.innerHTML = nextPanel.innerHTML;
		try {
			runInlineScripts(panel);
		} catch {
			return false;
		}
		const nextActions = doc.getElementById("admin-actions");
		if (actions) {
			actions.innerHTML = nextActions?.innerHTML ?? "";
		}
		const nextTitle = doc.getElementById("admin-header-title");
		if (titleEl && nextTitle) {
			titleEl.textContent = nextTitle.textContent;
		}
		const fetchedTitle = doc.querySelector("title");
		if (fetchedTitle?.textContent) {
			document.title = fetchedTitle.textContent;
		}
		panel.classList.remove("admin-panel-in");
		void panel.offsetWidth;
		panel.classList.add("admin-panel-in");
		return true;
	}

	async function navigate(href: string, push: boolean): Promise<void> {
		const url = new URL(href, location.origin);
		if (!isAdminAppPath(url.pathname)) {
			location.assign(url.href);
			return;
		}
		if (pageKey(url.href) === pageKey(location.href) && push) {
			return;
		}

		setActiveTab(url.pathname);
		showLoader();
		if (push) {
			history.pushState({ admin: true }, "", `${url.pathname}${url.search}`);
		}

		navAbort?.abort();
		navAbort = new AbortController();
		const gen = ++navGen;
		try {
			// ponytail: swap Astro HTML instead of a JSON SPA. Ceiling is extra
			// bytes per click; upgrade to GET JSON + client render if it shows up.
			const res = await fetch(`${url.pathname}${url.search}`, {
				signal: navAbort.signal,
				headers: { Accept: "text/html" },
				cache: "no-store",
				credentials: "same-origin",
			});
			if (gen !== navGen) {
				return;
			}
			if (!res.ok) {
				hideLoader();
				adminToast(false, "Could not load.");
				return;
			}
			const html = await res.text();
			if (gen !== navGen) {
				return;
			}
			if (!applyPage(html)) {
				location.assign(`${url.pathname}${url.search}`);
				return;
			}
			hideLoader();
			flushQueuedToast();
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				return;
			}
			if (gen !== navGen) {
				return;
			}
			hideLoader();
			adminToast(false, "Could not load.");
		}
	}

	window.adminNavigate = (href: string) => navigate(href, true);

	document.addEventListener("click", (event) => {
		if (!isAdminAppPath(location.pathname)) {
			return;
		}
		if (event.defaultPrevented || event.button !== 0) {
			return;
		}
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}
		const link = (event.target as Element | null)?.closest("a[href]");
		if (
			!(link instanceof HTMLAnchorElement) ||
			link.target === "_blank" ||
			link.hasAttribute("download")
		) {
			return;
		}
		const url = new URL(link.href, location.origin);
		if (url.origin !== location.origin || !isAdminAppPath(url.pathname)) {
			return;
		}
		event.preventDefault();
		void navigate(`${url.pathname}${url.search}`, true);
	});

	window.addEventListener("popstate", () => {
		if (!isAdminAppPath(location.pathname)) {
			return;
		}
		void navigate(`${location.pathname}${location.search}`, false);
	});

	history.replaceState({ admin: true }, "", location.href);
	setActiveTab(location.pathname);
}
