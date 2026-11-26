// The languages of the screens: the device's, for the screens no learner is on yet — the
// failure screens, sign-in and the screens before a learner — which is the choice an adult made on
// this device, else the first tag of navigator.languages that RFC 4647's "Lookup" finds among the
// build's languages, else English; and the learner's, the field of the profile, else the device's.
// No DOM.

/** The languages of the build. */
export const LANGUAGES = ["en", "ru"] as const;
export type Language = (typeof LANGUAGES)[number];

const KNOWN: ReadonlySet<string> = new Set(LANGUAGES);

/**
 * The language a tag finds by RFC 4647's Lookup: the tag cut from the right a subtag at a time —
 * a subtag of one letter or digit going with the one after it — until the build has it.
 */
export function lookup(tag: string): Language | undefined {
  const subtags = tag.toLowerCase().split("-");
  while (subtags.length > 0) {
    const candidate = subtags.join("-");
    if (KNOWN.has(candidate)) return candidate as Language;
    subtags.pop();
    if (subtags.length > 0 && (subtags.at(-1) as string).length === 1) subtags.pop();
  }
  return undefined;
}

/** The language of the device: the first of its languages the build has, else English. */
export function deviceLanguage(languages: readonly string[]): Language {
  for (const tag of languages) {
    const found = lookup(tag);
    if (found !== undefined) return found;
  }
  return "en";
}
