// The language around a screen in a test: its words, the language they are in, and what records
// the languages chosen.
import type { ReactNode } from "react";
import { LanguageProvider } from "../i18n/LanguageContext.tsx";
import type { Language } from "../i18n/language.ts";
import { WORDS, type Words } from "../i18n/words.ts";

export function inLanguage(
  node: ReactNode,
  language: Language = "en",
  words: Words = WORDS[language],
  choose: (language: Language) => void = () => {},
) {
  return <LanguageProvider value={{ language, words, choose }}>{node}</LanguageProvider>;
}
