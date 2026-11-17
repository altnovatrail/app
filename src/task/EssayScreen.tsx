// The screen of an essay, laid out as the task screen is (section 3.3 of docs/architecture.md; R20,
// R53 in docs/decisions.md): the canvas with what was read under it, the tutor's panel beside it from
// 64rem and above it on a narrower screen, and the row of Check below them. An essay has no verdict
// (R75, R87 in spec): the panel's block "Tutor" holds the feedback of the last submission, or why
// it gave none — no feedback this time, an essay that cannot be read, no check —, with "Report a
// problem" for a learner of the category adult (R33). Beside Check stand the reminder to write no
// names, before each submission (R127 in spec), Hint, and Done, open once the essay was sent; there
// is no "Show the solution". Done gives way to the result: "Essay finished", the last feedback, the
// criteria of the rubric and the solution if the task has one, the way to what the engine chose,
// "Try it again" and the way back. What it shows it takes from its container, Essay.tsx.
import type {
  CanvasElement,
  HistoryChangeEvent,
  HistoryEvent,
  Media,
} from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { type ReactNode, type Ref, useId, useMemo } from "react";
import type { Failure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { ReadAloud } from "../voice/ReadAloud.tsx";
import { taskPhrases } from "../voice/texts.ts";
import { VoicingToggle } from "../voice/VoicingToggle.tsx";
import { Hint, type HintGiven } from "./Hint.tsx";
import { Solution } from "./Solution.tsx";
import { StepsPanel } from "./StepsPanel.tsx";
import type { Mode, StepsState } from "./steps.ts";
import { Frame } from "./TaskScreen.tsx";
import { TutorWords } from "./TutorWords.tsx";

/** The essay finished by Done: the rubric's criteria and the solution, as `SolvedTask` gives them. */
export interface Finished {
  readonly criteria: readonly string[];
  readonly solution: readonly open.StatementPart[];
}

export interface EssayScreenProps {
  readonly task: open.Task;
  readonly manifest: open.Manifest | undefined;
  readonly steps: readonly open.Step[];
  readonly catalog: open.Techniques | undefined;
  readonly state: StepsState;
  readonly mode: Mode;
  readonly filled: readonly (readonly boolean[])[] | null;
  readonly history: readonly HistoryEvent[];
  readonly media: Media;
  readonly notSaved: boolean;
  /** A check, Done or a new attempt is under way. */
  readonly pending: boolean;
  /** A check is under way: the tutor is reading the essay. */
  readonly checking: boolean;
  readonly failure?: Failure;
  readonly againFailure?: Failure;
  readonly blink: boolean;
  /** The text read at the last submission, as it is written; none when it was not read. */
  readonly text?: string;
  /** The words of the last feedback; none when none came. */
  readonly feedback?: string;
  /** Why the last submission gave no words of feedback, in words. */
  readonly note?: string;
  /** The feedback came at the last check: a screen reader is told. */
  readonly came: boolean;
  readonly report?: ReactNode;
  readonly hint?: HintGiven;
  /** Done is open: the essay was sent at least once (R87 in spec). */
  readonly mayFinish: boolean;
  /** The essay was finished by Done; none while it is not. */
  readonly finished?: Finished;
  readonly canvasRef?: Ref<CanvasElement>;
  readonly onHistoryChange: (event: HistoryChangeEvent) => void;
  readonly onMode: (mode: Mode) => void;
  readonly onGoTo: (place: number) => void;
  readonly onTick: (chip: number | "unknown") => void;
  readonly onDone: () => void;
  readonly onCheck: () => void;
  readonly onHint: () => void;
  readonly onFinish: () => void;
  readonly onAgain: () => void;
  readonly onHome: () => void;
  readonly inLesson?: boolean;
  readonly next?: ReactNode;
}

export function EssayScreen(props: EssayScreenProps) {
  const { task, manifest, steps, state, mode, filled, finished, pending } = props;
  const { language, words } = useLanguage();
  const namesId = useId();
  const lockedId = useId();
  const doneId = useId();
  const criteriaId = useId();
  const explanation = manifest?.languages.explanation;
  const lang = explanation === undefined ? {} : { lang: explanation };
  const statement = useMemo(() => taskPhrases(task, explanation), [task, explanation]);
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
    <Frame inLesson={props.inLesson === true} title={words.text("task.title")}>
      {steps.length === 0 || ended ? null : (
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
      <VoicingToggle language={explanation} />
      <p role="status" className="nt-error">
        {props.notSaved ? words.text("task.not-saved") : ""}
      </p>
      <div className="nt-task">
        <div className="nt-task-work">
          <ReadAloud phrases={statement} language={explanation} />
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
          {props.text === undefined ? null : (
            <section className="nt-essay-text">
              <h2>{words.text("essays.text")}</h2>
              <p {...lang}>{props.text}</p>
            </section>
          )}
        </div>
        {ended ||
        mode === "steps" ||
        props.hint !== undefined ||
        props.feedback !== undefined ||
        props.note !== undefined ||
        props.checking ? (
          <aside className="nt-task-panel" aria-label={words.text("task.tutor")}>
            {ended ? (
              <>
                <p className="nt-result">{words.text("task.essay-done")}</p>
                {feedback}
                {finished.criteria.length === 0 ? null : (
                  <section aria-labelledby={criteriaId}>
                    <h2 id={criteriaId}>{words.text("task.criteria")}</h2>
                    <ul {...lang}>
                      {finished.criteria.map((criterion) => (
                        <li key={criterion}>{criterion}</li>
                      ))}
                    </ul>
                  </section>
                )}
                <Solution parts={finished.solution} language={explanation} media={props.media} />
                {props.againFailure === undefined ? null : (
                  <p role="alert" className="nt-error">
                    {failureText(props.againFailure, words)}
                  </p>
                )}
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
                {feedback}
              </>
            )}
            {!ended && mode === "steps" ? (
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
          {ended ? null : (
            <>
              {/* Before each submission, as the description of Check too (R127 in spec). */}
              <p id={namesId} className="nt-hint">
                {words.text("task.no-names")}
              </p>
              <div className="nt-buttons">
                {/* Not disabled while it is locked: a disabled button would drop the focus. */}
                <button
                  type="button"
                  className={props.blink && written ? "nt-blink" : undefined}
                  aria-disabled={!written || pending}
                  aria-describedby={written ? namesId : `${namesId} ${lockedId}`}
                  onClick={() => {
                    if (written && !pending) props.onCheck();
                  }}
                >
                  {words.text("task.check")}
                </button>
                {written ? null : (
                  <span id={lockedId} className="nt-hint">
                    {words.text("task.check-write")}
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
                <button
                  type="button"
                  className="nt-secondary"
                  aria-disabled={!props.mayFinish || pending}
                  {...(props.mayFinish ? {} : { "aria-describedby": doneId })}
                  onClick={() => {
                    if (props.mayFinish && !pending) props.onFinish();
                  }}
                >
                  {words.text("task.done")}
                </button>
                {props.mayFinish ? null : (
                  <span id={doneId} className="nt-hint">
                    {words.text("task.done-locked")}
                  </span>
                )}
              </div>
            </>
          )}
          <p role="status">{props.came ? words.text("task.feedback-came") : ""}</p>
        </div>
      </div>
    </Frame>
  );
}
