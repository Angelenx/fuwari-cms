import type { MarkdownHeading } from "astro";

/**
 * Frontmatter-like metadata of a post. Mirrors Fuwari's content collection
 * schema so the ported components keep reading `entry.data.*`.
 */
export interface PostData {
	title: string;
	published: Date;
	updated?: Date;
	draft: boolean;
	description: string;
	/** Cover image: absolute URL, `/public` path, or empty string for none. */
	image: string;
	tags: string[];
	category: string | null;
	lang: string;
	// Neighbour links are filled in by `getPublishedPost` / `getSortedPosts`; never stored.
	prevSlug?: string;
	prevTitle?: string;
	nextSlug?: string;
	nextTitle?: string;
}

/**
 * A fully rendered post as served to pages. Markdown is rendered at write time
 * (see PLAN.md), so pages consume `bodyHtml` plus precomputed stats instead of
 * calling a render pipeline.
 */
export interface PostEntry {
	slug: string;
	data: PostData;
	bodyHtml: string;
	excerpt: string;
	words: number;
	minutes: number;
	headings: MarkdownHeading[];
}
