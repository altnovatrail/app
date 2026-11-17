// The task screen as the author laid it out (section 3.3 of docs/architecture.md; R20, R21 in
// docs/decisions.md): the canvas and below it the items with their options and what was read, the
// tutor's panel beside it from 64rem and above it on a narrower screen, and Check in a row of its
// own below them. The mode's two buttons stand by the heading. The tutor's words stand at the top
// of the panel, which comes for them on my own too, with the hint asked for. Hint stands beside
// Check always, and "Show the solution" too when the learner may ask for it, with a word of what it
// ends before it does (R22). Once the task is solved or its solution shown, the panel gives way to
// its result: "Correct" or "Solution shown", the words after a correct answer if any came — or why
// none came while platform AI is closed (R37) —, the
// solution, the way to what the engine chose (T28), "Try it again" and the way back to My subjects;
// the options take no tap, and the canvas stays as it was. Under a lesson's header it is no screen
// of its own, and its result ends with the lesson's Continue in place of "Try it again" (R23). What
// it shows it takes from its container, Task.tsx, which also gives the canvas the tutor's marks and
// "Report a problem" with the tutor's words, for a learner of the category adult (R33). Above it
// all, the voicing of the profile switched on and off; above the canvas, "Read aloud" of the
// statement with its items (R07; T45). Above Check on a handwriting sheet, the reminder to write no
// names, whose crop goes to AI whole (R127 in spec; R53).
import type * as open from "@altnovatrail/spec/formatv0/open";
import { useEffect, useId, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { summaryText, type Verdicts } from "./attempt.ts";
import { goesWhole } from "./essay.ts";
import { Items, Verdict } from "./Items.tsx";
import { Solution } from "./Solution.tsx";
import { choicesOnly, onWorkbook, slotsFilled, writingFilled } from "./steps.ts";
import { HintButton, ResultEnd, TaskLayout, type TaskParts } from "./TaskLayout.tsx";
import { TutorWords } from "./TutorWords.tsx";

export interface TaskScreenProps extends TaskParts {
  readonly verdicts: Verdicts;
  /** The solution of the task solved; none while it is not. */
  readonly solution?: readonly open.StatementPart[];
  /** The tutor's words of the rung, or after the correct answer; none while none came. */
  readonly tutorWords?: string;
  /**
   * What the request of the tutor's words came to: when it gave none, or why they are the fallback
   * text of the rung, or none came after the correct answer, while platform AI is closed (R37).
   */
  readonly wordsFailure?: string;
  /** The words of a rung are asked and have not come yet. */
  readonly wordsWaiting?: boolean;
  /** The words came since the last check: a screen reader is told. */
  readonly wordsCame?: boolean;
  /** The outcome of AI at the last check, in words: a failure of AI, a quota, a limit. */
  readonly outcome?: string;
  /** "Explain differently", while the rung has the right to it. */
  readonly onExplain?: () => void;
  readonly explaining?: boolean;
  /** What "Explain differently" came to, when it gave no other words. */
  readonly explainNote?: string;
  /** "Show the solution", while the learner may ask for it. */
  readonly onShow?: () => void;
  /** Why the solution was not shown, in words. */
  readonly showNote?: string;
  /** The attempt ended by the solution shown, not by a correct answer. */
  readonly shown?: boolean;
  readonly onChoose: (key: string, option: string) => void;
  readonly onCheck: () => void;
}

export function TaskScreen(props: TaskScreenProps) {
  const { task, manifest, state, verdicts, filled, solution, pending } = props;
  const { words } = useLanguage();
  const lockedId = useId();
  const namesId = useId();
  const [confirming, setConfirming] = useState(false);
  // The button that asks goes while the question stands: the focus goes with it, and comes back.
  const showButton = useRef<HTMLButtonElement>(null);
  const showIt = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);
  useEffect(() => {
    if (confirming) showIt.current?.focus();
    else if (asked.current) showButton.current?.focus();
    asked.current = confirming;
  }, [confirming]);
  const explanation = manifest?.languages.explanation;
  const solved = solution !== undefined;
  // The crop of a handwriting sheet goes to AI whole: the reminder to write no names stands before
  // each submission, and describes Check (R127 in spec; R53).
  const whole = goesWhole(task);
  const open = !solved && slotsFilled(task, state.choices, filled);
  // What locks Check: the sheet first — on a workbook, each of its boxes —, then the options.
  const locked = open
    ? undefined
    : !choicesOnly(task) && !writingFilled(task, filled)
      ? onWorkbook(task)
        ? "task.check-boxes"
        : "task.check-write"
      : "task.check-locked";
  const described = [whole ? namesId : "", locked === undefined ? "" : lockedId].join(" ").trim();
  const summary = summaryText(
    verdicts,
    solved ? (props.shown === true ? "shown" : "correct") : undefined,
    task,
    words,
  );

  return (
    <TaskLayout
      parts={props}
      over={solved}
      underCanvas={
        <Items
          task={task}
          choices={state.choices}
          verdicts={verdicts}
          language={explanation}
          locked={solved || pending}
          onChoose={props.onChoose}
        />
      }
      speaking={
        props.tutorWords !== undefined ||
        props.wordsFailure !== undefined ||
        props.wordsWaiting === true
      }
      tutor={
        <TutorWords
          words={props.tutorWords}
          language={explanation}
          {...(props.wordsFailure === undefined ? {} : { failure: props.wordsFailure })}
          waiting={props.wordsWaiting === true}
          {...(props.onExplain === undefined ? {} : { onExplain: props.onExplain })}
          explaining={props.explaining === true}
          {...(props.explainNote === undefined ? {} : { note: props.explainNote })}
          report={props.report}
        />
      }
      result={
        <>
          <p className="nt-result">
            {props.shown === true ? (
              words.text("task.solution-shown")
            ) : (
              <Verdict verdict="correct" />
            )}
          </p>
          <TutorWords
            words={props.tutorWords}
            language={explanation}
            {...(props.wordsFailure === undefined ? {} : { failure: props.wordsFailure })}
            report={props.report}
          />
          <Solution parts={solution ?? []} language={explanation} media={props.media} />
          <ResultEnd parts={props} />
        </>
      }
      check={
        <>
          {solved || !whole ? null : (
            <p id={namesId} className="nt-hint">
              {words.text("task.no-names")}
            </p>
          )}
          {solved ? null : (
            <div className="nt-buttons">
              {/* Not disabled while it is locked: a disabled button would drop the focus. */}
              <button
                type="button"
                className={props.blink && open ? "nt-blink" : undefined}
                aria-disabled={!open || pending}
                {...(described === "" ? {} : { "aria-describedby": described })}
                onClick={() => {
                  if (open && !pending) props.onCheck();
                }}
              >
                {words.text("task.check")}
              </button>
              {locked === undefined ? null : (
                <span id={lockedId} className="nt-hint">
                  {words.text(locked)}
                </span>
              )}
              <HintButton parts={props} />
              {props.onShow === undefined || confirming ? null : (
                <button
                  ref={showButton}
                  type="button"
                  className="nt-secondary"
                  onClick={() => setConfirming(true)}
                >
                  {words.text("task.show-solution")}
                </button>
              )}
            </div>
          )}
          {solved || props.onShow === undefined || !confirming ? null : (
            <fieldset className="nt-buttons">
              <legend>{words.text("task.show-confirm")}</legend>
              <button
                ref={showIt}
                type="button"
                aria-disabled={pending}
                onClick={() => {
                  if (pending) return;
                  setConfirming(false);
                  props.onShow?.();
                }}
              >
                {words.text("task.show-it")}
              </button>
              <button type="button" className="nt-secondary" onClick={() => setConfirming(false)}>
                {words.text("common.cancel")}
              </button>
            </fieldset>
          )}
          {props.showNote === undefined ? null : <p className="nt-hint">{props.showNote}</p>}
          {props.outcome === undefined ? null : <p className="nt-hint">{props.outcome}</p>}
          <p role="status">{summary}</p>
          <p role="status">{props.wordsCame === true ? words.text("task.words-came") : ""}</p>
        </>
      }
    />
  );
}
