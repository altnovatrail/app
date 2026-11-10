// What app writes of numbers, sizes, dates, names of languages and orders (section 3.8 of
// docs/architecture.md): Intl in the screen's language, English after it for what that language
// lacks. The numbers of a module and what a learner might copy into an answer Intl does not touch.
// No DOM.
import type { Language } from "./language.ts";

const locales = (language: Language): string[] => [language, "en"];

export function numberFormat(language: Language, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locales(language), options);
}

export function dateTimeFormat(language: Language, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locales(language), options);
}

/** The names of languages in the screen's language: the language of a module's explanations. */
export function languageNames(language: Language) {
  return new Intl.DisplayNames(locales(language), { type: "language" });
}

/** The order of profiles and modules by name in the screen's language. */
export function collator(language: Language) {
  return new Intl.Collator(locales(language));
}
