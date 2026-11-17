// What the task screen and the screen of an essay share (section 3.3 of docs/architecture.md; R20,
// R53 in docs/decisions.md): the mode's two buttons by the heading, the voicing switched on and off,
// the canvas with "Read aloud" above it and what each screen puts under it, the tutor's panel beside
// it from 64rem and above it on a narrower screen — the hint and the tutor's words at its top, the
// steps under them, or the attempt's result once it is over —, and the row of Check below them. By
// steps the panel stands always; on my own, as each screen says.
// Each screen gives what is its own: under the canvas, the words, the result and the row's buttons.
import type {
  CanvasElement,
  HistoryChangeEvent,
  HistoryEvent,
  Media,
} from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { type ReactNode, type Ref, useMemo } from "react";
import type { Failure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { HomeButton, HomeWay } from "../app/HomeButton.tsx";
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { ReadAloud } from "../voice/ReadAloud.tsx";
import { taskPhrases } from "../voice/texts.ts";
import { VoicingToggle } from "../voice/VoicingToggle.tsx";
import { Hint, type HintGiven } from "./Hint.tsx";
import { StepsPanel } from "./StepsPanel.tsx";
import type { Mode, StepsState } from "./steps.ts";

/** The screen of the task, or, in a lesson, the lesson's screen around it. */
export function Frame({
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

/** What both screens take from their containers alike. */
export interface TaskParts {
  readonly task: open.Task;
  readonly manifest: open.Manifest | undefined;
  readonly steps: readonly open.Step[];
  readonly catalog: open.Techniques | undefined;
  readonly state: StepsState;
  /** The mode shown: "on my own" alone for a module without steps. */
  readonly mode: Mode;
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
  /** What "Try it again" came to, when it did not answer. */
  readonly againFailure?: Failure;
  /** Check blinks once on a pause (section 3.3). */
  readonly blink: boolean;
  /** "Report a problem" with the tutor's words shown, for a learner of the category adult (R33). */
  readonly report?: ReactNode;
  /** The hint api gave before the first wrong answer; none while none was asked for. */
  readonly hint?: HintGiven;
  readonly onHint: () => void;
  readonly canvasRef?: Ref<CanvasElement>;
  readonly onHistoryChange: (event: HistoryChangeEvent) => void;
  readonly onMode: (mode: Mode) => void;
  readonly onGoTo: (place: number) => void;
  readonly onTick: (chip: number | "unknown") => void;
  readonly onDone: () => void;
  readonly onAgain: () => void;
  readonly onHome: () => void;
  /** The task is a segment of a lesson, under its header: no screen of its own, no "Try it again". */
  readonly inLesson?: boolean;
  /** The way to what the engine chose once the attempt is over, outside a lesson (R24). */
  readonly next?: ReactNode;
}

/** The result's end: what "Try it again" came to, the way on, "Try it again" and the way back. */
export function ResultEnd({ parts }: { readonly parts: TaskParts }) {
  const { words } = useLanguage();
  const { pending } = parts;
  return (
    <>
      {parts.againFailure === undefined ? null : (
        <p role="alert" className="nt-error">
          {failureText(parts.againFailure, words)}
        </p>
      )}
      {/* In a lesson the way on is its Continue, below the task (R23). */}
      {parts.inLesson === true ? null : parts.next}
      {parts.inLesson === true ? null : (
        <div className="nt-buttons">
          <button
            type="button"
            className="nt-secondary"
            aria-disabled={pending}
            onClick={() => {
              if (!pending) parts.onAgain();
            }}
          >
            {words.text("task.again")}
          </button>
          <HomeButton onPress={parts.onHome} />
        </div>
      )}
    </>
  );
}

/** "Hint", beside Check always: it does not send the work (R22). */
export function HintButton({ parts }: { readonly parts: TaskParts }) {
  const { words } = useLanguage();
  return (
    <button
      type="button"
      className="nt-secondary"
      aria-disabled={parts.pending}
      onClick={() => {
        if (!parts.pending) parts.onHint();
      }}
    >
      {words.text("task.hint")}
    </button>
  );
}

export function TaskLayout({
  parts,
  over,
  underCanvas,
  panel,
  tutor,
  result,
  check,
}: {
  readonly parts: TaskParts;
  /** The attempt is over: the panel gives way to its result, and the steps go. */
  readonly over: boolean;
  /** What stands under the canvas. */
  readonly underCanvas: ReactNode;
  /** The panel stands on my own too: the screen's rule says when. */
  readonly panel: boolean;
  /** The block "Tutor", under the hint. */
  readonly tutor: ReactNode;
  /** The result, once the attempt is over. */
  readonly result: ReactNode;
  /** The row of Check, under what the last check came to. */
  readonly check: ReactNode;
}) {
  const { task, manifest, steps, mode } = parts;
  const { language, words } = useLanguage();
  const explanation = manifest?.languages.explanation;
  const statement = useMemo(() => taskPhrases(task, explanation), [task, explanation]);
  return (
    <Frame inLesson={parts.inLesson === true} title={words.text("task.title")}>
      {/* Once the attempt is over, its result has the way back; in a lesson, its Leave (R57). While
          a check or the solution is under way, the way waits for its answer. */}
      {parts.inLesson === true || over ? null : (
        <HomeWay onPress={parts.onHome} pending={parts.pending} />
      )}
      {steps.length === 0 || over ? null : (
        <fieldset className="nt-buttons">
          <legend>{words.text("task.mode")}</legend>
          <button
            type="button"
            aria-pressed={mode === "steps"}
            onClick={() => parts.onMode("steps")}
          >
            {words.text("task.by-steps")}
          </button>
          <button type="button" aria-pressed={mode === "self"} onClick={() => parts.onMode("self")}>
            {words.text("task.on-my-own")}
          </button>
        </fieldset>
      )}
      <VoicingToggle language={explanation} />
      <p role="status" className="nt-error">
        {parts.notSaved ? words.text("task.not-saved") : ""}
      </p>
      <div className="nt-task">
        <div className="nt-task-work">
          <ReadAloud phrases={statement} language={explanation} />
          {/* The order of the properties is the order React gives them (section 3.1). */}
          <novatrail-canvas
            ref={parts.canvasRef}
            lang={language}
            {...(manifest === undefined ? {} : { manifest })}
            media={parts.media}
            task={task}
            history={parts.history}
            onhistorychange={parts.onHistoryChange}
          />
          {underCanvas}
        </div>
        {over || mode === "steps" || panel ? (
          <aside className="nt-task-panel" aria-label={words.text("task.tutor")}>
            {over ? (
              result
            ) : (
              <>
                {parts.hint === undefined ? null : (
                  <Hint
                    hint={parts.hint}
                    task={task}
                    catalog={parts.catalog}
                    language={explanation}
                  />
                )}
                {tutor}
              </>
            )}
            {!over && mode === "steps" ? (
              <StepsPanel
                task={task}
                steps={steps}
                catalog={parts.catalog}
                state={parts.state}
                filled={parts.filled}
                language={explanation}
                onGoTo={parts.onGoTo}
                onTick={parts.onTick}
                onDone={parts.onDone}
              />
            ) : null}
          </aside>
        ) : null}
        <div className="nt-task-check">
          {parts.failure === undefined ? null : (
            <p role="alert" className="nt-error">
              {failureText(parts.failure, words)}
            </p>
          )}
          {check}
        </div>
      </div>
    </Frame>
  );
}
