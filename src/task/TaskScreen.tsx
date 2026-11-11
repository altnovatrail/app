// The task screen as the author laid it out (section 3.3 of docs/architecture.md; R20, R21 in
// docs/decisions.md): the canvas and below it the items with their options and what was read, the
// tutor's panel beside it from 64rem and above it on a narrower screen, and Check in a row of its
// own below them. The mode's two buttons stand by the heading. The tutor's words stand at the top
// of the panel, which comes for them on my own too, with the hint asked for. Hint stands beside
// Check always, and "Show the solution" too when the learner may ask for it, with a word of what it
// ends before it does (R22). Once the task is solved or its solution shown, the panel gives way to
// its result: "Correct" or "Solution shown", the words after a correct answer if any came, the
// solution, the way to what the engine chose (T28), "Try it again" and the way back to My subjects;
// the options take no tap, and the canvas stays as it was. Under a lesson's header it is no screen
// of its own, and its result ends with the lesson's Continue in place of "Try it again" (R23). What
// it shows it takes from its container, Task.tsx, which also gives the canvas the tutor's marks.
import type {
  CanvasElement,
  HistoryChangeEvent,
  HistoryEvent,
  Media,
} from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { type ReactNode, type Ref, useEffect, useId, useRef, useState } from "react";
import type { Failure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { notYet, type Verdicts } from "./attempt.ts";
import { Hint, type HintGiven } from "./Hint.tsx";
import { Items, Verdict } from "./Items.tsx";
import { Solution } from "./Solution.tsx";
import { StepsPanel } from "./StepsPanel.tsx";
import { choicesOnly, type Mode, type StepsState, slotsFilled, writingFilled } from "./steps.ts";
import { TutorWords } from "./TutorWords.tsx";

export interface TaskScreenProps {
  readonly task: open.Task;
  readonly manifest: open.Manifest | undefined;
  readonly steps: readonly open.Step[];
  readonly catalog: open.Techniques | undefined;
  readonly state: StepsState;
  /** The mode shown: "on my own" alone for a module without steps. */
  readonly mode: Mode;
  readonly verdicts: Verdicts;
  /** The canvas's `filled`, as last read. */
  readonly filled: readonly (readonly boolean[])[] | null;
  readonly history: readonly HistoryEvent[];
  readonly media: Media;
  /** A write of the work did not reach the device's database. */
  readonly notSaved: boolean;
  /** A check or a new attempt is under way. */
  readonly pending: boolean;
  /** What the last check came to, when it did not answer. */
  readonly failure?: Failure;
  /** The solution of the task solved; none while it is not. */
  readonly solution?: readonly open.StatementPart[];
  /** What "Try it again" came to, when it did not answer. */
  readonly againFailure?: Failure;
  /** Check blinks once on a pause (section 3.3). */
  readonly blink: boolean;
  /** The tutor's words of the rung, or after the correct answer; none while none came. */
  readonly tutorWords?: string;
  /** What the request of the tutor's words came to, when it gave none. */
  readonly wordsFailure?: string;
  /** The words came since the last check: a screen reader is told. */
  readonly wordsCame?: boolean;
  /** The outcome of AI at the last check, in words: a failure of AI, a quota, a limit. */
  readonly outcome?: string;
  /** The hint api gave before the first wrong answer; none while none was asked for. */
  readonly hint?: HintGiven;
  readonly onHint: () => void;
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
  readonly canvasRef?: Ref<CanvasElement>;
  readonly onHistoryChange: (event: HistoryChangeEvent) => void;
  readonly onMode: (mode: Mode) => void;
  readonly onGoTo: (place: number) => void;
  readonly onTick: (chip: number | "unknown") => void;
  readonly onDone: () => void;
  readonly onChoose: (key: string, option: string) => void;
  readonly onCheck: () => void;
  readonly onAgain: () => void;
  readonly onHome: () => void;
  /** The task is a segment of a lesson, under its header: no screen of its own, no "Try it again". */
  readonly inLesson?: boolean;
  /** The way to what the engine chose once the attempt is over, outside a lesson (R24). */
  readonly next?: ReactNode;
}

/** The screen of the task, or, in a lesson, the lesson's screen around it. */
function Frame({
  inLesson,
  title,
  children,
}: {
  readonly inLesson: boolean;
  readonly title: string;
  readonly children: ReactNode;
}) {
  if (inLesson) return <div className="nt-lesson-task">{children}</div>;
  return (
    <Screen title={title} wide>
      {children}
    </Screen>
  );
}

export function TaskScreen(props: TaskScreenProps) {
  const { task, manifest, steps, state, mode, verdicts, filled, solution, pending } = props;
  const { language, words } = useLanguage();
  const lockedId = useId();
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
  const open = !solved && slotsFilled(task, state.choices, filled);
  // What locks Check: the sheet first, then the options.
  const locked = open
    ? undefined
    : !choicesOnly(task) && !writingFilled(task, filled)
      ? "task.check-write"
      : "task.check-locked";
  const notRight = notYet(verdicts);
  const summary = solved
    ? words.text(props.shown === true ? "task.solution-shown" : "task.correct")
    : verdicts.items.size === 0 || notRight === 0
      ? ""
      : words.text("task.summary-not-yet", { count: notRight, total: task.items.length });

  return (
    <Frame inLesson={props.inLesson === true} title={words.text("task.title")}>
      {steps.length === 0 || solved ? null : (
        <fieldset className="nt-buttons">
          <legend>{words.text("task.mode")}</legend>
          <button
            type="button"
            aria-pressed={mode === "steps"}
            onClick={() => props.onMode("steps")}
          >
            {words.text("task.by-steps")}
          </button>
          <button type="button" aria-pressed={mode === "self"} onClick={() => props.onMode("self")}>
            {words.text("task.on-my-own")}
          </button>
        </fieldset>
      )}
      <p role="status" className="nt-error">
        {props.notSaved ? words.text("task.not-saved") : ""}
      </p>
      <div className="nt-task">
        <div className="nt-task-work">
          {/* The order of the properties is the order React gives them (section 3.1). */}
          <novatrail-canvas
            ref={props.canvasRef}
            lang={language}
            {...(manifest === undefined ? {} : { manifest })}
            media={props.media}
            task={task}
            history={props.history}
            onhistorychange={props.onHistoryChange}
          />
          <Items
            task={task}
            choices={state.choices}
            verdicts={verdicts}
            language={explanation}
            locked={solved || pending}
            onChoose={props.onChoose}
          />
        </div>
        {solved ||
        mode === "steps" ||
        props.hint !== undefined ||
        props.tutorWords !== undefined ||
        props.wordsFailure !== undefined ? (
          <aside className="nt-task-panel" aria-label={words.text("task.tutor")}>
            {solved ? (
              <>
                <p className="nt-result">
                  {props.shown === true ? (
                    words.text("task.solution-shown")
                  ) : (
                    <Verdict verdict="correct" />
                  )}
                </p>
                <TutorWords words={props.tutorWords} language={explanation} />
                <Solution parts={solution} language={explanation} media={props.media} />
                {props.againFailure === undefined ? null : (
                  <p role="alert" className="nt-error">
                    {failureText(props.againFailure, words)}
                  </p>
                )}
                {/* In a lesson the way on is its Continue, below the task (R23). */}
                {props.inLesson === true ? null : props.next}
                {props.inLesson === true ? null : (
                  <div className="nt-buttons">
                    <button
                      type="button"
                      className="nt-secondary"
                      aria-disabled={pending}
                      onClick={() => {
                        if (!pending) props.onAgain();
                      }}
                    >
                      {words.text("task.again")}
                    </button>
                    <button type="button" className="nt-secondary" onClick={props.onHome}>
                      {words.text("task.home")}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {props.hint === undefined ? null : (
                  <Hint
                    hint={props.hint}
                    task={task}
                    catalog={props.catalog}
                    language={explanation}
                  />
                )}
                <TutorWords
                  words={props.tutorWords}
                  language={explanation}
                  {...(props.wordsFailure === undefined ? {} : { failure: props.wordsFailure })}
                  {...(props.onExplain === undefined ? {} : { onExplain: props.onExplain })}
                  explaining={props.explaining === true}
                  {...(props.explainNote === undefined ? {} : { note: props.explainNote })}
                />
              </>
            )}
            {!solved && mode === "steps" ? (
              <StepsPanel
                task={task}
                steps={steps}
                catalog={props.catalog}
                state={state}
                filled={filled}
                language={explanation}
                onGoTo={props.onGoTo}
                onTick={props.onTick}
                onDone={props.onDone}
              />
            ) : null}
          </aside>
        ) : null}
        <div className="nt-task-check">
          {props.failure === undefined ? null : (
            <p role="alert" className="nt-error">
              {failureText(props.failure, words)}
            </p>
          )}
          {solved ? null : (
            <div className="nt-buttons">
              {/* Not disabled while it is locked: a disabled button would drop the focus. */}
              <button
                type="button"
                className={props.blink && open ? "nt-blink" : undefined}
                aria-disabled={!open || pending}
                {...(locked === undefined ? {} : { "aria-describedby": lockedId })}
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
              <button
                type="button"
                className="nt-secondary"
                aria-disabled={pending}
                onClick={() => {
                  if (!pending) props.onHint();
                }}
              >
                {words.text("task.hint")}
              </button>
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
        </div>
      </div>
    </Frame>
  );
}
