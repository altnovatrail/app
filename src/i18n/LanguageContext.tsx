// The language of the screen and its words, for every screen below Boot (section 3.8 of
// docs/architecture.md), and what changes the device's language.
import { createContext, useContext } from "react";
import type { Language } from "./language.ts";
import type { Words } from "./words.ts";

export interface LanguageState {
  readonly language: Language;
  readonly words: Words;
  /** Chooses the device's language: the screen changes at once, and the choice is kept. */
  readonly choose: (language: Language) => void;
}

const LanguageContext = createContext<LanguageState | undefined>(undefined);

export const LanguageProvider = LanguageContext.Provider;

export function useLanguage(): LanguageState {
  const state = useContext(LanguageContext);
  if (state === undefined) throw new Error("useLanguage outside LanguageProvider");
  return state;
}
