// The adult's Help, which the profile's menu opens in its own place: three things — the tutor is an
// AI and a program checks every answer, and what to do when the AI read the work wrongly; the name
// is made up, so no real names go into the work — and the three texts of the app itself: Privacy
// Policy and Terms of Use, each a sheet over the screen whose foot leads to its page, and the page
// Accessibility. No external link and no helpline: to an adult spec gives Report a problem. A
// learner under 18, whom the build has no profile for, would need a Help of their own.

import type { Ref } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { ACCESSIBILITY, type LegalPage } from "../legal/LegalPages.tsx";

/** The pages Help leads to, in the mockup's order, each by the words of its name. */
const PAGES = [
  ["privacy-policy", "legal.privacy-policy"],
  ["terms-of-use", "legal.terms-of-use"],
  [ACCESSIBILITY, "legal.accessibility"],
] as const satisfies readonly (readonly [LegalPage, string])[];

/**
 * What Help says, its heading the one `heading` names, so that the menu can take the focus to it;
 * a page pressed goes to `onPage`, which closes the menu first.
 */
export function HelpView({
  heading,
  onPage,
}: {
  readonly heading?: Ref<HTMLHeadingElement>;
  readonly onPage: (page: LegalPage) => void;
}) {
  const { words } = useLanguage();
  return (
    <div className="nt-help">
      <h2 ref={heading} tabIndex={-1}>
        {words.text("icon.help")}
      </h2>
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
          <button key={page} type="button" className="nt-link" onClick={() => onPage(page)}>
            {words.text(key)}
          </button>
        ))}
      </div>
    </div>
  );
}
