import type { AstroIntegration } from "@swup/astro";

declare global {
	interface Window {
		// type from '@swup/astro' is incorrect
		swup: AstroIntegration;
		adminToast?: (ok: boolean, message: string) => void;
		queueAdminToast?: (ok: boolean, message: string) => void;
		adminNavigate?: (href: string) => Promise<void>;
		showAdminRenderProgress?: (opts?: { total?: number }) => void;
		setAdminRenderProgress?: (n: number) => void;
		hideAdminRenderProgress?: () => void;
		adminRenderMarkdown?: (markdown: string) => Promise<{
			bodyHtml: string;
			excerpt: string;
			wordCount: number;
			readingMinutes: number;
			headings: unknown[];
		}>;
		__adminChromeBooted?: boolean;
	}
}

export interface SearchResult {
	url: string;
	meta: {
		title: string;
	};
	excerpt: string;
	content?: string;
	word_count?: number;
	filters?: Record<string, unknown>;
	anchors?: Array<{
		element: string;
		id: string;
		text: string;
		location: number;
	}>;
	weighted_locations?: Array<{
		weight: number;
		balanced_score: number;
		location: number;
	}>;
	locations?: number[];
	raw_content?: string;
	raw_url?: string;
	sub_results?: SearchResult[];
}
