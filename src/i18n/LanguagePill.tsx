// The sign-in's language (R17): a pill of glass that shows the device's language by its own name and
// opens, in a pop-over under its name, a button for each language, the chosen one pressed, tinted
// and ticked. A press
// changes the screen at once and closes the pop-over: the choice is a button's, not a list's that
// would change the screen by itself (WCAG 3.2.2).
import { Icon } from "../app/Icon.tsx";
import { PopOver } from "../app/PopOver.tsx";
import { NAMES } from "./LanguageButtons.tsx";
import { useLanguage } from "./LanguageContext.tsx";
import { LANGUAGES } from "./language.ts";

export function LanguagePill() {
  const { language, words, choose } = useLanguage();
  const title = words.text("language.title");
  return (
    <PopOver
      label={title}
      buttonLabel={`${title}: ${NAMES[language]}`}
      className="nt-lang-pill"
      caption={
        <>
          <Icon value="language" />
          <span lang={language}>{NAMES[language]}</span>
          <Icon value="menu-open" />
        </>
      }
    >
      {(close) => (
        <>
          <p className="nt-lang-caption" aria-hidden="true">
            {title}
          </p>
          <ul className="nt-choice-list nt-lang-list">
            {LANGUAGES.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  lang={tag}
                  aria-pressed={tag === language}
                  onClick={() => {
                    choose(tag);
                    close();
                  }}
                >
                  {NAMES[tag]}
                  {tag === language ? <Icon value="ticked" /> : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </PopOver>
  );
}
