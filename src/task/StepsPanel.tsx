// The solving steps in the tutor's panel, as the mockup's `task` and
// `task-steps`: a white card at the panel's top — "Step 2 of 4" with a chevron, which opens the
// list of the steps, each with its place — passed, now or later — in a word, not in colour alone;
// the step's title and "Read aloud" of the step, its chips and its cards; its description in the
// module's language, the chips to tick and the cards of techniques it gives, and the line of what
// opens "Step done". A step passed is a touch away; forward goes only "Step done", which reads no
// work. The last step has no "Step done": it ends with Check. While the panel is closed the step
// stands as a pill above the row, which opens the panel, with its "Step done" (StepPill).
import type * as open from "@altnovatrail/spec/formatv0/open";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "../app/Icon.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Words } from "../i18n/words.ts";
import { TechniqueCards } from "../solving/TechniqueCards.tsx";
import { ReadAloud } from "../voice/ReadAloud.tsx";
import { stepPhrases } from "../voice/texts.ts";
import { exitMet, givesChips, givesTechniques, onWorkbook, type StepsState } from "./steps.ts";

/** The line of what opens "Step done", by the exit condition; none for `none`. */
const EXIT_LINES = {
  givens_ticked: "steps.exit-givens",
  answer_slots_filled: "steps.exit-slots",
} as const;

/**
 * The line of an exit condition, by its own entry alone: a newer format's condition has none. On a
 * workbook the slots are its boxes, as Check names them.
 */
function exitLine(
  condition: string,
  task: open.Task,
): "steps.exit-givens" | "steps.exit-slots" | "task.check-boxes" | undefined {
  if (!Object.hasOwn(EXIT_LINES, condition)) return undefined;
  const line = EXIT_LINES[condition as keyof typeof EXIT_LINES];
  return line === "steps.exit-slots" && onWorkbook(task) ? "task.check-boxes" : line;
}

/** Where the step shown stands: "Step 2 of 4". */
function stepOf(state: StepsState, steps: readonly open.Step[], words: Words): string {
  return words.text("steps.of", { place: state.place, count: steps.length });
}

export interface StepsPanelProps {
  readonly task: open.Task;
  readonly steps: readonly open.Step[];
  readonly catalog: open.Techniques | undefined;
  readonly state: StepsState;
  readonly filled: readonly (readonly boolean[])[] | null;
  /** The module's explanation language, the `lang` of its texts. */
  readonly language: string | undefined;
  readonly onGoTo: (place: number) => void;
  readonly onTick: (chip: number | "unknown") => void;
  readonly onDone: () => void;
}

/** "Step done", not disabled while it is locked: a disabled button would drop the focus. */
function StepDone({
  met,
  lineId,
  onDone,
}: {
  readonly met: boolean;
  readonly lineId: string | undefined;
  readonly onDone: () => void;
}) {
  const { words } = useLanguage();
  return (
    <button
      type="button"
      className="nt-step-done"
      aria-disabled={!met}
      {...(lineId === undefined ? {} : { "aria-describedby": lineId })}
      onClick={() => {
        if (met) onDone();
      }}
    >
      {words.text("steps.done")}
    </button>
  );
}

export function StepsPanel({
  task,
  steps,
  catalog,
  state,
  filled,
  language,
  onGoTo,
  onTick,
  onDone,
}: StepsPanelProps) {
  const { words } = useLanguage();
  const lineId = useId();
  const listId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef(state.place);
  const [listed, setListed] = useState(false);
  // A step that takes another's place takes the focus on its title, as a screen does (2.4.3), and
  // the list of the steps folds away.
  useEffect(() => {
    if (shown.current !== state.place) {
      setListed(false);
      heading.current?.focus();
    }
    shown.current = state.place;
  }, [state.place]);

  const step = steps[state.place - 1];
  if (step === undefined) return null;
  const lang = language === undefined ? {} : { lang: language };
  const last = state.place === steps.length;
  const met = exitMet(step, task, state, filled);
  const lineKey = exitLine(step.exit_condition, task);
  const techniques = givesTechniques(step) ? (state.techniques[state.place] ?? []) : [];

  return (
    // Its own scroll, which a keyboard scrolls by its buttons — "Step n of m" first (2.1.1).
    <section className="nt-steps nt-step-card" aria-label={words.text("steps.card")}>
      <div className="nt-step-head">
        <div className="nt-step-names">
          <button
            type="button"
            className="nt-step-open"
            aria-expanded={listed}
            aria-controls={listId}
            onClick={() => setListed((was) => !was)}
          >
            {stepOf(state, steps, words)}
            <Icon value="menu-open" />
          </button>
          <h2 ref={heading} tabIndex={-1} className="nt-step-title" {...lang}>
            {step.title}
          </h2>
        </div>
        <ReadAloud
          phrases={stepPhrases(
            step,
            givesChips(step, task)
              ? [...(task.givens ?? []), ...(task.unknown === undefined ? [] : [task.unknown])]
              : [],
            techniques,
            catalog,
            language,
          )}
          language={language}
        />
      </div>
      <ol
        id={listId}
        className="nt-step-bar"
        aria-label={words.text("steps.title")}
        hidden={!listed}
      >
        {steps.map((each, i) => {
          const place = i + 1;
          const mark =
            place === state.place
              ? words.text("steps.now")
              : place <= state.reached
                ? words.text("steps.passed")
                : words.text("steps.later");
          const inside = (
            <>
              <span className="nt-step-number">
                {place}
                <span className="nt-hidden-label">.</span>
              </span>{" "}
              <span className="nt-step-name" {...lang}>
                {each.title}
              </span>{" "}
              <span className="nt-step-mark">({mark})</span>
            </>
          );
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: the steps never move, and two may share a title.
            <li key={i} {...(place === state.place ? { "aria-current": "step" } : {})}>
              {place !== state.place && place <= state.reached ? (
                <button type="button" className="nt-step" onClick={() => onGoTo(place)}>
                  {inside}
                </button>
              ) : (
                <span className="nt-step">{inside}</span>
              )}
            </li>
          );
        })}
      </ol>
      {step.description === undefined ? null : (
        <p className="nt-step-text" {...lang}>
          {step.description}
        </p>
      )}
      {givesChips(step, task) ? (
        <div className="nt-chips">
          {(task.givens?.length ?? 0) > 0 ? (
            <fieldset className="nt-chip-group">
              <legend>{words.text("steps.givens")}</legend>
              {task.givens?.map((given, i) => (
                <button
                  // biome-ignore lint/suspicious/noArrayIndexKey: the givens never move, and two may say the same.
                  key={i}
                  type="button"
                  className="nt-chip"
                  aria-pressed={state.ticked.givens.includes(i)}
                  onClick={() => onTick(i)}
                  {...lang}
                >
                  <span className="nt-chip-tick" aria-hidden="true">
                    <Icon value="ticked" />
                  </span>
                  {given}
                </button>
              ))}
            </fieldset>
          ) : null}
          {task.unknown === undefined ? null : (
            <fieldset className="nt-chip-group">
              <legend>{words.text("steps.unknown")}</legend>
              <button
                type="button"
                className="nt-chip"
                aria-pressed={state.ticked.unknown}
                onClick={() => onTick("unknown")}
                {...lang}
              >
                <span className="nt-chip-tick" aria-hidden="true">
                  <Icon value="ticked" />
                </span>
                {task.unknown}
              </button>
            </fieldset>
          )}
        </div>
      ) : null}
      <TechniqueCards ids={techniques} catalog={catalog} language={language} />
      {lineKey === undefined ? null : (
        <p id={lineId} className="nt-step-line">
          {words.text(lineKey)}
        </p>
      )}
      {last ? null : (
        <StepDone met={met} lineId={lineKey === undefined ? undefined : lineId} onDone={onDone} />
      )}
    </section>
  );
}

/**
 * The step while the tutor's panel is closed, the mockup's `task-pill`: a pill of glass above the
 * row — "Step 1 of 4" and the step's title, a press on which opens the panel,
 * and its "Step done".
 */
export function StepPill({
  task,
  steps,
  state,
  filled,
  language,
  onOpen,
  onDone,
}: Pick<StepsPanelProps, "task" | "steps" | "state" | "filled" | "language" | "onDone"> & {
  readonly onOpen: () => void;
}) {
  const { words } = useLanguage();
  const lineId = useId();
  const step = steps[state.place - 1];
  if (step === undefined) return null;
  const of = stepOf(state, steps, words);
  const lineKey = exitLine(step.exit_condition, task);
  return (
    <div className="nt-step-pill nt-glass">
      <button
        type="button"
        className="nt-step-pill-open"
        aria-label={words.text("steps.pill", { of, title: step.title })}
        onClick={onOpen}
      >
        <span className="nt-step-of">{of}</span>
        <span className="nt-step-title" {...(language === undefined ? {} : { lang: language })}>
          {step.title}
        </span>
      </button>
      {state.place === steps.length ? null : (
        <>
          {lineKey === undefined ? null : (
            <span id={lineId} className="nt-hidden-label">
              {words.text(lineKey)}
            </span>
          )}
          <StepDone
            met={exitMet(step, task, state, filled)}
            lineId={lineKey === undefined ? undefined : lineId}
            onDone={onDone}
          />
        </>
      )}
    </div>
  );
}
