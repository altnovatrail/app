// The screen of an essay, laid out as the task screen is (section 3.3 of docs/architecture.md; R20,
// R53 in docs/decisions.md): the canvas with what was read under it, the tutor's panel beside it from
// 64rem and above it on a narrower screen, and the row of glass below them — Hint, Done and Check
// (R65). An essay has no verdict
// (R75, R87 in spec): the panel's block "Tutor" holds the feedback of the last submission, or why
// it gave none — no feedback this time, an essay that cannot be read, no check —, with "Report a
// problem" for a learner of the category adult (R33). Above the row stands the reminder to write no
// names, before each submission (R127 in spec); Done opens once the essay was sent; there is no
// "Show the solution". Done gives way to the result: "Essay finished", the last feedback, the
// criteria of the rubric and the solution if the task has one, the way to what the engine chose,
// "Try it again" and the way back. What it shows it takes from its container, Essay.tsx.
import type * as open from "@altnovatrail/spec/formatv0/open";
import { useId } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { Solution } from "./Solution.tsx";
import { HintButton, ResultEnd, RowLine, TaskLayout, type TaskParts } from "./TaskLayout.tsx";
import { TutorWords } from "./TutorWords.tsx";

/** The essay finished by Done: the rubric's criteria and the solution, as `SolvedTask` gives them. */
export interface Finished {
  readonly criteria: readonly string[];
  readonly solution: readonly open.StatementPart[];
}

export interface EssayScreenProps extends TaskParts {
  /** A check is under way: the tutor is reading the essay. */
  readonly checking: boolean;
  /** The text read at the last submission, as it is written; none when it was not read. */
  readonly text?: string;
  /** The words of the last feedback; none when none came. */
  readonly feedback?: string;
  /** Why the last submission gave no words of feedback, in words. */
  readonly note?: string;
  /** The feedback came at the last check: a screen reader is told. */
  readonly came: boolean;
  /** Done is open: the essay was sent at least once (R87 in spec). */
  readonly mayFinish: boolean;
  /** The essay was finished by Done; none while it is not. */
  readonly finished?: Finished;
  readonly onCheck: () => void;
  readonly onFinish: () => void;
}

export function EssayScreen(props: EssayScreenProps) {
  const { manifest, filled, finished, pending } = props;
  const { words } = useLanguage();
  const namesId = useId();
  const lockedId = useId();
  const doneId = useId();
  const criteriaId = useId();
  const explanation = manifest?.languages.explanation;
  const lang = explanation === undefined ? {} : { lang: explanation };
  const ended = finished !== undefined;
  // The sheet holds something: Check opens (`answer_slots_filled`; section 3.3).
  const written = !ended && filled?.[0]?.[0] === true;
  const feedback = (
    <TutorWords
      words={props.feedback}
      language={explanation}
      {...(props.note === undefined ? {} : { failure: props.note })}
      waiting={props.checking}
      report={props.report}
    />
  );

  return (
    <TaskLayout
      parts={props}
      over={ended}
      underCanvas={
        props.text === undefined ? null : (
          <section className="nt-essay-text">
            <h2>{words.text("essays.text")}</h2>
            <p {...lang}>{props.text}</p>
          </section>
        )
      }
      panel={
        props.hint !== undefined ||
        props.feedback !== undefined ||
        props.note !== undefined ||
        props.checking
      }
      tutor={feedback}
      result={
        <>
          <p className="nt-result">{words.text("task.essay-done")}</p>
          {feedback}
          {finished === undefined || finished.criteria.length === 0 ? null : (
            <section aria-labelledby={criteriaId}>
              <h2 id={criteriaId}>{words.text("task.criteria")}</h2>
              <ul {...lang}>
                {finished.criteria.map((criterion) => (
                  <li key={criterion}>{criterion}</li>
                ))}
              </ul>
            </section>
          )}
          <Solution parts={finished?.solution ?? []} language={explanation} media={props.media} />
          <ResultEnd parts={props} />
        </>
      }
      lines={
        <>
          {ended ? null : (
            <>
              {/* Before each submission, as the description of Check too (R127 in spec). */}
              <p id={namesId} className="nt-hint">
                {words.text("task.no-names")}
              </p>
              {written ? null : (
                <p id={lockedId} className="nt-hint">
                  {words.text("task.check-write")}
                </p>
              )}
              {props.mayFinish ? null : (
                <p id={doneId} className="nt-hint">
                  {words.text("task.done-locked")}
                </p>
              )}
            </>
          )}
          <p role="status" className="nt-hidden-label">
            {props.came ? words.text("task.feedback-came") : ""}
          </p>
        </>
      }
      row={
        ended ? null : (
          <>
            <HintButton parts={props} />
            <button
              type="button"
              className="nt-row-button"
              aria-disabled={!props.mayFinish || pending}
              {...(props.mayFinish ? {} : { "aria-describedby": doneId })}
              onClick={() => {
                if (props.mayFinish && !pending) props.onFinish();
              }}
            >
              {words.text("task.done")}
            </button>
            <RowLine />
            {/* Not disabled while it is locked: a disabled button would drop the focus. */}
            <button
              type="button"
              className={props.blink && written ? "nt-check-button nt-blink" : "nt-check-button"}
              aria-disabled={!written || pending}
              aria-describedby={written ? namesId : `${namesId} ${lockedId}`}
              onClick={() => {
                if (written && !pending) props.onCheck();
              }}
            >
              {words.text("task.check")}
            </button>
          </>
        )
      }
    />
  );
}
