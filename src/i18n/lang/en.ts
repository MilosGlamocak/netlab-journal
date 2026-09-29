import type { UIStrings } from "../types";

export default {
  meta: {
    homeTitle: "Netlab Journal – containerlab & network engineering labs",
    description:
      "Learning journal of a full-stack developer moving into network engineering: containerlab labs with Nokia SR Linux, VyOS and other network OSes.",
  },
  language: {
    label: "Language",
    fallbackNotice:
      "This page hasn't been translated to English yet, so the original (Serbian) is shown.",
  },
  nav: {
    home: "Home",
    posts: "Posts",
    tags: "Tags",
    about: "About",
    archives: "Archives",
    search: "Search",
  },
  post: {
    publishedAt: "Published at",
    updatedAt: "Updated",
    sharePostIntro: "Share this post:",
    sharePostOn: "Share this post on {{platform}}",
    sharePostViaEmail: "Share this post via email",
    tagLabel: "Tags",
    backToTop: "Back to top",
    goBack: "Go back",
    editPage: "Edit page",
    previousPost: "Previous Post",
    nextPost: "Next Post",
  },
  pagination: {
    prev: "Prev",
    next: "Next",
    page: "Page",
  },
  home: {
    socialLinks: "Social Links",
    featured: "Featured",
    recentPosts: "Recent Posts",
    allPosts: "All Posts",
    heroTitle: "From web development to network engineering:",
    heroIntro:
      "Here I document how I'm moving from full-stack web development into network engineering and security. Every post is one containerlab lab, in chronological order, with the mistakes and debugging I ran into along the way.",
    heroAboutBefore: "Read the posts below, or take a look at",
    heroAboutLink: "About me",
    heroAboutAfter: "for everything else you might want to know.",
  },
  footer: {
    copyright: "Copyright",
    allRightsReserved: "All rights reserved.",
  },
  pages: {
    tagTitle: "Tag",
    tagDesc: "All the articles with the tag",

    tagsTitle: "Tags",
    tagsDesc: "All the tags used in posts.",

    postsTitle: "Posts",
    postsDesc: "All the articles I've posted.",

    archivesTitle: "Archives",
    archivesDesc: "All the articles I've archived.",

    searchTitle: "Search",
    searchDesc: "Search any article ...",
  },
  a11y: {
    skipToContent: "Skip to content",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    toggleTheme: "Toggle theme",
    searchPlaceholder: "Search posts...",
    noResults: "No results found",
    goToPreviousPage: "Go to previous page",
    goToNextPage: "Go to next page",
  },
  notFound: {
    title: "404 Not Found",
    message: "Page Not Found",
    goHome: "Go back home",
  },
} satisfies UIStrings;
