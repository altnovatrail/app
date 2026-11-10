// The buttons that choose the device's language (section 3.8 of docs/architecture.md): buttons, not
// a list whose choice would change the screen by itself (WCAG 3.2.2), each language by its own name
// in its own language, the chosen one pressed. A tap changes the screen at once.
import { useLanguage } from "./LanguageContext.tsx";
import { LANGUAGES, type Language } from "./language.ts";

/** Each language by its own name: Intl.DisplayNames writes Russian's in lower case. */
const NAMES: Readonly<Record<Language, string>> = { en: "English", ru: "Русский" };

export function LanguageButtons() {
  const { language, words, choose } = useLanguage();
  return (
    <fieldset className="nt-buttons">
      <legend>{words.text("language.title")}</legend>
      {LANGUAGES.map((tag) => (
        <button
          key={tag}
          type="button"
          lang={tag}
          aria-pressed={tag === language}
          onClick={() => choose(tag)}
        >
          {NAMES[tag]}
        </button>
      ))}
    </fieldset>
  );
}
