// The bar of a lesson's segments (section 3.4 of docs/architecture.md; R23 in docs/decisions.md):
// a list of chips by place, each a target of 44 × 44 with its number and a sign — ✓ for a segment
// passed, which the theme draws and no name reads —, the one shown filled and `aria-current`; the
// list wraps onto a second line. Each chip's name is its place and its kind, which the chip shows
// from 64rem, its text the same (2.5.3), and how far it is is its description. A segment that does
// not open — a task that ended, or one not reached — is `aria-disabled`, with why as its description
// in place of how far, and a press says it in a line of the screen. The kind of the segment shown,
// its place and the count are the heading below the bar, LessonScreen.tsx's.
import { useId } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { type Course, closedWhy } from "./place.ts";
import type { Kind } from "./run.ts";

/** The words of each kind. */
export const KIND_KEYS = {
  explanation: "lesson.explanation",
  example: "lesson.example",
  task: "lesson.task",
} as const satisfies Record<Kind, string>;

export interface SegmentBarProps {
  readonly course: Course;
  /** The segment the learner has reached. */
  readonly place: number;
  /** The segment shown. */
  readonly shown: number;
  readonly onGoTo: (segment: number) => void;
  /** A segment that does not open was pressed: why, in words. */
  readonly onClosed: (why: string) => void;
}

export function SegmentBar({ course, place, shown, onGoTo, onClosed }: SegmentBarProps) {
  const { words } = useLanguage();
  const id = useId();
  return (
    <nav aria-label={words.text("lesson.segments")} className="nt-segments">
      <ol className="nt-segment-bar">
        {course.kinds.map((kind, i) => {
          const segment = i + 1;
          const passed = segment < place || course.ended.has(segment);
          const state = words.text(
            passed ? "lesson.passed" : segment === place ? "lesson.now" : "lesson.later",
          );
          const kindWord = words.text(KIND_KEYS[kind]);
          const why = closedWhy(course, place, segment);
          const describedBy = `${id}-${segment}`;
          const classes = ["nt-segment"];
          if (segment === shown) classes.push("nt-segment-shown");
          if (passed) classes.push("nt-segment-passed");
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: the segments never move, and have no ID.
            <li key={i} {...(segment === shown ? { "aria-current": "step" } : {})}>
              {/* Not disabled when it does not open: a disabled button would drop the focus. */}
              <button
                type="button"
                className={classes.join(" ")}
                // The kind's word is hidden on a narrow screen, and still the chip's name.
                aria-label={`${segment} ${kindWord}`}
                aria-describedby={describedBy}
                {...(why === undefined ? {} : { "aria-disabled": true })}
                onClick={() => {
                  if (why !== undefined) onClosed(words.text(why));
                  else if (segment !== shown) onGoTo(segment);
                }}
              >
                {segment}
                <span className="nt-segment-kind"> {kindWord}</span>
              </button>
              <span id={describedBy} hidden>
                {why === undefined ? state : words.text(why)}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
