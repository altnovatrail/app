// The task screen (section 3.3 of docs/architecture.md; R20, R21, R22 and R65 in
// docs/decisions.md), as the mockup's `task-pill`, laid out by TaskLayout: the canvas over the
// window, and at its foot the row of glass — "Choose an answer" where the task has options, which
// opens them in a pop-over, Hint, the button "Tutor" on my own, "Show the solution" when the learner
// may ask for it, which asks first in a pop-over of its own, and after a line Check. By steps the
// panel stands always, its steps in it; on my own the button "Tutor" opens and closes it, and Hint
// opens it — a verdict does not, and with it closed the tutor says nothing of the work (the second
// 2026-11-17 amendment to R148 in spec; T88). The tutor's words stand at the top of the panel, with
// the hint asked for. Above the row stands the verdict's card: the work being read, "Not yet" with
// what was read, Hint and "Try again", which puts it away; why Check does not open, once it is
// pressed so; "Correct" or "Solution shown" once the task is over. Then the panel gives way to the
// result: the button "Tutor" on my own, the words after a correct answer while the panel is open —
// or why none came while platform AI is closed (R37) —, the solution, the way to what the engine
// chose (T28) and "Try it again"; the options take no tap, the row goes, and the canvas stays as it
// was. Under a lesson's header it is no screen of its own, and its result ends with the lesson's
// Continue in place of "Try it again" (R23). What it shows it takes from its container, Task.tsx,
// which also gives the canvas the tutor's marks and "Report a problem" with the tutor's words, for a
// learner of the category adult (R33). Above it all, the voicing of the profile switched on and
// off; above the canvas, "Read aloud" of the statement with its items (R07; T45). Above the card on
// a handwriting sheet, the reminder to write no names, whose crop goes to AI whole (R127 in spec;
// R53).
import type * as open from "@altnovatrail/spec/formatv0/open";
import { useEffect, useId, useState } from "react";
import { Icon } from "../app/Icon.tsx";
import { PopOver } from "../app/PopOver.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Words } from "../i18n/words.ts";
import { summaryText, type Verdicts, verdictKey } from "./attempt.ts";
import { goesWhole } from "./essay.ts";
import {
  ChoiceGroups,
  hasChoices,
  Items,
  onlyChoice,
  readInCard,
  readingsOf,
  readingText,
} from "./Items.tsx";
import { Solution } from "./Solution.tsx";
import { choicesOnly, onWorkbook, slotsFilled, slotsOf, writingFilled } from "./steps.ts";
import {
  HintButton,
  ResultEnd,
  RowLine,
  TaskLayout,
  type TaskParts,
  VerdictCard,
} from "./TaskLayout.tsx";
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
  /** The tutor's panel is open: always by steps, on my own as the learner left it. */
  readonly panelOpen: boolean;
  /** The button "Tutor", which opens the panel and closes it: on my own alone. */
  readonly onPanel?: () => void;
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

/**
 * The line of the verdict's card: what was read in the one item of the task, or how many items are
 * not right yet.
 */
function cardLine(verdicts: Verdicts, task: open.Task, words: Words): string | undefined {
  if (readInCard(task)) {
    const [reading] = readingsOf(verdicts, 1, slotsOf(task.items[0] as open.Item).length);
    if (reading !== undefined) return readingText(reading, words);
  }
  return task.items.length === 1 ? undefined : summaryText(verdicts, undefined, task, words);
}

/** The verdict of the items not right, in a word: the first such item's, in the task's order. */
function notRight(verdicts: Verdicts): string | undefined {
  for (const verdict of verdicts.items.values()) if (verdict !== "correct") return verdict;
  return undefined;
}

export function TaskScreen(props: TaskScreenProps) {
  const { task, manifest, state, verdicts, filled, solution, pending } = props;
  const { words } = useLanguage();
  const lockedId = useId();
  const namesId = useId();
  const explanation = manifest?.languages.explanation;
  const solved = solution !== undefined;
  // The card of "Not yet" stays till "Try again" or Hint puts it away, or a new check comes: a
  // change of the work drops a verdict, but brings back no card put away.
  const [putAway, setPutAway] = useState(false);
  // Check pressed while it does not open: the card says why, till OK or till it opens.
  const [asked, setAsked] = useState(false);
  // Check pressed and its answer not come: the card of the reading.
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    if (!pending) setChecking(false);
  }, [pending]);
  const tutorButton =
    props.onPanel === undefined ? null : (
      <button
        type="button"
        className="nt-row-button"
        aria-expanded={props.panelOpen}
        onClick={props.onPanel}
      >
        {words.text("task.tutor")}
      </button>
    );
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
  useEffect(() => {
    if (locked === undefined) setAsked(false);
  }, [locked]);
  const described = [whole ? namesId : "", locked === undefined ? "" : lockedId].join(" ").trim();
  const summary = summaryText(
    verdicts,
    solved ? (props.shown === true ? "shown" : "correct") : undefined,
    task,
    words,
  );
  const hint = () => {
    setPutAway(true);
    props.onHint();
  };
  const wrong = notRight(verdicts);
  const line = cardLine(verdicts, task, words);

  const card = solved ? (
    props.shown === true ? (
      <VerdictCard kind="shown" title={words.text("task.solution-shown")} />
    ) : (
      <VerdictCard kind="correct" title={words.text("task.correct")} line={line} />
    )
  ) : checking && pending ? (
    <VerdictCard
      kind="reading"
      title={words.text("task.reading")}
      // A choice is checked by the program alone; a picture of the sheet goes to be read.
      line={choicesOnly(task) ? undefined : words.text("task.reading-line")}
    />
  ) : asked && locked !== undefined ? (
    <VerdictCard kind="write" title={words.text(locked)} line={words.text(`${locked}-line`)}>
      <button type="button" className="nt-card-button" onClick={() => setAsked(false)}>
        {words.text("common.ok")}
      </button>
    </VerdictCard>
  ) : wrong !== undefined && !putAway ? (
    <VerdictCard kind="not-yet" title={words.text(verdictKey(wrong))} line={line}>
      <button
        type="button"
        className="nt-card-link"
        aria-disabled={pending}
        onClick={() => {
          if (!pending) hint();
        }}
      >
        {words.text("task.hint")}
      </button>
      <button type="button" className="nt-card-button" onClick={() => setPutAway(true)}>
        {words.text("task.try-again")}
      </button>
    </VerdictCard>
  ) : null;

  return (
    <TaskLayout
      parts={props}
      over={solved}
      underCanvas={<Items task={task} verdicts={verdicts} language={explanation} />}
      panel={props.panelOpen}
      tutor={
        <TutorWords
          always={props.mode === "self"}
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
          {tutorButton === null ? null : <div className="nt-buttons">{tutorButton}</div>}
          {props.panelOpen ? (
            <TutorWords
              words={props.tutorWords}
              language={explanation}
              {...(props.wordsFailure === undefined ? {} : { failure: props.wordsFailure })}
              waiting={props.wordsWaiting === true}
              report={props.report}
            />
          ) : null}
          <Solution parts={solution ?? []} language={explanation} media={props.media} />
          <ResultEnd parts={props} />
        </>
      }
      lines={
        <>
          {solved || !whole ? null : (
            <p id={namesId} className="nt-hint">
              {words.text("task.no-names")}
            </p>
          )}
          {locked === undefined || solved ? null : (
            <span id={lockedId} className="nt-hidden-label">
              {words.text(locked)}
            </span>
          )}
          {props.showNote === undefined ? null : <p className="nt-hint">{props.showNote}</p>}
          {props.outcome === undefined ? null : <p className="nt-hint">{props.outcome}</p>}
          <p role="status" className="nt-hidden-label">
            {summary}
          </p>
          <p role="status" className="nt-hidden-label">
            {props.wordsCame === true ? words.text("task.words-came") : ""}
          </p>
        </>
      }
      card={card}
      row={
        solved ? (
          // The options chosen and their verdicts stay in sight, and take no tap (R65).
          hasChoices(task) ? (
            <ChooseButton {...props} pending />
          ) : null
        ) : (
          <>
            {hasChoices(task) ? <ChooseButton {...props} /> : null}
            <HintButton parts={{ ...props, onHint: hint }} />
            {tutorButton}
            {props.onShow === undefined ? null : (
              <ShowButton
                pending={pending}
                onShow={() => {
                  setChecking(false);
                  props.onShow?.();
                }}
              />
            )}
            <RowLine />
            {/* Not disabled while it is locked: a disabled button would drop the focus. */}
            <button
              type="button"
              className={props.blink && open ? "nt-check-button nt-blink" : "nt-check-button"}
              aria-disabled={!open || pending}
              {...(described === "" ? {} : { "aria-describedby": described })}
              onClick={() => {
                if (pending) return;
                if (!open) {
                  setAsked(true);
                  return;
                }
                setChecking(true);
                setPutAway(false);
                props.onCheck();
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

/**
 * "Choose an answer", the mockup's `choice`: its pop-over hangs 14 above the row, in its middle, and
 * holds the options of each answer slot bound choice. On the task's one such slot the button shows
 * the option chosen, with the sign of its verdict, and a choice closes the pop-over.
 */
function ChooseButton(props: TaskScreenProps) {
  const { task, state, verdicts, manifest, pending } = props;
  const { words } = useLanguage();
  const only = onlyChoice(task);
  const chosen = only === undefined ? undefined : state.choices[only];
  const verdict = only === undefined ? undefined : verdicts.slots.get(only);
  const label = words.text("task.choose");
  const language = manifest?.languages.explanation;
  // Its name says the verdict in a word, which its sign alone does not (section 3.9).
  const named =
    chosen === undefined
      ? undefined
      : verdict === undefined
        ? words.text("task.chosen", { option: chosen })
        : words.text(props.solution !== undefined ? "task.chosen-over" : "task.chosen-judged", {
            option: chosen,
            verdict: words.text(verdictKey(verdict)),
          });
  return (
    <PopOver
      label={label}
      {...(named === undefined ? {} : { buttonLabel: named })}
      caption={
        <>
          {verdict === undefined ? null : (
            <span className="nt-choose-sign" data-correct={verdict === "correct"}>
              {verdict === "correct" ? <Icon value="ticked" /> : null}
            </span>
          )}
          <span
            className="nt-choose-words"
            {...(chosen === undefined || language === undefined ? {} : { lang: language })}
          >
            {chosen ?? label}
          </span>
          <Icon value="menu-open" />
        </>
      }
      className="nt-icon-button nt-row-button nt-choose"
      anchor=".nt-task-row"
      centred
      gap={14}
      popClassName="nt-pop-choose"
    >
      {(close) => (
        <ChoiceGroups
          task={task}
          choices={state.choices}
          verdicts={verdicts}
          language={language}
          locked={pending}
          onChoose={props.onChoose}
          {...(only === undefined ? {} : { onChosen: close })}
        />
      )}
    </PopOver>
  );
}

/**
 * "Show the solution", the mockup's `solution-ask`: it asks first, in a pop-over hung 14 above the
 * row, that once the solution is shown the task is over — Cancel, or "Show it" (R22).
 */
function ShowButton({
  pending,
  onShow,
}: {
  readonly pending: boolean;
  readonly onShow: () => void;
}) {
  const { words } = useLanguage();
  return (
    <PopOver
      label={words.text("task.show-solution")}
      className="nt-row-button nt-row-accent"
      anchor=".nt-task-row"
      centred
      gap={14}
      popClassName="nt-pop-confirm"
    >
      {(close) => (
        <>
          <p className="nt-confirm-title">{words.text("task.show-confirm")}</p>
          <div className="nt-confirm-buttons">
            <button type="button" className="nt-card-link" onClick={close}>
              {words.text("common.cancel")}
            </button>
            <button
              type="button"
              className="nt-confirm-yes"
              aria-disabled={pending}
              onClick={() => {
                if (pending) return;
                close();
                onShow();
              }}
            >
              {words.text("task.show-it")}
            </button>
          </div>
        </>
      )}
    </PopOver>
  );
}
