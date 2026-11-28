// The layout of the task screen, as the mockup's
// `task-pill` and `task`: the whole window, the top bar's glass pill at the top — Back, which goes
// to Home, and the heading — with the profile's pill and the pill of the mode at its other
// end, or, in a lesson, the lesson's bar with the pill of the mode in it; the voicing switched on
// and off and "Read aloud" of the statement above the canvas, which fills the rest of the window,
// its statement, its sheet and its bar of tools its own, with what each screen puts under it; at
// the foot the screen's lines, the verdict's card or the step's pill, and the row of glass, in the
// middle, of the screen's buttons; and the tutor's panel. Closed, it is the tutor's button at the
// window's right edge, and by steps the step's pill above the row, either of which opens it. Open,
// it is glass of 400 at the right, from under the top bar to 16 above the window's foot, the
// canvas, its lines and the foot ending where it begins; on a phone it is a sheet from the bottom,
// at half the height or by its grabber over the whole screen, which hides the row and the canvas's
// bar of tools. Its head — the tutor's sign, its name, the learner's share of the
// quota, the switch of voicing and ×; the step's card by steps; the conversation, which scrolls —
// the verdict's line, the hint and the tutor's words, or the
// attempt's result once it is over —; and at its foot Hint and "Explain differently". Each screen
// gives what is its own: under the canvas, the words, the result, the card and the row's buttons.
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
import { LearnerMenu } from "../app/LearnerMenu.tsx";
import { useNarrow } from "../app/narrow.ts";
import { PopOver } from "../app/PopOver.tsx";
import { Screen } from "../app/Screen.tsx";
import { Loading, Sk } from "../app/Skeleton.tsx";
import { AtTopEnd } from "../app/TopEnd.tsx";
import { usePens } from "../canvas/pens.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { Hint, type HintGiven } from "../solving/Hint.tsx";
import { TutorPanel, usePanelFocus } from "../solving/TutorPanel.tsx";
import { ReadAloud } from "../voice/ReadAloud.tsx";
import { taskPhrases } from "../voice/texts.ts";
import { VoicingToggle } from "../voice/VoicingToggle.tsx";
import { StepPill, StepsPanel } from "./StepsPanel.tsx";
import type { Mode, StepsState } from "./steps.ts";

/**
 * The screen of the task — the top bar's pill with Back to Home and the heading, the
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
  /** A request is under way, whose answer the learner would not see: Back waits for it. */
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

/**
 * The task while its attempt is read: its frame as it will stand, the shapes of its
 * statement below the bar and of the row of glass at its foot.
 */
export function TaskLoading({
  inLesson,
  onHome,
}: {
  readonly inLesson: boolean;
  readonly onHome: () => void;
}) {
  const { words } = useLanguage();
  return (
    <Frame inLesson={inLesson} title={words.text("task.title")} onHome={onHome}>
      <Loading className="nt-task-loading">
        <Sk width="min(32rem, 90%)" height="1.125rem" radius="0.375rem" />
        <Sk width="min(24rem, 70%)" height="1.125rem" radius="0.375rem" />
        <Sk width="min(14rem, 45%)" height="0.875rem" radius="0.3125rem" />
        <Sk
          className="nt-task-loading-row"
          width="min(20rem, 100%)"
          height="3.5rem"
          radius="1.75rem"
        />
      </Loading>
    </Frame>
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
  /** Check blinks once on a pause. */
  readonly blink: boolean;
  /** "Report a problem" with the tutor's words shown, for a learner of the category adult. */
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
  /** The way to what the engine chose once the attempt is over, outside a lesson. */
  readonly next?: ReactNode;
}

/**
 * The result's end: what "Try it again" came to, the way on and "Try it again"; the way back is the
 * top bar's.
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
  // In a lesson the way on is its Continue, below the task.
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

export function TaskLayout({
  parts,
  over,
  underCanvas,
  open,
  onOpen,
  onClose,
  quota,
  tutor,
  acts,
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
  /** The tutor's panel is open, while the attempt is: the screen's rule says when. */
  readonly open: boolean;
  /** The tutor's button and the step's pill open the panel; none, and they are not drawn. */
  readonly onOpen?: () => void;
  /** The panel's ×; none, and it has none. */
  readonly onClose?: () => void;
  /** The line of the panel's head: the learner's share of the quota. */
  readonly quota?: string | undefined;
  /** What the tutor and the program said in the panel: the verdict's line, the hint, the words. */
  readonly tutor: ReactNode;
  /** The buttons at the panel's foot: Hint, and "Explain differently" while the rung has it. */
  readonly acts?: ReactNode;
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
  const narrow = useNarrow();
  const pens = usePens();
  const explanation = manifest?.languages.explanation;
  const statement = useMemo(() => taskPhrases(task, explanation), [task, explanation]);
  const shown = over || open;
  // The step's pill goes with its press too (2.4.3).
  const { heading, call } = usePanelFocus(shown);
  // The open panel stands over the canvas, and its lines and the foot end where it begins; on a
  // phone its sheet hides the row and the canvas's bar of tools.
  const beside = shown ? { "data-beside": "panel" } : {};
  const stepsShown = !over && mode === "steps";
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
      <div className="nt-task-lines" {...beside}>
        <p role="status" className="nt-error">
          {parts.notSaved ? words.text("task.not-saved") : ""}
        </p>
        {/* The switch of voicing stands in the panel's head while the panel is open. */}
        {shown ? null : <VoicingToggle language={explanation} />}
        <ReadAloud phrases={statement} language={explanation} />
      </div>
      <div className="nt-task" {...beside}>
        <div className="nt-task-work">
          {/* The order of the properties is the order React gives them. */}
          <novatrail-canvas
            ref={parts.canvasRef}
            lang={language}
            {...(narrow && shown ? { "tools-hidden": "" } : {})}
            {...(manifest === undefined ? {} : { manifest })}
            media={parts.media}
            task={task}
            history={parts.history}
            onhistorychange={parts.onHistoryChange}
            {...pens}
          />
          {underCanvas}
        </div>
      </div>
      <div
        className="nt-task-foot"
        {...beside}
        {...(onOpen === undefined ? {} : { "data-tutor-side": "" })}
      >
        {parts.failure === undefined ? null : (
          <p role="alert" className="nt-error">
            {failureText(parts.failure, words)}
          </p>
        )}
        {lines}
        {card}
        {card === undefined || card === null ? (
          stepsShown && !open && onOpen !== undefined ? (
            <StepPill
              task={task}
              steps={steps}
              state={parts.state}
              filled={parts.filled}
              language={explanation}
              onOpen={onOpen}
              onDone={parts.onDone}
            />
          ) : null
        ) : null}
        {row === undefined || row === null ? null : (
          <div className="nt-task-row nt-glass">{row}</div>
        )}
      </div>
      {/* A task of a module asks the tutor by its buttons alone: the panel has no field here. */}
      <TutorPanel
        open={shown}
        kit={{
          voicing: { language: explanation },
          ...(onOpen === undefined ? {} : { side: { onOpen, buttonRef: call } }),
        }}
        headingRef={heading}
        status={quota}
        onClose={over ? undefined : onClose}
        above={
          stepsShown ? (
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
          ) : null
        }
        talk={
          over ? (
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
          )
        }
        acts={over ? undefined : acts}
      />
    </Frame>
  );
}
