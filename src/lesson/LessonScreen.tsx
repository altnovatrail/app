// The lesson's screen (section 3.4 of docs/architecture.md; R06, R23 in docs/decisions.md): its
// header on every segment — the lesson's title, the module's text with its own `lang`, and the bar of
// segments —, the heading of the segment shown — its kind, its place and the count —, the segment
// itself, and below it "Continue", with its icon, and the way out of the lesson. A segment that takes
// another's place takes the focus on its heading, as a screen does (2.4.3); "Continue" that comes
// after a task is told by a status line (4.1.3). What it shows it takes from its container,
// Lesson.tsx.
import { type ReactNode, useEffect, useRef } from "react";
import type { Failure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { Icon } from "../app/Icon.tsx";
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Course } from "./place.ts";
import type { Kind } from "./run.ts";
import { KIND_KEYS, SegmentBar } from "./SegmentBar.tsx";

export interface LessonScreenProps {
  /** The lesson's title, in its module's explanation language. */
  readonly title: string;
  readonly language: string | undefined;
  readonly course: Course;
  readonly place: number;
  readonly shown: number;
  /** A write of the lesson's state did not reach the device's database. */
  readonly unsaved: boolean;
  /** A line of the screen: why a segment does not open, or a task left before "lesson done". */
  readonly note?: string;
  /** What the last request of the lesson came to, when it did not answer. */
  readonly failure?: Failure;
  /** "Begin the task again", when the task's attempt was left or did not begin. */
  readonly onAgain?: () => void;
  /** "Continue", while it stands under the segment shown. */
  readonly onContinue?: () => void;
  /** "Lesson done" is under way. */
  readonly pending: boolean;
  readonly onGoTo: (segment: number) => void;
  readonly onNote: (note: string) => void;
  readonly onLeave: () => void;
  /** The segment shown. */
  readonly children?: ReactNode;
}

export function LessonScreen(props: LessonScreenProps) {
  const { course, place, shown, pending } = props;
  const { words } = useLanguage();
  const heading = useRef<HTMLHeadingElement>(null);
  const was = useRef(shown);
  useEffect(() => {
    if (was.current !== shown) heading.current?.focus();
    was.current = shown;
  }, [shown]);
  const lang = props.language === undefined ? {} : { lang: props.language };
  const kind = course.kinds[shown - 1] as Kind;
  return (
    <Screen title={props.title} heading={<span {...lang}>{props.title}</span>} wide>
      <SegmentBar
        course={course}
        place={place}
        shown={shown}
        onGoTo={props.onGoTo}
        onClosed={props.onNote}
      />
      <h2 ref={heading} tabIndex={-1} className="nt-segment-heading">
        {words.text("lesson.where", {
          kind: words.text(KIND_KEYS[kind]),
          n: shown,
          total: course.kinds.length,
        })}
      </h2>
      <p role="status" className="nt-error">
        {props.unsaved ? words.text("task.not-saved") : ""}
      </p>
      <p role="status" className="nt-hint">
        {props.note ?? ""}
      </p>
      <div className="nt-segment-body">{props.children}</div>
      <div className="nt-lesson-buttons">
        {props.failure === undefined ? null : (
          <p role="alert" className="nt-error">
            {failureText(props.failure, words)}
          </p>
        )}
        <div className="nt-buttons" role="status">
          {props.onAgain === undefined ? null : (
            <button type="button" onClick={props.onAgain}>
              {words.text("lesson.task-again")}
            </button>
          )}
          {props.onContinue === undefined ? null : (
            // Not disabled while "lesson done" is under way: a disabled button would drop the focus.
            <button
              type="button"
              className="nt-icon-button"
              aria-disabled={pending}
              onClick={() => {
                if (!pending) props.onContinue?.();
              }}
            >
              <Icon value="continue" />
              {words.text("lesson.continue")}
            </button>
          )}
        </div>
        <div className="nt-buttons">
          <button type="button" className="nt-secondary" onClick={props.onLeave}>
            {words.text("lesson.leave")}
          </button>
        </div>
      </div>
    </Screen>
  );
}
