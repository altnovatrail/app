// The screen of an essay, laid out as the task screen is (R20, R53, R66), as the mockup's `essay`
// and `essay-feedback`: the canvas with what was read under it, the row of glass below them — Hint,
// Done and Check (R65) —, and the tutor's panel of R67, open by steps and with a hint, and closed
// by its × till the next hint; the essay being read and its feedback do not open it, as a verdict
// does not (R67). An essay has no verdict (R75, R87 spec): the panel's block "Tutor" holds the
// feedback of the last submission, or why it gave none — no feedback this time, an essay that
// cannot be read, no check —, with "Report a problem" for a learner of the category adult (R33).
// Above the row stands the card: the essay being read; "Feedback", which says where the feedback is, with Done; why Check or
// Done does not open, once it is pressed so. Done opens once the essay was sent; there is no "Show
// the solution". Done gives way to the result: "Essay finished", the last feedback, the criteria of
// the rubric and the solution if the task has one, the way to what the engine chose, "Try it again"
// and the way back. What it shows it takes from its container, Essay.tsx.
import type * as open from "@altnovatrail/spec/formatv0/open";
import { useEffect, useId, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { Solution } from "./Solution.tsx";
import {
  HintButton,
  ResultEnd,
  RowLine,
  TaskLayout,
  type TaskParts,
  VerdictCard,
} from "./TaskLayout.tsx";
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
  /** Done is open: the essay was sent at least once (R87 spec). */
  readonly mayFinish: boolean;
  /** The essay was finished by Done; none while it is not. */
  readonly finished?: Finished;
  readonly onCheck: () => void;
  readonly onFinish: () => void;
  /** Told each time the tutor's panel opens or closes: the tutor speaks only while it is open. */
  readonly onPanelChange?: (open: boolean) => void;
}

/** The button whose press, while it does not open, the card explains. */
type Locked = "task.check-write" | "task.done-locked";

export function EssayScreen(props: EssayScreenProps) {
  const { manifest, filled, finished, pending } = props;
  const { words } = useLanguage();
  const lockedId = useId();
  const doneId = useId();
  const criteriaId = useId();
  const explanation = manifest?.languages.explanation;
  const lang = explanation === undefined ? {} : { lang: explanation };
  const ended = finished !== undefined;
  // The sheet holds something: Check opens (`answer_slots_filled`).
  const written = !ended && filled?.[0]?.[0] === true;
  // Check or Done pressed while it does not open: the card says why, till OK or till it opens.
  const [asked, setAsked] = useState<Locked | undefined>(undefined);
  const opened =
    (asked === "task.check-write" && written) || (asked === "task.done-locked" && props.mayFinish);
  useEffect(() => {
    if (opened) setAsked(undefined);
  }, [opened]);
  // Nothing sent yet: the essay was neither read nor answered. Once it was, Done waits only for the
  // submission to be kept on the device, and a press says nothing of writing it.
  const unsent = props.feedback === undefined && props.note === undefined;
  // The panel opens by steps and with a hint; the learner's × or the tutor's button holds over that,
  // till the next hint comes (R67).
  const [chosen, setChosen] = useState<boolean | undefined>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: each hint that comes opens it again.
  useEffect(() => {
    setChosen(undefined);
  }, [props.hint]);
  const open = chosen ?? (props.mode === "steps" || props.hint !== undefined);
  const { onPanelChange } = props;
  useEffect(() => onPanelChange?.(open), [open, onPanelChange]);
  // Hint opens the panel at its press, as the task screen's does, whatever the answer brings.
  const hint = () => {
    setChosen(true);
    props.onHint();
  };
  const feedback = (
    <TutorWords
      words={props.feedback}
      language={explanation}
      {...(props.note === undefined ? {} : { failure: props.note })}
      waiting={props.checking}
      report={props.report}
    />
  );
  const finish = () => {
    if (pending) return;
    if (props.mayFinish) props.onFinish();
    else if (unsent) setAsked("task.done-locked");
  };

  const card = ended ? null : props.checking ? (
    <VerdictCard
      kind="reading"
      title={words.text("task.reading")}
      line={words.text("task.reading-line")}
    />
  ) : asked !== undefined && !opened ? (
    <VerdictCard kind="write" title={words.text(asked)} line={words.text(`${asked}-line`)}>
      <button type="button" className="nt-card-button" onClick={() => setAsked(undefined)}>
        {words.text("common.ok")}
      </button>
    </VerdictCard>
  ) : props.feedback !== undefined && props.note === undefined ? (
    // Where the feedback is, not its words, which the panel holds (R53).
    <VerdictCard
      kind="feedback"
      title={words.text("task.feedback")}
      line={words.text("task.feedback-line")}
    >
      <button
        type="button"
        className="nt-card-button"
        aria-disabled={pending || !props.mayFinish}
        {...(props.mayFinish ? {} : { "aria-describedby": doneId })}
        onClick={finish}
      >
        {words.text("task.done")}
      </button>
    </VerdictCard>
  ) : null;

  return (
    <TaskLayout
      parts={props}
      over={ended}
      underCanvas={
        props.text === undefined ? null : (
          <section className="nt-essay-text">
            <h2>{words.text("task.essay-text")}</h2>
            <p {...lang}>{props.text}</p>
          </section>
        )
      }
      open={open}
      onOpen={() => setChosen(true)}
      onClose={() => setChosen(false)}
      tutor={feedback}
      acts={<HintButton parts={{ pending, onHint: hint }} className="nt-act" />}
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
              {/* Why Check and Done do not open, their descriptions: the card says it on a press. */}
              {written ? null : (
                <span id={lockedId} className="nt-hidden-label">
                  {words.text("task.check-write")}
                </span>
              )}
              {props.mayFinish ? null : (
                <span id={doneId} className="nt-hidden-label">
                  {words.text("task.done-locked")}
                </span>
              )}
            </>
          )}
          <p role="status" className="nt-hidden-label">
            {props.came ? words.text("task.feedback-came") : ""}
          </p>
        </>
      }
      card={card}
      row={
        ended ? null : (
          <>
            <HintButton parts={{ pending, onHint: hint }} />
            {/* The accent's words once it opens, the muted text's while it does not (R66). */}
            <button
              type="button"
              className="nt-row-button nt-done"
              aria-disabled={!props.mayFinish || pending}
              {...(props.mayFinish ? {} : { "aria-describedby": doneId })}
              onClick={finish}
            >
              {words.text("task.done")}
            </button>
            <RowLine />
            {/* Not disabled while it is locked: a disabled button would drop the focus. */}
            <button
              type="button"
              className={props.blink && written ? "nt-check-button nt-blink" : "nt-check-button"}
              aria-disabled={!written || pending}
              {...(written ? {} : { "aria-describedby": lockedId })}
              onClick={() => {
                if (pending) return;
                if (written) props.onCheck();
                else setAsked("task.check-write");
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
