// A screen of app (section 3.9 of docs/architecture.md): its heading, which is also the title of the
// document in the screen's language (WCAG 2.4.2), and the focus on that heading when one screen
// takes another's place (2.4.3) — not on the first screen of the page, and not while the same screen
// stays. `<main lang>` is the screen's language (3.1.1). A heading that is a module's text — a
// lesson's title — comes as a node of its own, with its `lang`, and the title stays its words. A
// screen with a top bar has its heading in the bar's glass pill, beside its way back, as the
// mockup's top bar has its title, named by the title, whose words the pill shows on two lines (R63).
import { type ReactNode, useEffect, useRef } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";

/** The name of the app, which a screen of that heading does not repeat in the title. */
export const APP_NAME = "NovaTrail";

/**
 * The screen the page shows last, by its own token: one mounted again by StrictMode is the same
 * screen and takes no focus, and the first of the page finds none before it.
 */
let current: symbol | undefined;

/** The width of a screen in the tablet's layout. */
export type ScreenLayout = "column" | "reference" | "canvas" | "welcome" | "profiles" | "map";

const LAYOUT_CLASS: Readonly<Record<ScreenLayout, string | undefined>> = {
  column: undefined,
  reference: "nt-reference",
  canvas: "nt-canvas",
  welcome: "nt-welcome",
  profiles: "nt-profiles",
  map: "nt-map",
};

/** The top bar of a screen: its way back, and what stands at its other end. */
export interface TopBar {
  /** The way back, before the heading in the bar's pill: `IconButton` "back". */
  readonly back: ReactNode;
  /** What stands at the bar's other end: the profile's pill. */
  readonly end?: ReactNode;
}

export interface ScreenProps {
  readonly title: string;
  readonly children?: ReactNode;
  /**
   * How wide the screen is from 600 CSS px (section 3.9 of docs/architecture.md): `column` a column
   * of reading, `reference` the mockup's frame — the home screen and the sign-in, 1194 px at most —,
   * and `canvas` the whole window, as a screen with a canvas; `welcome` the sign-in's frame, its
   * art beside the column, and `profiles` the frame of the owner's profile and "Who is learning?",
   * a column in the middle (R61), and `map` the whole window, a frame below the top bar (R63).
   * Below 600 each is one column.
   */
  readonly layout?: ScreenLayout;
  /** What stands in the frame before the heading's column: the sign-in's art, the app's name. */
  readonly before?: ReactNode;
  /** What stands in the column above the heading, drawn: the sign-in's mark. */
  readonly lead?: ReactNode;
  /** What stands in the frame after the column: the way to the legal pages, at the frame's foot. */
  readonly after?: ReactNode;
  /** The heading in place of the title's plain text: a module's text with its own `lang`. */
  readonly heading?: ReactNode;
  /** The top bar, which then holds the heading. */
  readonly bar?: TopBar;
}

export function Screen({
  title,
  children,
  layout = "column",
  heading: shown,
  before,
  lead,
  after,
  bar,
}: ScreenProps) {
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

  const h1 = (
    <h1 ref={heading} tabIndex={-1} aria-label={bar === undefined ? undefined : title}>
      {shown ?? title}
    </h1>
  );
  const content = (
    <>
      {bar === undefined ? (
        h1
      ) : (
        <div className="nt-top">
          <div className="nt-top-pill nt-glass">
            {bar.back}
            {h1}
          </div>
          {bar.end}
        </div>
      )}
      {children}
    </>
  );
  const framed = before !== undefined || lead !== undefined || after !== undefined;
  return (
    <main lang={language} className={LAYOUT_CLASS[layout]}>
      {framed ? (
        <>
          {before}
          <div className="nt-column">
            {lead}
            {content}
          </div>
          {after}
        </>
      ) : (
        content
      )}
    </main>
  );
}
