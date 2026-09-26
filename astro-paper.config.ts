import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://TODO-your-domain.example/",
    title: "TODO: Site title (e.g. networking blog name)",
    description: "TODO: One-line site description for SEO/meta tags.",
    author: "TODO: Your name",
    profile: "TODO: link to your profile site, or remove this line",
    ogImage: "default-og.jpg",
    lang: "en",
    timezone: "Europe/Sarajevo",
    dir: "ltr",
  },
  posts: {
    perPage: 4,
    perIndex: 4,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: true,
      url: "https://github.com/TODO-your-username/netlab-blog/edit/main/",
    },
    search: "pagefind",
  },
  socials: [
    { name: "github",   url: "https://github.com/TODO-your-username" },
    { name: "linkedin", url: "https://www.linkedin.com/in/TODO-your-linkedin/" },
    { name: "mail",     url: "mailto:TODO-your-email@example.com" },
  ],
  shareLinks: [
    { name: "whatsapp", url: "https://wa.me/?text=" },
    { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    { name: "x",        url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "pinterest", url: "https://pinterest.com/pin/create/button/?url=" },
    { name: "mail",     url: "mailto:?subject=See%20this%20post&body=" },
  ],
});