// The lesson's screen (R06, R23 and R64), as the mockup's `lesson`: the whole window, the top bar's
// glass pill at the top — Back, which leaves the lesson, the lesson's title, the module's text with
// its own `lang`, and under it the line of the segment shown, which opens the segments in a
// pop-over —, the profile's pill at the bar's other end (R63) — a task's pill of its mode after it
// (R65) —, the segment itself, and at the bottom the row of glass with "Continue" — a worked
// example's in the canvas's own row. An explanation is a card that scrolls inside, its heading its
// caption; a worked example and a task fill the rest of the window, their heading out of sight, the
// bar's line showing the same. A segment that takes another's place takes the focus on its heading,
// as a screen does (2.4.3); "Continue" that comes after a task is told by a status line (4.1.3).
// What it shows it takes from its container, Lesson.tsx.
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import type { Failure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { Icon } from "../app/Icon.tsx";
import { IconButton } from "../app/IconButton.tsx";
import { LearnerMenu } from "../app/LearnerMenu.tsx";
import { Screen } from "../app/Screen.tsx";
import { TopEndProvider } from "../app/TopEnd.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Course } from "./place.ts";
import type { Kind } from "./run.ts";
import { KIND_KEYS, SegmentBar } from "./SegmentBar.tsx";

export interface LessonScreenProps {
  /** The lesson's title, in its module's explanation language. */
  readonly title: string;
  readonly language: string | undefined;
  /** The module's title, which the segments' pop-over names under the lesson's. */
  readonly module?: string | undefined;
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
  /** "Continue", while it stands in the row under the segment shown. */
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
  const headingId = useId();
  const was = useRef(shown);
  useEffect(() => {
    if (was.current !== shown) heading.current?.focus();
    was.current = shown;
  }, [shown]);
  const lang = props.language === undefined ? {} : { lang: props.language };
  const kind = course.kinds[shown - 1] as Kind;
  const where = words.text("lesson.where", {
    kind: words.text(KIND_KEYS[kind]),
    n: shown,
    total: course.kinds.length,
  });
  const buttons = props.onAgain !== undefined || props.onContinue !== undefined;
  // The end of the bar, where a task segment puts the pill of its mode (R65).
  const [end, setEnd] = useState<HTMLElement | null>(null);
  return (
    <Screen
      title={props.title}
      heading={
        <span className="nt-top-title" {...lang}>
          {props.title}
        </span>
      }
      layout="lesson"
      bar={{
        back: <IconButton value="back" caption="lesson.leave" onClick={props.onLeave} />,
        under: (
          <SegmentBar
            course={course}
            place={place}
            shown={shown}
            where={where}
            title={props.title}
            language={props.language}
            module={props.module}
            onGoTo={props.onGoTo}
            onClosed={props.onNote}
            onLeave={props.onLeave}
          />
        ),
        end: (
          <div className="nt-top-end">
            <LearnerMenu />
            <div ref={setEnd} className="nt-top-slot" />
          </div>
        ),
      }}
    >
      <div className="nt-lesson-lines">
        <p role="status" className="nt-error">
          {props.unsaved ? words.text("task.not-saved") : ""}
        </p>
        <p role="status" className="nt-hint">
          {props.note ?? ""}
        </p>
      </div>
      <section className="nt-segment-body" data-kind={kind} aria-labelledby={headingId}>
        <h2 ref={heading} id={headingId} tabIndex={-1} className="nt-segment-heading">
          {where}
        </h2>
        <TopEndProvider place={end}>{props.children}</TopEndProvider>
      </section>
      {props.failure === undefined ? null : (
        <p role="alert" className="nt-error nt-lesson-failure">
          {failureText(props.failure, words)}
        </p>
      )}
      <div role="status" className="nt-lesson-foot">
        {buttons ? (
          <div className="nt-lesson-row nt-glass">
            {props.onAgain === undefined ? null : (
              <button type="button" className="nt-secondary" onClick={props.onAgain}>
                {words.text("lesson.task-again")}
              </button>
            )}
            {props.onContinue === undefined ? null : (
              <ContinueButton pending={pending} onContinue={props.onContinue} />
            )}
          </div>
        ) : null}
      </div>
    </Screen>
  );
}

/**
 * "Continue", its icon after its word, as the mockup's: in the row under the segment shown, or, on
 * a worked example, a child of the canvas in its slot `actions`, after its Next and Demo
 * (R84 canvas; R36 spec). Not disabled while "lesson done" is under way: a disabled button would
 * drop the focus.
 */
export function ContinueButton({
  pending,
  onContinue,
  slot,
}: {
  readonly pending: boolean;
  readonly onContinue: () => void;
  readonly slot?: "actions";
}) {
  const { words } = useLanguage();
  return (
    <button
      type="button"
      className="nt-icon-button nt-continue"
      {...(slot === undefined ? {} : { slot })}
      aria-disabled={pending}
      onClick={() => {
        if (!pending) onContinue();
      }}
    >
      {words.text("lesson.continue")}
      <Icon value="continue" />
    </button>
  );
}
