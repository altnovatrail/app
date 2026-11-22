// A screen of app (R11): its heading, which is also the title of the document in the screen's
// language (WCAG 2.4.2), and the focus on that heading when one screen takes another's place
// (2.4.3) — not on the first screen of the page, and not while the same screen stays. `<main lang>`
// is the screen's language (3.1.1). A heading that is a module's text — a lesson's title — comes as
// a node of its own, with its `lang`, and the title stays its words. A screen with a top bar has
// its heading in the bar's glass pill, beside its way back, as the mockup's top bar has its title,
// named by the title, whose words the pill shows on two lines (R63). A screen drawn as the mockup's
// legal text has its heading in the sheet's head instead, between its way back and its close (R69).
// A screen in the frame of the side menu may have a way back above its heading and what stands
// beside it, as a module's skill map its way back to Subjects and the module chosen (R79).
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
export type ScreenLayout =
  | "column"
  | "reference"
  | "canvas"
  | "welcome"
  | "profiles"
  | "who"
  | "map"
  | "lesson"
  | "task"
  | "end"
  | "adults"
  | "sheet"
  | "failure";

const LAYOUT_CLASS: Readonly<Record<ScreenLayout, string | undefined>> = {
  column: undefined,
  reference: "nt-reference",
  canvas: "nt-canvas",
  welcome: "nt-welcome",
  profiles: "nt-profiles nt-who nt-own",
  who: "nt-profiles nt-who",
  map: "nt-map",
  lesson: "nt-lesson",
  task: "nt-task-screen",
  end: "nt-end",
  adults: "nt-adults",
  sheet: "nt-sheet",
  failure: "nt-failure",
};

/** The layouts whose column is a card on the page's colour: the screen is framed by it. */
const CARDS: ReadonlySet<ScreenLayout> = new Set(["sheet", "failure"]);

/** The top bar of a screen: its way back, and what stands at its other end. */
export interface TopBar {
  /** The way back, before the heading in the bar's pill: `IconButton` "back". */
  readonly back: ReactNode;
  /** What stands at the bar's other end: the profile's pill, and a task's pill of its mode (R65). */
  readonly end?: ReactNode;
  /** What stands under the heading in the pill: a lesson's segments, behind its line (R64). */
  readonly under?: ReactNode;
  /** What stands in the bar's middle, between the pill and its end: the page's finding (R71). */
  readonly middle?: ReactNode;
}

/** The head of a sheet, the mockup's legal text (R69): its way back, its close, and a chip. */
export interface SheetHead {
  /** The way back, before the heading: `IconButton` "back". */
  readonly back?: ReactNode;
  /** The close at the head's other end: `IconButton` "close". */
  readonly close?: ReactNode;
  /** What stands under the heading: a text's version as a chip. */
  readonly under?: ReactNode;
}

export interface ScreenProps {
  readonly title: string;
  readonly children?: ReactNode;
  /**
   * How wide the screen is from 600 CSS px (R59): `column` a column of reading, `reference` the
   * mockup's frame — the home screen and the sign-in, 1194 px at most —, and `canvas` the whole
   * window, as a screen with a canvas; `welcome` the sign-in's frame, its art beside the column,
   * and `profiles` the owner's profile, a card in the middle of the sign-in's sky, and `who` the
   * frame of "Who is learning?" on the same sky (R61), and `map` the whole window, a frame below the
   * top bar (R63); `lesson` the whole window, a lesson's segment between its top bar and its row,
   * and `end` a card in the window's middle,
   * the end of a lesson (R64); `task` the whole window, the canvas between the top bar and the row
   * of glass (R65); `adults` a column of reading under the top bar, a page of the section for
   * adults (R68); `sheet` a card of 35rem, its top where the mockup's legal text has it, and the
   * whole screen below 600, and `failure` a card of 28.75rem in the window's middle (R69). Below
   * 600 each is one column.
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
  /** The head of a sheet, which then holds the heading. */
  readonly head?: SheetHead;
  /** What stands above the heading, unframed: a way back. */
  readonly above?: ReactNode;
  /** What stands beside the heading, in its line: the module of a map. */
  readonly beside?: ReactNode;
  /** The heading for assistive technology alone, where the frame shows the place: Home. */
  readonly unseen?: boolean;
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
  head,
  above,
  beside,
  unseen = false,
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
    <h1
      ref={heading}
      tabIndex={-1}
      aria-label={bar === undefined ? undefined : title}
      className={unseen ? "nt-hidden-label" : undefined}
    >
      {shown ?? title}
    </h1>
  );
  const top =
    head === undefined ? (
      above === undefined && beside === undefined ? (
        h1
      ) : (
        <div className="nt-screen-head">
          {above}
          <div className="nt-screen-title">
            {h1}
            {beside}
          </div>
        </div>
      )
    ) : (
      <div className="nt-sheet-head">
        {head.back}
        <div className="nt-sheet-title">
          {h1}
          {head.under}
        </div>
        {head.close}
      </div>
    );
  const content = (
    <>
      {bar === undefined ? (
        top
      ) : (
        <div className="nt-top" data-middle={bar.middle === undefined ? undefined : ""}>
          <div className="nt-top-pill nt-glass">
            {bar.back}
            {bar.under === undefined ? (
              h1
            ) : (
              <div className="nt-top-heading">
                {h1}
                {bar.under}
              </div>
            )}
          </div>
          {bar.middle}
          {bar.end}
        </div>
      )}
      {children}
    </>
  );
  const framed =
    before !== undefined || lead !== undefined || after !== undefined || CARDS.has(layout);
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
