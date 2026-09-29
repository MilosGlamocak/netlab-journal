import type { CollectionEntry } from "astro:content";
import { defaultLocale, type Locale } from "@/i18n/locales";
import { getPostLocale, getPostSlug } from "./getPostPaths";
import { postFilter } from "./postFilter";

export type LocalizedPost = CollectionEntry<"posts"> & {
  /** True when no translation exists and the post is shown in another language. */
  isFallback: boolean;
};

/**
 * Picks one version of every post for the given locale.
 *
 * Translations of the same post share a file name (and folder path) inside
 * `src/content/posts/<locale>/`. If the post has no translation for `locale`,
 * the original (default locale) version is used, so every post exists in
 * every language. Drafts and scheduled posts are removed first.
 */
export function getLocalizedPosts(
  posts: CollectionEntry<"posts">[],
  locale: Locale
): LocalizedPost[] {
  const byKey = new Map<string, CollectionEntry<"posts">[]>();
  for (const post of posts.filter(postFilter)) {
    const key = getPostSlug(post.id, post.filePath);
    byKey.set(key, [...(byKey.get(key) ?? []), post]);
  }

  return [...byKey.values()].map(versions => {
    const pick =
      versions.find(p => getPostLocale(p.filePath) === locale) ??
      versions.find(p => getPostLocale(p.filePath) === defaultLocale) ??
      versions[0];
    return { ...pick, isFallback: getPostLocale(pick.filePath) !== locale };
  });
}
