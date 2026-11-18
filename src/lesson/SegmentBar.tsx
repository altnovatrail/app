// The segments of a lesson (section 3.4 of docs/architecture.md; R23 and R64 in
// docs/decisions.md): a pop-over behind the line under the lesson's title in the top bar, as the
// mockup's `lesson-segments` — the lesson's title and its module, the list of segments by place, and
// "Leave the lesson". Each row is a button with its number — a tick in its place for a segment
// passed —, its kind, and how far it is, or why it does not open, its words its name (2.5.3); the
// one shown is `aria-current`. A segment that does not open — a task that ended, or one not reached —
// is `aria-disabled`, and a press says it in a line of the screen with the row's name: under the
// heading of the segment shown, a bare "Not open yet" would read as said of that one.
import { BELOW_BAR } from "../app/hang.ts";
import { Icon } from "../app/Icon.tsx";
import { PopOver } from "../app/PopOver.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { type Course, closedWhy } from "./place.ts";
import type { Kind } from "./run.ts";

/** The words of each kind. */
export const KIND_KEYS = {
  explanation: "lesson.explanation",
  example: "lesson.example",
  task: "lesson.task",
} as const satisfies Record<Kind, string>;

/** The line of the screen when a row that does not open is pressed, by why. */
const PRESSED = {
  "lesson.not-open": "lesson.not-open-pressed",
  "lesson.task-over": "lesson.task-over-pressed",
} as const satisfies Record<NonNullable<ReturnType<typeof closedWhy>>, string>;

export interface SegmentBarProps {
  readonly course: Course;
  /** The segment the learner has reached. */
  readonly place: number;
  /** The segment shown. */
  readonly shown: number;
  /** Where the segment shown is, "Worked example · 2 of 4", as its heading says it. */
  readonly where: string;
  /** The lesson's title, in its module's explanation language, and that language. */
  readonly title: string;
  readonly language: string | undefined;
  /** The module's title, under the lesson's, if the manifest gave it. */
  readonly module?: string | undefined;
  readonly onGoTo: (segment: number) => void;
  /** A segment that does not open was pressed: why, in words. */
  readonly onClosed: (why: string) => void;
  readonly onLeave: () => void;
}

/** The line under the lesson's title — the segment shown, its place and the count — and its pop-over. */
export function SegmentBar(props: SegmentBarProps) {
  const { where } = props;
  const { words } = useLanguage();
  return (
    <PopOver
      label={words.text("lesson.segments")}
      buttonLabel={words.text("lesson.segments-open", { where })}
      caption={
        <>
          {where}
          <Icon value="menu-open" />
        </>
      }
      className="nt-segments-open"
      anchor=".nt-top-pill"
      gap={BELOW_BAR}
      popClassName="nt-pop-segments"
    >
      {(close) => <Segments {...props} close={close} />}
    </PopOver>
  );
}

function Segments({
  course,
  place,
  shown,
  title,
  language,
  module,
  onGoTo,
  onClosed,
  onLeave,
  close,
}: SegmentBarProps & { readonly close: () => void }) {
  const { words } = useLanguage();
  return (
    <>
      <p className="nt-segments-head">
        <span className="nt-segments-title" {...(language === undefined ? {} : { lang: language })}>
          {title}
        </span>
        {module === undefined ? null : (
          <span
            className="nt-segments-module"
            {...(language === undefined ? {} : { lang: language })}
          >
            {module}
          </span>
        )}
      </p>
      <nav>
        <ol className="nt-segment-list">
          {course.kinds.map((kind, i) => {
            const segment = i + 1;
            const passed = segment < place || course.ended.has(segment);
            const state = words.text(
              passed ? "lesson.passed" : segment === place ? "lesson.now" : "lesson.later",
            );
            const kindWord = words.text(KIND_KEYS[kind]);
            const why = closedWhy(course, place, segment);
            const ticked = passed && segment !== shown;
            const classes = ["nt-segment"];
            if (segment === shown) classes.push("nt-segment-shown");
            else if (passed) classes.push("nt-segment-passed");
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: the segments never move, and have no ID.
              <li key={i} {...(segment === shown ? { "aria-current": "step" } : {})}>
                {/* Not disabled when it does not open: a disabled button would drop the focus. */}
                <button
                  type="button"
                  className={classes.join(" ")}
                  {...(why === undefined ? {} : { "aria-disabled": true })}
                  onClick={() => {
                    close();
                    if (why !== undefined) {
                      onClosed(words.text(PRESSED[why], { n: segment, kind: kindWord }));
                    } else if (segment !== shown) onGoTo(segment);
                  }}
                >
                  {/* Its name is its words: the place — out of sight beside a tick —, the kind, how far. */}
                  <span className="nt-segment-number">
                    {ticked ? <Icon value="ticked" /> : null}
                    <span className={ticked ? "nt-segment-place" : undefined}>{segment}</span>
                  </span>{" "}
                  <span className="nt-segment-words">
                    <span className="nt-segment-kind">{kindWord}</span>{" "}
                    <span className="nt-segment-state">
                      {why === undefined ? state : words.text(why)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <button type="button" className="nt-menu-row nt-segments-leave" onClick={onLeave}>
        {words.text("lesson.leave")}
      </button>
    </>
  );
}
