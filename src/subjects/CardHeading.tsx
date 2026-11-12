// What a module's card says of it (sections 3.8 and 3.10 of docs/architecture.md; R92 in spec):
// its title as the card's heading, in its own explanation language; a line that names that
// language when it is not the screen's; and whether the module is available — a module with no
// current version for the learner is not. My subjects names its modules so, and the section for
// adults its profile's modules (R32 in docs/decisions.md).
import { languageName } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Language } from "../i18n/language.ts";
import type { ModuleCard } from "./modules.ts";

/** Whether a language tag is the screen's language, by its primary subtag. */
function isScreenLanguage(tag: string, language: Language): boolean {
  return tag.split("-")[0]?.toLowerCase() === language;
}

/** A language's name in the screen's language; a tag Intl cannot read stands for itself. */
function nameOf(tag: string, language: Language): string {
  try {
    return languageName(language, tag);
  } catch {
    return tag;
  }
}

/** The heading of a card, by the ID the card is labelled by, and the lines below it. */
export function CardHeading({ card, id }: { readonly card: ModuleCard; readonly id: string }) {
  const { language, words } = useLanguage();
  const explanation = card.language;
  return (
    <>
      <h3 id={id} {...(explanation === undefined ? {} : { lang: explanation })}>
        {card.title}
      </h3>
      {explanation === undefined || isScreenLanguage(explanation, language) ? null : (
        <p>
          {words.text("subjects.explanation-language", {
            language: nameOf(explanation, language),
          })}
        </p>
      )}
      {card.digest === undefined ? <p>{words.text("subjects.unavailable")}</p> : null}
    </>
  );
}
