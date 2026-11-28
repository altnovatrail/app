// The lesson's screen, as the mockup's `lesson`: the whole window, the top bar's
// glass pill at the top — Back, which leaves the lesson, the lesson's title, the module's text with
// its own `lang`, and under it the line of the segment shown, which opens the segments in a
// pop-over —, the profile's pill at the bar's other end, the segment itself, and at the bottom the
// row of glass with "Continue" — a worked example's in the canvas's own row. An explanation is a
// card that scrolls inside, its heading its caption; a worked example fills the rest of the window,
// its heading out of sight, the bar's line showing the same. A segment that takes another's place
// takes the focus on its heading, as a screen does (2.4.3); "Continue" that comes is told by a
// status line (4.1.3).
// What it shows it takes from its container, Lesson.tsx.
import { type ReactNode, useEffect, useId, useRef } from "react";
import type { Failure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { Icon } from "../app/Icon.tsx";
import { IconButton } from "../app/IconButton.tsx";
import { LearnerMenu } from "../app/LearnerMenu.tsx";
import { Screen } from "../app/Screen.tsx";
import { Loading, Sk } from "../app/Skeleton.tsx";
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
        {props.children}
      </section>
      {props.failure === undefined ? null : (
        <p role="alert" className="nt-error nt-lesson-failure">
          {failureText(props.failure, words)}
        </p>
      )}
      <div role="status" className="nt-lesson-foot">
        {props.onContinue === undefined ? null : (
          <div className="nt-lesson-row nt-glass">
            <ContinueButton pending={pending} onContinue={props.onContinue} />
          </div>
        )}
      </div>
    </Screen>
  );
}

/**
 * The lesson while its run is read: the bar as it will stand, the shapes of the title
 * and of the segment's line in its pill, and of an explanation in its card.
 */
export function LessonLoading({ onLeave }: { readonly onLeave: () => void }) {
  const { words } = useLanguage();
  return (
    <Screen
      title={words.text("lesson.title")}
      heading={<Sk width="10rem" height="0.875rem" radius="0.3125rem" />}
      layout="lesson"
      bar={{
        back: <IconButton value="back" caption="lesson.leave" onClick={onLeave} />,
        under: <Sk width="6.5rem" height="0.75rem" radius="0.25rem" />,
        end: (
          <div className="nt-top-end">
            <LearnerMenu />
          </div>
        ),
      }}
    >
      <div className="nt-segment-body" data-kind="explanation">
        <Loading>
          <Sk width="55%" height="1.75rem" radius="0.5rem" />
          {["100%", "96%", "99%", "88%", "62%"].map((width) => (
            <Sk key={width} width={width} height="0.9375rem" radius="0.3125rem" />
          ))}
        </Loading>
      </div>
    </Screen>
  );
}

/**
 * "Continue", its icon after its word, as the mockup's: in the row under the segment shown, or, on
 * a worked example, a child of the canvas in its slot `actions`, after its Next and Demo.
 * Not disabled while "lesson done" is under way: a disabled button would
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
