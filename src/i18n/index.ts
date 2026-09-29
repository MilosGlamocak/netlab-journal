import type { UIStrings } from "./types";
import { defaultLocale, locales } from "./locales";

export { tplStr } from "./format";

const modules = import.meta.glob<{ default: UIStrings }>("./lang/*.ts", {
  eager: true,
});

const translations: Record<string, UIStrings> = {};
for (const [path, mod] of Object.entries(modules)) {
  const locale = path.slice("./lang/".length, -".ts".length);
  translations[locale] = mod.default;
}

/** Returns UI strings for the given locale, falling back to the default locale. */
export function useTranslations(locale: string = defaultLocale): UIStrings {
  return translations[locale] ?? translations[defaultLocale];
}

/** `getStaticPaths` result for pages that only differ by `[locale]`. */
export function getLocalePaths() {
  return locales.map(locale => ({ params: { locale } }));
}
