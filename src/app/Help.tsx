// The adult's Help: behind its place at the end of the row of places, a
// pop-over that says three things — the tutor is an AI and a program checks every answer, and what
// to do when the AI read the work wrongly; the name is made up, so no real names go into the work —
// and leads to three texts of the app itself: Privacy Policy and Terms of Use, each a sheet over the
// screen whose foot leads to its page, and the page Accessibility. No
// external link and no helpline: to an adult spec gives Report a problem. A learner under 18,
// whom the build has no profile for, would need a Help of their own.

import { useState } from "react";
import { useLearner } from "../account/AccountGate.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { ACCESSIBILITY, type LegalPage, legalPage } from "../legal/LegalPages.tsx";
import { ReadLegalSheet } from "../legal/LegalSheet.tsx";
import { isPageText, type PageText } from "../legal/texts.ts";
import { captionHidden, NavCaption } from "./NavCaption.tsx";
import { PopOver } from "./PopOver.tsx";

/** The pages Help leads to, in the mockup's order, each by the words of its name. */
const PAGES = [
  ["privacy-policy", "legal.privacy-policy"],
  ["terms-of-use", "legal.terms-of-use"],
  [ACCESSIBILITY, "legal.accessibility"],
] as const satisfies readonly (readonly [LegalPage, string])[];

/** Help, for a learner of the category adult; none for another, nor with no learner. */
export function AdultHelp() {
  const chosen = useLearner();
  const { words } = useLanguage();
  // The text whose sheet stands over the screen, once the pop-over has closed.
  const [sheet, setSheet] = useState<PageText | undefined>(undefined);
  if (chosen?.learner.ageCategory !== "adult") return null;
  const title = words.text("icon.help");
  return (
    <>
      <PopOver
        label={title}
        className="nt-nav-item"
        popClassName="nt-pop-help"
        caption={<NavCaption icon="help" text={title} />}
        tip={{ words: title, needed: captionHidden }}
      >
        {(close) => (
          <>
            <h2>{title}</h2>
            <p className="nt-help-item">
              <b>{words.text("help.ai")}</b>
              <span>{words.text("help.ai-text")}</span>
            </p>
            <p className="nt-help-item">
              <b>{words.text("help.name")}</b>
              <span>{words.text("help.name-text")}</span>
            </p>
            <div className="nt-help-pages">
              {PAGES.map(([page, key]) => (
                <button
                  key={page}
                  type="button"
                  className="nt-link"
                  onClick={() => {
                    close();
                    if (isPageText(page)) setSheet(page);
                    else chosen.openLegal(legalPage(page));
                  }}
                >
                  {words.text(key)}
                </button>
              ))}
            </div>
          </>
        )}
      </PopOver>
      {sheet === undefined ? null : (
        <ReadLegalSheet id={sheet} onClose={() => setSheet(undefined)} onPage={chosen.openLegal} />
      )}
    </>
  );
}
