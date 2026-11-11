// A screen of app (section 3.9 of docs/architecture.md): its heading, which is also the title of the
// document in the screen's language (WCAG 2.4.2), and the focus on that heading when one screen
// takes another's place (2.4.3) — not on the first screen of the page, and not while the same screen
// stays. `<main lang>` is the screen's language (3.1.1). A heading that is a module's text — a
// lesson's title — comes as a node of its own, with its `lang`, and the title stays its words.
import { type ReactNode, useEffect, useRef } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";

/** The name of the app, which a screen of that heading does not repeat in the title. */
export const APP_NAME = "NovaTrail";

/**
 * The screen the page shows last, by its own token: one mounted again by StrictMode is the same
 * screen and takes no focus, and the first of the page finds none before it.
 */
let current: symbol | undefined;

export interface ScreenProps {
  readonly title: string;
  readonly children?: ReactNode;
  /** A screen of the full width, as the task screen with its canvas beside the panel. */
  readonly wide?: boolean;
  /** The heading in place of the title's plain text: a module's text with its own `lang`. */
  readonly heading?: ReactNode;
}

export function Screen({ title, children, wide = false, heading: shown }: ScreenProps) {
  const { language, words } = useLanguage();
  const heading = useRef<HTMLHeadingElement>(null);
  const token = useRef(Symbol("screen"));

  useEffect(() => {
    document.title =
      title === APP_NAME ? title : words.text("app.document-title", { screen: title });
  }, [title, words]);

  useEffect(() => {
    if (current !== undefined && current !== token.current) heading.current?.focus();
    current = token.current;
  }, []);

  return (
    <main lang={language} className={wide ? "nt-wide" : undefined}>
      <h1 ref={heading} tabIndex={-1}>
        {shown ?? title}
      </h1>
      {children}
    </main>
  );
}
