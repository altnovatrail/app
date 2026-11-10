// A string of the dictionary whose places are elements: a module's or a skill's name with its own
// `lang` inside a string of app (section 3.8 of docs/architecture.md), never glued from pieces.
import { createElement, Fragment, type ReactNode } from "react";
import { useLanguage } from "./LanguageContext.tsx";
import { type Key, ownValue, type PlacesOf, pieces } from "./words.ts";

export interface PhraseProps<K extends Key> {
  readonly id: K;
  readonly values: Readonly<Record<PlacesOf<K>, ReactNode>>;
  /** The number whose form the string takes, for the forms of a number. */
  readonly count?: number;
}

export function Phrase<K extends Key>({ id, values, count }: PhraseProps<K>) {
  const { words } = useLanguage();
  const filled = pieces(words.pattern(id, count)).map((piece) => {
    if ("text" in piece) return piece.text;
    return ownValue<ReactNode>(values, piece.place) ?? `{${piece.place}}`;
  });
  // Children given one by one, as the string has them: no key to make up.
  return createElement(Fragment, null, ...filled);
}
