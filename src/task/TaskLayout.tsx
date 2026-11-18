// What the task screen and the screen of an essay share (section 3.3 of docs/architecture.md; R20,
// R53 and R65 in docs/decisions.md), as the mockup's `task-pill`: the whole window, the top bar's
// glass pill at the top — Back, which goes to My subjects, and the heading — with the profile's pill
// and the pill of the mode at its other end, or, in a lesson, the lesson's bar with the pill of the
// mode in it; the voicing switched on and off and "Read aloud" of the statement above the canvas,
// which fills the rest of the window, its statement, its sheet and its bar of tools its own, with
// what each screen puts under it; the tutor's panel beside it from 64rem and above it on a narrower
// screen — the hint and the tutor's words at its top, the steps under them, or the attempt's result
// once it is over —; and at the foot the screen's lines, the verdict's card and the row of glass,
// in the middle, of the screen's buttons. By steps the panel stands always; on my own, as each
// screen says. Each screen gives what is its own: under the canvas, the words, the result, the card
// and the row's buttons.
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
import { Icon } from "../app/Icon.tsx";
import { IconButton } from "../app/IconButton.tsx";
import type { IconValue } from "../app/icons.ts";
import { LearnerMenu } from "../app/LearnerMenu.tsx";
import { PopOver } from "../app/PopOver.tsx";
import { Screen } from "../app/Screen.tsx";
import { AtTopEnd } from "../app/TopEnd.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { ReadAloud } from "../voice/ReadAloud.tsx";
import { taskPhrases } from "../voice/texts.ts";
import { VoicingToggle } from "../voice/VoicingToggle.tsx";
import { Hint, type HintGiven } from "./Hint.tsx";
import { StepsPanel } from "./StepsPanel.tsx";
import type { Mode, StepsState } from "./steps.ts";

/**
 * The screen of the task — the top bar's pill with Back to My subjects (R57) and the heading, the
 * profile's pill and the mode's at the bar's other end —, or, in a lesson, the lesson's screen around
 * it, the mode's pill at the end of the lesson's bar.
 */
export function Frame({
  inLesson,
  title,
  onHome,
  pending = false,
  mode,
  children,
}: {
  readonly inLesson: boolean;
  readonly title: string;
  readonly onHome: () => void;
  /** A request is under way, whose answer the learner would not see: Back waits for it (R57). */
  readonly pending?: boolean;
  /** The pill of the mode, where the task has one. */
  readonly mode?: ReactNode;
  readonly children: ReactNode;
}) {
  if (inLesson) {
    return (
      <div className="nt-lesson-task">
        {mode === undefined ? null : <AtTopEnd>{mode}</AtTopEnd>}
        {children}
      </div>
    );
  }
  return (
    <Screen
      title={title}
      layout="task"
      bar={{
        back: (
          <IconButton
            value="back"
            caption="task.home"
            {...(pending ? { "aria-disabled": true } : {})}
            onClick={() => {
              if (!pending) onHome();
            }}
          />
        ),
        end: (
          <div className="nt-top-end">
            <LearnerMenu />
            {mode}
          </div>
        ),
      }}
    >
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

/**
 * The result's end: what "Try it again" came to, the way on and "Try it again"; the way back is the
 * top bar's (R57).
 */
export function ResultEnd({ parts }: { readonly parts: TaskParts }) {
  const { words } = useLanguage();
  const { pending } = parts;
  const failure =
    parts.againFailure === undefined ? null : (
      <p role="alert" className="nt-error">
        {failureText(parts.againFailure, words)}
      </p>
    );
  // In a lesson the way on is its Continue, below the task (R23).
  if (parts.inLesson === true) return failure;
  return (
    <>
      {failure}
      {parts.next}
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
      </div>
    </>
  );
}

/** "Hint", in the row beside Check always, a bulb before its word: it does not send the work (R22). */
export function HintButton({ parts }: { readonly parts: TaskParts }) {
  const { words } = useLanguage();
  return (
    <button
      type="button"
      className="nt-icon-button nt-row-button"
      aria-disabled={parts.pending}
      onClick={() => {
        if (!parts.pending) parts.onHint();
      }}
    >
      <Icon value="hint" />
      {words.text("task.hint")}
    </button>
  );
}

/** The line between the row's other buttons and Check, as the mockup's. */
export function RowLine() {
  return <span className="nt-row-line" aria-hidden="true" />;
}

/**
 * The pill of the mode, the mockup's `task-mode`: the mode shown and a chevron, which opens the two
 * modes in a pop-over hung 6 below it — each its name and what it does, the one shown pressed —, and
 * the line that the choice holds for this task. A choice closes the pop-over.
 */
export function ModePill({
  mode,
  onMode,
}: {
  readonly mode: Mode;
  readonly onMode: (mode: Mode) => void;
}) {
  const { words } = useLanguage();
  const shown = words.text(mode === "steps" ? "task.by-steps" : "task.on-my-own");
  return (
    <div className="nt-mode nt-glass">
      <PopOver
        label={words.text("task.mode")}
        buttonLabel={words.text("task.mode-open", { mode: shown })}
        caption={
          <>
            {shown}
            <Icon value="menu-open" />
          </>
        }
        className="nt-icon-button nt-mode-open"
        anchor=".nt-mode"
        gap={6}
        popClassName="nt-pop-mode"
      >
        {(close) => (
          <>
            {(["steps", "self"] as const).map((each) => (
              <button
                key={each}
                type="button"
                className="nt-mode-choice"
                aria-pressed={mode === each}
                onClick={() => {
                  close();
                  if (each !== mode) onMode(each);
                }}
              >
                <span className="nt-mode-name">
                  {words.text(each === "steps" ? "task.by-steps" : "task.on-my-own")}
                </span>
                <span className="nt-mode-line">
                  {words.text(each === "steps" ? "task.by-steps-line" : "task.on-my-own-line")}
                </span>
              </button>
            ))}
            <p className="nt-mode-note">{words.text("task.mode-note")}</p>
          </>
        )}
      </PopOver>
    </div>
  );
}

/** What the verdict's card tells: its sign, which `IconValue` draws, or the turning of a reading; an essay's feedback has a card of the same kind (R66). */
export type CardKind = "correct" | "not-yet" | "write" | "reading" | "shown" | "feedback";

const CARD_SIGNS: Readonly<Record<Exclude<CardKind, "reading">, IconValue>> = {
  correct: "ticked",
  "not-yet": "not-yet",
  write: "write",
  shown: "shown",
  feedback: "feedback",
};

/**
 * The verdict's card above the row, the mockup's: its sign in a circle of 36, its title and a line
 * under it, and its buttons at its end. It is drawn alone: what a screen reader is told of the
 * verdict is the screen's status line, so that nothing is told twice.
 */
export function VerdictCard({
  kind,
  title,
  line,
  children,
}: {
  readonly kind: CardKind;
  readonly title: string;
  readonly line?: string | undefined;
  /** Its buttons. */
  readonly children?: ReactNode;
}) {
  return (
    <div className="nt-card-verdict nt-glass" data-kind={kind}>
      <span className="nt-card-sign" aria-hidden="true">
        {kind === "reading" ? <span className="nt-spin" /> : <Icon value={CARD_SIGNS[kind]} />}
      </span>
      <div className="nt-card-words">
        <span className="nt-card-title">{title}</span>
        {line === undefined || line === "" ? null : <span className="nt-card-line">{line}</span>}
      </div>
      {children}
    </div>
  );
}

export function TaskLayout({
  parts,
  over,
  underCanvas,
  panel,
  tutor,
  result,
  lines,
  card,
  row,
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
  /** The lines above the card: hints, notes and the status lines a screen reader is told. */
  readonly lines: ReactNode;
  /** The verdict's card, while there is one. */
  readonly card?: ReactNode;
  /** The buttons of the row; none once the attempt is over. */
  readonly row?: ReactNode;
}) {
  const { task, manifest, steps, mode } = parts;
  const { language, words } = useLanguage();
  const explanation = manifest?.languages.explanation;
  const statement = useMemo(() => taskPhrases(task, explanation), [task, explanation]);
  return (
    <Frame
      inLesson={parts.inLesson === true}
      title={words.text("task.title")}
      onHome={parts.onHome}
      // Once the attempt is over nothing waits: the way home is open again.
      pending={parts.pending && !over}
      {...(steps.length === 0 || over
        ? {}
        : { mode: <ModePill mode={mode} onMode={parts.onMode} /> })}
    >
      <div className="nt-task-lines">
        <p role="status" className="nt-error">
          {parts.notSaved ? words.text("task.not-saved") : ""}
        </p>
        <VoicingToggle language={explanation} />
        <ReadAloud phrases={statement} language={explanation} />
      </div>
      <div className="nt-task">
        <div className="nt-task-work">
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
      </div>
      <div className="nt-task-foot">
        {parts.failure === undefined ? null : (
          <p role="alert" className="nt-error">
            {failureText(parts.failure, words)}
          </p>
        )}
        {lines}
        {card}
        {row === undefined || row === null ? null : (
          <div className="nt-task-row nt-glass">{row}</div>
        )}
      </div>
    </Frame>
  );
}
