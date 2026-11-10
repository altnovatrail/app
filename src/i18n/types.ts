// The shape of a dictionary (section 3.8 of docs/architecture.md; R10 in docs/decisions.md): the
// English one is the source, and every other is checked against it by tsc — every key and no other,
// a string where the source has a string, with the same places, and the forms of its own language
// where the source has forms of a number. No DOM.
import type { Language } from "./language.ts";

/** The categories of the forms of a number each language has (CLDR), as Intl.PluralRules gives. */
export const CATEGORIES = {
  en: ["one", "other"],
  ru: ["one", "few", "many", "other"],
} as const satisfies Record<Language, readonly string[]>;

export type Category<L extends Language> = (typeof CATEGORIES)[L][number];

/** The forms of a number, by category: `other` always among them. */
export interface Forms<C extends string = string> {
  readonly plural: Readonly<Record<C, string>>;
}

/** Marks the forms of a number in a dictionary. */
export function plural<const F extends Readonly<Record<string, string>> & { other: string }>(
  forms: F,
): Forms<keyof F & string> & { readonly plural: F } {
  return { plural: forms };
}

export type Entry = string | Forms;
export type Dictionary = Readonly<Record<string, Entry>>;

/** The names of the places of a string: `"{count} of {total}"` has `"count" | "total"`. */
export type Places<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | Places<Rest>
  : never;

/** The places of an entry: of its string, or of all its forms. */
export type EntryPlaces<E> = E extends string
  ? Places<E>
  : E extends { readonly plural: infer F }
    ? Places<F[keyof F] & string>
    : never;

/** A translation of a source into one language: the same keys, strings and forms of that language. */
export type Translation<S extends Dictionary, L extends Language> = {
  readonly [K in keyof S]: S[K] extends string ? string : Forms<Category<L>>;
};

/** The keys whose places differ between the source and a translation; `never` when none. */
export type PlacesDiffer<S extends Dictionary, T extends { readonly [K in keyof S]: Entry }> = {
  [K in keyof S]: [EntryPlaces<S[K]>] extends [EntryPlaces<T[K]>]
    ? [EntryPlaces<T[K]>] extends [EntryPlaces<S[K]>]
      ? never
      : K
    : K;
}[keyof S];

/** Holds when its argument is `true`: a check of a type that tsc does at compile time. */
export type Holds<T extends true> = T;

/** `true` when no key's places differ, else the keys that differ, which `Holds` refuses. */
export type SamePlaces<S extends Dictionary, T extends { readonly [K in keyof S]: Entry }> = [
  PlacesDiffer<S, T>,
] extends [never]
  ? true
  : PlacesDiffer<S, T>;
