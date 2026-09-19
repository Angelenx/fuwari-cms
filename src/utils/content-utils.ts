import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import {
	countPublishedPosts,
	listPublishedCards,
	listPublishedCategories,
	listPublishedTags,
} from "@lib/posts";
import { getCategoryUrl } from "@utils/url-utils.ts";
import type { Page } from "astro";
import type { PostEntry } from "@/types/post";

/**
 * Ported from Fuwari: same exports, but backed by `@lib/posts` instead of
 * Astro Content Collections. Drafts are already excluded by the repository.
 */

/**
 * SSR replacement for Astro's `paginate()` helper, which only exists in
 * `getStaticPaths`. `items` is the current page slice when `total` is passed.
 * Returns `undefined` when `current` is out of range so the page can 404.
 */
export function paginatePosts<T>(
	items: T[],
	current: number,
	pageSize: number,
	total = items.length,
): Page<T> | undefined {
	const lastPage = Math.max(1, Math.ceil(total / pageSize));
	if (!Number.isInteger(current) || current < 1 || current > lastPage) {
		return undefined;
	}
	const start = (current - 1) * pageSize;
	const end = start + items.length;
	const pageUrl = (p: number) => (p === 1 ? "/" : `/${p}/`);
	return {
		data: items,
		start,
		end: items.length === 0 ? start : end - 1,
		total,
		currentPage: current,
		size: pageSize,
		lastPage,
		url: {
			current: pageUrl(current),
			prev: current > 1 ? pageUrl(current - 1) : undefined,
			next: current < lastPage ? pageUrl(current + 1) : undefined,
			first: current > 1 ? pageUrl(1) : undefined,
			last: current < lastPage ? pageUrl(lastPage) : undefined,
		},
	};
}

/** Home page of published cards (no HTML bodies). */
export async function getPublishedCardPage(
	current: number,
	pageSize: number,
): Promise<Page<PostEntry> | undefined> {
	const total = await countPublishedPosts();
	const lastPage = Math.max(1, Math.ceil(total / pageSize));
	if (!Number.isInteger(current) || current < 1 || current > lastPage) {
		return undefined;
	}
	const posts = await listPublishedCards({
		limit: pageSize,
		offset: (current - 1) * pageSize,
	});
	return paginatePosts(posts, current, pageSize, total);
}

export type Tag = {
	name: string;
	count: number;
};

export async function getTagList(): Promise<Tag[]> {
	return listPublishedTags();
}

export type Category = {
	name: string;
	count: number;
	url: string;
};

export async function getCategoryList(): Promise<Category[]> {
	const rows = await listPublishedCategories();
	const uncategorized = i18n(I18nKey.uncategorized);
	return rows.map((row) => {
		const name = row.name ?? uncategorized;
		return {
			name,
			count: row.count,
			url: getCategoryUrl(row.name),
		};
	});
}
