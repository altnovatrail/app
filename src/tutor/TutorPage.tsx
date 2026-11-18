// The page on the AI tutor and how to use it safely (R33; R123 spec): the learning material that
// the providers' terms ask of an organization that serves minors — Anthropic's "Educational
// resources and guidance for minors on safe and responsible use of the product", OpenAI's
// "age-appropriate disclosures to minors about AI tools and how to use them responsibly" — and app
// gives every learner. What it says is what the platform's documents say of the tutor: that it is
// an AI, that a program decides the verdict, what goes to the AI and what never does, and how a
// problem is reported. The page is `#/tutor`, at any step, opened from My subjects, a sheet of the
// mockup's legal text that closes home (R69), in the language of the learner's screens while a
// learner is chosen; nothing on it leads out of app. Where it names the operator of the app, it
// leads to the page of who runs this copy, the section Who we are of the privacy policy in force
// (R46).
import { useEffect, useId } from "react";
import { HOME, navigate, type Route, redirect, TUTOR } from "../app/router.ts";
import { SheetScreen } from "../app/SheetScreen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";

/** The sections of the page, each a heading and its paragraphs, by the keys of their words. */
const SECTIONS = [
  ["tutor.what", ["tutor.what-1", "tutor.what-2"]],
  ["tutor.wrong", ["tutor.wrong-1", "tutor.wrong-2"]],
  ["tutor.gets", ["tutor.gets-1", "tutor.gets-2", "tutor.gets-3"]],
  ["tutor.learn", ["tutor.learn-1"]],
  ["tutor.personal", ["tutor.personal-1", "tutor.personal-2"]],
  ["tutor.problem", ["tutor.problem-1", "tutor.problem-2", "report.danger"]],
] as const;

/**
 * The page itself; `onOperator` opens the page of who runs this copy, and `onClose`, where given,
 * closes the sheet.
 */
export function TutorPage({
  onOperator,
  onClose,
}: {
  readonly onOperator: () => void;
  readonly onClose?: () => void;
}) {
  const { words } = useLanguage();
  const id = useId();
  return (
    <SheetScreen title={words.text("tutor.title")} {...(onClose === undefined ? {} : { onClose })}>
      {SECTIONS.map(([heading, paragraphs]) => (
        <section key={heading} aria-labelledby={`${id}-${heading}`}>
          <h2 id={`${id}-${heading}`}>{words.text(heading)}</h2>
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{words.text(paragraph)}</p>
          ))}
          {heading === "tutor.problem" ? (
            <div className="nt-buttons">
              <button type="button" className="nt-secondary" onClick={onOperator}>
                {words.text("tutor.operator")}
              </button>
            </div>
          ) : null}
        </section>
      ))}
    </SheetScreen>
  );
}

/**
 * `#/tutor` in its sheet, which closes home; a route with parts this build does not know goes to it
 * in place.
 */
export function TutorPages({
  route,
  onOperator,
}: {
  readonly route: Route;
  /** Opens the page of who runs this copy, whose close comes back here. */
  readonly onOperator: () => void;
}) {
  const known = route.parts.length === 0;
  useEffect(() => {
    if (!known) redirect(TUTOR);
  }, [known]);
  if (!known) return null;
  return <TutorPage onOperator={onOperator} onClose={() => navigate(HOME)} />;
}
