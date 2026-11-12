// What app writes of numbers, shares, sizes, dates, lists, names of languages and orders (section
// 3.8 of docs/architecture.md): Intl in the screen's language, English after it for what that
// language lacks. The numbers of a module and what a learner might copy into an answer Intl does
// not touch. No DOM.
import type { Language } from "./language.ts";

const locales = (language: Language): string[] => [language, "en"];

export function numberFormat(language: Language, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locales(language), options);
}

export function dateTimeFormat(language: Language, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locales(language), options);
}

/**
 * A list as the screen's language joins it: "A, B, and C", «A, B и C». Its parts tell the names
 * from the words between them, so that a name in a language of its own keeps its `lang`.
 */
export function listFormat(language: Language, options?: Intl.ListFormatOptions) {
  return new Intl.ListFormat(locales(language), options);
}

/** A share in whole percent, from 0 to 100, as the language writes it: "40%", «40 %». */
export function percentText(language: Language, percent: number): string {
  return numberFormat(language, { style: "percent" }).format(percent / 100);
}

/** The names of languages in the screen's language: the language of a module's explanations. */
export function languageNames(language: Language) {
  return new Intl.DisplayNames(locales(language), { type: "language" });
}

/**
 * A language's name in the screen's language, as it stands inside a sentence. Engines differ on its
 * first letter in Russian: V8 and SpiderMonkey give CLDR's "английский", JavaScriptCore gives
 * "Английский" (T34 in RUN.md), and inside a Russian sentence a language's name is in lower case.
 * A tag Intl cannot read throws, as `of` does; one it reads but cannot name stands for itself.
 */
export function languageName(language: Language, tag: string): string {
  const name = languageNames(language).of(tag) ?? tag;
  if (language !== "ru") return name;
  return name.charAt(0).toLocaleLowerCase("ru") + name.slice(1);
}

/** The order of profiles and modules by name in the screen's language. */
export function collator(language: Language) {
  return new Intl.Collator(locales(language));
}

const UNITS = [
  ["gigabyte", 1e9],
  ["megabyte", 1e6],
  ["kilobyte", 1e3],
] as const;

/**
 * A size in bytes, as the page This device writes it: kB, MB or GB, with a decimal at most. The unit
 * is the largest the size rounds to one of at least, so that it is never "1,000 kB".
 */
export function sizeText(language: Language, bytes: number): string {
  const [unit, size] = UNITS.find(([, each]) => Math.round((bytes / each) * 10) >= 10) ?? UNITS[2];
  const format = numberFormat(language, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: 1,
  });
  return format.format(bytes / size);
}
