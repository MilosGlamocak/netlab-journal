/** Supported site locales. The first one is the default language. */
export const locales = ["en", "sr"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Short label shown in the language switcher. */
export const localeLabels: Record<Locale, string> = {
  sr: "SR",
  en: "EN",
};

export function isLocale(value: string | undefined): value is Locale {
  return (locales as readonly string[]).includes(value ?? "");
}
