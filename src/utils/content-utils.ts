import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { listPublishedPosts } from "@lib/posts";
import { getCategoryUrl } from "@utils/url-utils.ts";
import type { Page } from "astro";
import type { PostEntry } from "@/types/post";

/**
 * Ported from Fuwari: same exports, but backed by `@lib/posts` instead of
 * Astro Content Collections. Drafts are already excluded by the repository.
 */

export async function getSortedPosts(): Promise<PostEntry[]> {
	const sorted = await listPublishedPosts();

	for (let i = 1; i < sorted.length; i++) {
		sorted[i].data.nextSlug = sorted[i - 1].slug;
		sorted[i].data.nextTitle = sorted[i - 1].data.title;
	}
	for (let i = 0; i < sorted.length - 1; i++) {
		sorted[i].data.prevSlug = sorted[i + 1].slug;
		sorted[i].data.prevTitle = sorted[i + 1].data.title;
	}

	return sorted;
}

export type PostForList = {
	slug: string;
	data: PostEntry["data"];
};

/** Lightweight list for client components (no HTML body crosses the wire). */
export async function getSortedPostsList(): Promise<PostForList[]> {
	const sorted = await listPublishedPosts();
	return sorted.map((post) => ({ slug: post.slug, data: post.data }));
}

/**
 * SSR replacement for Astro's `paginate()` helper, which only exists in
 * `getStaticPaths`. Returns `undefined` when `current` is out of range so the
 * page can answer 404.
 */
export function paginatePosts<T>(
	items: T[],
	current: number,
	pageSize: number,
): Page<T> | undefined {
	const lastPage = Math.max(1, Math.ceil(items.length / pageSize));
	if (!Number.isInteger(current) || current < 1 || current > lastPage) {
		return undefined;
	}
	const start = (current - 1) * pageSize;
	const end = Math.min(start + pageSize, items.length);
	const pageUrl = (p: number) => (p === 1 ? "/" : `/${p}/`);
	return {
		data: items.slice(start, end),
		start,
		end: end - 1,
		total: items.length,
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

export type Tag = {
	name: string;
	count: number;
};

export async function getTagList(): Promise<Tag[]> {
	const allBlogPosts = await listPublishedPosts();

	const countMap: { [key: string]: number } = {};
	allBlogPosts.forEach((post) => {
		post.data.tags.forEach((tag: string) => {
			if (!countMap[tag]) countMap[tag] = 0;
			countMap[tag]++;
		});
	});

	// sort tags
	const keys: string[] = Object.keys(countMap).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export type Category = {
	name: string;
	count: number;
	url: string;
};

export async function getCategoryList(): Promise<Category[]> {
	const allBlogPosts = await listPublishedPosts();
	const count: { [key: string]: number } = {};
	allBlogPosts.forEach((post) => {
		if (!post.data.category) {
			const ucKey = i18n(I18nKey.uncategorized);
			count[ucKey] = count[ucKey] ? count[ucKey] + 1 : 1;
			return;
		}

		const categoryName = post.data.category.trim();
		count[categoryName] = count[categoryName] ? count[categoryName] + 1 : 1;
	});

	const lst = Object.keys(count).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	const ret: Category[] = [];
	for (const c of lst) {
		ret.push({
			name: c,
			count: count[c],
			url: getCategoryUrl(c),
		});
	}
	return ret;
}
