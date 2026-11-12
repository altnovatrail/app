// The page on the AI tutor and how to use it safely (R33 in docs/decisions.md; R123 in spec;
// section 3.10 of docs/architecture.md): the learning material that the providers' terms ask of an
// organization that serves minors — Anthropic's "Educational resources and guidance for minors on
// safe and responsible use of the product", OpenAI's "age-appropriate disclosures to minors about
// AI tools and how to use them responsibly" (privacy 5.3 in spec) — and app gives every learner.
// What it says is what the platform's documents say of the tutor: that it is an AI, that a program
// decides the verdict, what goes to the AI and what never does, and how a problem is reported. The
// page is `#/tutor`, at any step, opened from My subjects below a bar that closes it home, in the
// language of the learner's screens while a learner is chosen; nothing on it leads out of app
// (privacy 7 in spec).
import { useEffect, useId } from "react";
import { PageBar } from "../app/PageBar.tsx";
import { HOME, type Route, redirect, TUTOR } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
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

/** The page itself, below its bar. */
export function TutorPage() {
  const { words } = useLanguage();
  const id = useId();
  return (
    <Screen title={words.text("tutor.title")}>
      {SECTIONS.map(([heading, paragraphs]) => (
        <section key={heading} aria-labelledby={`${id}-${heading}`}>
          <h2 id={`${id}-${heading}`}>{words.text(heading)}</h2>
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{words.text(paragraph)}</p>
          ))}
        </section>
      ))}
    </Screen>
  );
}

/** `#/tutor` with its bar; a route with parts this build does not know goes to it in place. */
export function TutorPages({ route }: { readonly route: Route }) {
  const { words } = useLanguage();
  const known = route.parts.length === 0;
  useEffect(() => {
    if (!known) redirect(TUTOR);
  }, [known]);
  if (!known) return null;
  return (
    <>
      <PageBar
        title={words.text("tutor.bar")}
        close={{ text: words.text("tutor.close"), to: HOME }}
      />
      <TutorPage />
    </>
  );
}
