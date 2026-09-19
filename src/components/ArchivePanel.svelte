<script lang="ts">
import { onMount } from "svelte";

import I18nKey from "../i18n/i18nKey";
import { i18n } from "../i18n/translation";
import { getPostUrlBySlug } from "../utils/url-utils";

interface Post {
	slug: string;
	data: {
		title: string;
		tags: string[];
		category: string | null;
		published: Date;
	};
}

interface Group {
	year: number;
	posts: Post[];
}

interface ArchiveHit {
	slug: string;
	title: string;
	tags: string[];
	category: string | null;
	published: string;
}

let groups: Group[] = [];
let yearCounts: Record<number, number> = {};
let nextCursor: string | null = null;
let loading = false;
let exhausted = false;
let sentinel: HTMLElement | undefined;

function formatDate(date: Date) {
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	return `${month}-${day}`;
}

function formatTag(tagList: string[]) {
	return tagList.map((t) => `#${t}`).join(" ");
}

function queryString(cursor: string | null): string {
	const page = new URLSearchParams(window.location.search);
	const qs = new URLSearchParams();
	qs.set("limit", "20");
	const tag = page.get("tag")?.trim();
	if (tag) {
		qs.set("tag", tag);
	}
	const category = page.get("category")?.trim();
	if (category) {
		qs.set("category", category);
	}
	const uncategorized = page.get("uncategorized");
	if (uncategorized === "true" || uncategorized === "1") {
		qs.set("uncategorized", "true");
	}
	if (cursor) {
		qs.set("cursor", cursor);
	}
	return qs.toString();
}

function mergePosts(hits: ArchiveHit[]): void {
	const byYear = new Map<number, Post[]>();
	for (const group of groups) {
		byYear.set(group.year, [...group.posts]);
	}
	for (const hit of hits) {
		const published = new Date(hit.published);
		const year = published.getFullYear();
		const bucket = byYear.get(year) ?? [];
		bucket.push({
			slug: hit.slug,
			data: {
				title: hit.title,
				tags: hit.tags,
				category: hit.category,
				published,
			},
		});
		byYear.set(year, bucket);
	}
	groups = [...byYear.entries()]
		.map(([year, posts]) => ({ year, posts }))
		.sort((a, b) => b.year - a.year);
}

async function loadMore(): Promise<void> {
	if (loading || exhausted) {
		return;
	}
	loading = true;
	try {
		const res = await fetch(`/api/posts?${queryString(nextCursor)}`);
		if (!res.ok) {
			exhausted = true;
			return;
		}
		const body = (await res.json()) as {
			posts?: ArchiveHit[];
			nextCursor?: string | null;
			yearCounts?: Array<{ year: number; count: number }>;
		};
		const hits = Array.isArray(body.posts) ? body.posts : [];
		if (Array.isArray(body.yearCounts)) {
			// First page only: totals for year headers so counts don't jump while scrolling.
			const next: Record<number, number> = {};
			for (const row of body.yearCounts) {
				next[row.year] = row.count;
			}
			yearCounts = next;
		}
		mergePosts(hits);
		nextCursor =
			typeof body.nextCursor === "string" && body.nextCursor
				? body.nextCursor
				: null;
		if (!nextCursor) {
			exhausted = true;
		}
	} finally {
		loading = false;
		if (
			!exhausted &&
			sentinel &&
			sentinel.getBoundingClientRect().top < window.innerHeight
		) {
			void loadMore();
		}
	}
}

onMount(() => {
	void loadMore();
	const observer = new IntersectionObserver((entries) => {
		if (entries.some((entry) => entry.isIntersecting)) {
			void loadMore();
		}
	});
	if (sentinel) {
		observer.observe(sentinel);
	}
	return () => observer.disconnect();
});
</script>

<div class="card-base px-8 py-6">
    {#each groups as group}
        <div>
            <div class="flex flex-row w-full items-center h-[3.75rem]">
                <div class="w-[15%] md:w-[10%] transition text-2xl font-bold text-right text-75">
                    {group.year}
                </div>
                <div class="w-[15%] md:w-[10%]">
                    <div
                            class="h-3 w-3 bg-none rounded-full outline outline-[var(--primary)] mx-auto
                  -outline-offset-[2px] z-50 outline-3"
                    ></div>
                </div>
                <div class="w-[70%] md:w-[80%] transition text-left text-50">
                    {yearCounts[group.year] ?? group.posts.length} {i18n((yearCounts[group.year] ?? group.posts.length) === 1 ? I18nKey.postCount : I18nKey.postsCount)}
                </div>
            </div>

            {#each group.posts as post}
                <a
                        href={getPostUrlBySlug(post.slug)}
                        aria-label={post.data.title}
                        class="group btn-plain !block h-10 w-full rounded-lg hover:text-[initial]"
                >
                    <div class="flex flex-row justify-start items-center h-full">
                        <!-- date -->
                        <div class="w-[15%] md:w-[10%] transition text-sm text-right text-50">
                            {formatDate(post.data.published)}
                        </div>

                        <!-- dot and line -->
                        <div class="w-[15%] md:w-[10%] relative dash-line h-full flex items-center">
                            <div
                                    class="transition-all mx-auto w-1 h-1 rounded group-hover:h-5
                       bg-[oklch(0.5_0.05_var(--hue))] group-hover:bg-[var(--primary)]
                       outline outline-4 z-50
                       outline-[var(--card-bg)]
                       group-hover:outline-[var(--btn-plain-bg-hover)]
                       group-active:outline-[var(--btn-plain-bg-active)]"
                            ></div>
                        </div>

                        <!-- post title -->
                        <div
                                class="w-[70%] md:max-w-[65%] md:w-[65%] text-left font-bold
                     group-hover:translate-x-1 transition-all group-hover:text-[var(--primary)]
                     text-75 pr-8 whitespace-nowrap overflow-ellipsis overflow-hidden"
                        >
                            {post.data.title}
                        </div>

                        <!-- tag list -->
                        <div
                                class="hidden md:block md:w-[15%] text-left text-sm transition
                     whitespace-nowrap overflow-ellipsis overflow-hidden text-30"
                        >
                            {formatTag(post.data.tags)}
                        </div>
                    </div>
                </a>
            {/each}
        </div>
    {/each}
    <div bind:this={sentinel} class="h-8"></div>
    {#if loading}
        <p class="py-2 text-center text-sm text-50">Loading…</p>
    {:else if exhausted && groups.length === 0}
        <p class="py-2 text-center text-sm text-50">No posts.</p>
    {/if}
</div>
