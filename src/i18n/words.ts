// The words of a screen, from its language's dictionary (section 3.8 of docs/architecture.md): a
// key's string with its places filled by name, never glued from pieces, and the form of a number
// that Intl.PluralRules chooses — `other` when the dictionary has not the category it gives. No DOM.
import { en } from "./en.ts";
import type { Language } from "./language.ts";
import { ru } from "./ru.ts";
import type { Entry, EntryPlaces, Forms } from "./types.ts";

export type Key = keyof typeof en;

/** The places a key's string takes, and `count` for the forms of a number. */
export type PlacesOf<K extends Key> =
  | EntryPlaces<(typeof en)[K]>
  | ((typeof en)[K] extends Forms ? "count" : never);

/** The values of a key's places, by name. */
export type Values<K extends Key> = Readonly<Record<PlacesOf<K>, string | number>>;

/** What a dictionary holds for every key: a string, or the forms of a number. */
export type Strings = Readonly<Record<Key, Entry>>;

export interface Words {
  readonly language: Language;
  /** A key's string with its places filled; the values only where the key has places. */
  text<K extends Key>(key: K, ...values: [PlacesOf<K>] extends [never] ? [] : [Values<K>]): string;
  /** A key's string with its places unfilled, the form chosen by `count`, for a phrase of elements. */
  pattern(key: Key, count?: number): string;
}

/** A piece of a string: its text, or a place by its name. */
export type Piece = { readonly text: string } | { readonly place: string };

/** A string cut into its text and its places `{name}`, in their order. */
export function pieces(pattern: string): Piece[] {
  return pattern
    .split(/(\{[^{}]+\})/)
    .filter((part) => part !== "")
    .map((part) => (/^\{[^{}]+\}$/.test(part) ? { place: part.slice(1, -1) } : { text: part }));
}

/** The value of a place, if the values have one of their own: not one of Object's. */
export function ownValue<T>(values: Readonly<Record<string, T>>, name: string): T | undefined {
  return Object.hasOwn(values, name) ? values[name] : undefined;
}

/** Fills each `{name}` with its value; one without a value stays as it is. */
export function fill(pattern: string, values: Readonly<Record<string, unknown>>): string {
  return pieces(pattern)
    .map((piece) => {
      if ("text" in piece) return piece.text;
      const value = ownValue(values, piece.place);
      return value === undefined ? `{${piece.place}}` : String(value);
    })
    .join("");
}

/** The words of a dictionary in a language, whose rules choose the forms of a number. */
export function wordsOf(dictionary: Strings, language: Language): Words {
  const rules = new Intl.PluralRules(language);
  const pattern = (key: Key, count = 0): string => {
    const entry = dictionary[key];
    if (typeof entry === "string") return entry;
    return entry.plural[rules.select(count)] ?? (entry.plural.other as string);
  };
  return {
    language,
    pattern,
    text(key, ...values) {
      const given: Readonly<Record<string, unknown>> = values[0] ?? {};
      const count = ownValue(given, "count");
      return fill(pattern(key, typeof count === "number" ? count : 0), given);
    },
  };
}

/** The dictionaries of the build. */
export const DICTIONARIES: Readonly<Record<Language, Strings>> = { en, ru };

/** The words of each language of the build. */
export const WORDS: Readonly<Record<Language, Words>> = {
  en: wordsOf(en, "en"),
  ru: wordsOf(ru, "ru"),
};
