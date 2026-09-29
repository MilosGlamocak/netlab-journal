import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { getSortedPosts } from "@/utils/getSortedPosts";
import { getLocalizedPosts } from "@/utils/getLocalizedPosts";
import { getPostUrl } from "@/utils/getPostPaths";
import { getLocalePaths, useTranslations } from "@/i18n";
import type { Locale } from "@/i18n/locales";
import config from "@/config";

export function getStaticPaths() {
  return getLocalePaths();
}

export const GET: APIRoute = async ({ params }) => {
  const locale = params.locale as Locale;
  const posts = await getCollection("posts");
  const sortedPosts = getSortedPosts(getLocalizedPosts(posts, locale));

  return rss({
    title: config.site.title,
    description: useTranslations(locale).meta.description,
    site: config.site.url,
    customData: `<language>${locale}</language>`,
    items: sortedPosts.map(({ data, id, filePath }) => ({
      link: getPostUrl(id, filePath, locale),
      title: data.title,
      description: data.description,
      pubDate: new Date(data.modDatetime ?? data.pubDatetime),
    })),
  });
};
